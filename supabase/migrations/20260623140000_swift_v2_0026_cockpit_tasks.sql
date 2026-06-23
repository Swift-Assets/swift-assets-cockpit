-- =============================================================================
-- Migration: swift_v2_0026_cockpit_tasks
-- Phase 6E — Internal tasks & follow-up system (read model + write RPCs)
--
-- STATUS: REPO-ONLY. NOT APPLIED TO PRODUCTION.
-- Apply only after explicit human approval.
--
-- Creates the internal cockpit task/follow-up layer:
--   * swift_v2.cockpit_tasks         — task records (RLS; base locked down)
--   * swift_v2.cockpit_task_events   — append-only task history (RLS; locked)
--   * swift_v2.v_cockpit_my_tasks    — safe team-visible read view (definer)
--   * SECURITY DEFINER lifecycle RPCs (create/update/complete/reopen/archive)
--
-- Safety / conventions (consistent with watchlist + 0024/0025):
--   * Ownership/actor always derive from auth.uid(); never trusted from input.
--   * Writes go through SECURITY DEFINER RPCs gated by _cockpit_writer_role()
--     (analyst/lead/admin); viewer can READ but not write. Archive = lead/admin.
--   * Base tables: RLS on; anon/authenticated fully revoked (no direct DML).
--   * Read view is SECURITY DEFINER + active-cockpit-user gate; anon = 0 rows.
--   * No PII payloads, raw announcement text, secrets, or raw SQL errors stored
--     or exposed. related_label is a SAFE caller-supplied display label only.
--   * No seed/demo data. No cron, no Edge Functions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Tables
-- ---------------------------------------------------------------------------
create table if not exists swift_v2.cockpit_tasks (
    task_id        uuid primary key default gen_random_uuid(),
    title          text not null,
    description    text,
    task_type      text not null
                     check (task_type in ('follow_up','review','outreach',
                       'system_issue','data_quality','legal_review',
                       'privacy_review','portal_health','manual')),
    priority       text not null default 'medium'
                     check (priority in ('low','medium','high','urgent')),
    status         text not null default 'open'
                     check (status in ('open','in_progress','waiting','done','archived')),
    assigned_to    uuid references auth.users(id),
    created_by     uuid not null default auth.uid() references auth.users(id),
    related_kind   text
                     check (related_kind is null or related_kind in
                       ('company','nachlass','watchlist','entity','system',
                        'portal','privacy','email','data_quality','manual')),
    related_id     uuid,
    related_label  text,
    source_view    text,
    due_at         timestamptz,
    completed_at   timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

comment on table swift_v2.cockpit_tasks is
  'Phase 6E: internal cockpit tasks/follow-ups. Writes only via SECURITY DEFINER RPCs; read via v_cockpit_my_tasks. related_label is a SAFE display label only — never raw PII / announcement text / secrets.';

create index if not exists idx_cockpit_tasks_status on swift_v2.cockpit_tasks (status);
create index if not exists idx_cockpit_tasks_due_at on swift_v2.cockpit_tasks (due_at);
create index if not exists idx_cockpit_tasks_assigned on swift_v2.cockpit_tasks (assigned_to);

create table if not exists swift_v2.cockpit_task_events (
    event_id    uuid primary key default gen_random_uuid(),
    task_id     uuid not null references swift_v2.cockpit_tasks(task_id) on delete cascade,
    actor_id    uuid references auth.users(id),
    event_type  text not null
                  check (event_type in ('created','updated','status_changed',
                    'priority_changed','assigned','completed','reopened','archived')),
    old_status  text,
    new_status  text,
    note        text,
    details     jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now()
);

comment on table swift_v2.cockpit_task_events is
  'Phase 6E: append-only task history. details holds safe metadata only — never PII or secrets.';

create index if not exists idx_cockpit_task_events_task on swift_v2.cockpit_task_events (task_id);

-- ---------------------------------------------------------------------------
-- 2) RLS + grants: base tables fully locked from anon/authenticated.
--    service_role bypasses RLS; all user access goes through RPCs + the view.
-- ---------------------------------------------------------------------------
alter table swift_v2.cockpit_tasks enable row level security;
alter table swift_v2.cockpit_task_events enable row level security;

revoke all on swift_v2.cockpit_tasks from public, anon, authenticated;
revoke all on swift_v2.cockpit_task_events from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Internal helpers (SECURITY DEFINER, pinned search_path)
-- ---------------------------------------------------------------------------

-- Returns the active cockpit role for auth.uid() (any role incl. viewer) or
-- raises. Used by read-gated contexts that allow viewers.
create or replace function swift_v2._cockpit_active_role()
  returns text language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_uid uuid := (select auth.uid());
    v_role text;
begin
    if v_uid is null then raise exception 'not_authenticated'; end if;
    select p.role::text into v_role
    from swift_v2.cockpit_user_profiles p
    where p.user_id = v_uid and p.is_active;
    if v_role is null then raise exception 'no_active_cockpit_profile'; end if;
    return v_role;
end;
$$;
revoke all on function swift_v2._cockpit_active_role() from public;

-- Append a task event. Internal only.
create or replace function swift_v2._cockpit_task_event(
    p_task_id uuid, p_event_type text, p_old_status text, p_new_status text,
    p_note text, p_details jsonb
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
begin
    insert into swift_v2.cockpit_task_events
        (task_id, actor_id, event_type, old_status, new_status, note, details)
    values
        (p_task_id, (select auth.uid()), p_event_type, p_old_status, p_new_status,
         p_note, coalesce(p_details, '{}'::jsonb));
end;
$$;
revoke all on function swift_v2._cockpit_task_event(uuid,text,text,text,text,jsonb) from public;

-- Enum validators (raise safe error tokens).
create or replace function swift_v2._cockpit_task_validate(
    p_task_type text, p_priority text, p_status text, p_related_kind text
) returns void language plpgsql immutable
  set search_path = swift_v2, public, pg_catalog
as $$
begin
    if p_task_type is not null and p_task_type not in
        ('follow_up','review','outreach','system_issue','data_quality',
         'legal_review','privacy_review','portal_health','manual')
        then raise exception 'invalid_task_type'; end if;
    if p_priority is not null and p_priority not in ('low','medium','high','urgent')
        then raise exception 'invalid_priority'; end if;
    if p_status is not null and p_status not in
        ('open','in_progress','waiting','done','archived')
        then raise exception 'invalid_status'; end if;
    if p_related_kind is not null and p_related_kind not in
        ('company','nachlass','watchlist','entity','system','portal','privacy',
         'email','data_quality','manual')
        then raise exception 'invalid_related_kind'; end if;
end;
$$;
revoke all on function swift_v2._cockpit_task_validate(text,text,text,text) from public;

-- ---------------------------------------------------------------------------
-- 4) Lifecycle RPCs (writer role = analyst/lead/admin via _cockpit_writer_role)
-- ---------------------------------------------------------------------------
create or replace function swift_v2.cockpit_create_task(
    p_title text,
    p_task_type text,
    p_description text default null,
    p_priority text default 'medium',
    p_assigned_to uuid default null,
    p_related_kind text default null,
    p_related_id uuid default null,
    p_related_label text default null,
    p_source_view text default null,
    p_due_at timestamptz default null
) returns uuid language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_uid  uuid := (select auth.uid());
    v_role text := swift_v2._cockpit_writer_role();
    v_task uuid;
begin
    if p_title is null or length(btrim(p_title)) = 0 then
        raise exception 'title_required';
    end if;
    perform swift_v2._cockpit_task_validate(p_task_type, p_priority, null, p_related_kind);

    insert into swift_v2.cockpit_tasks
        (title, description, task_type, priority, status, assigned_to, created_by,
         related_kind, related_id, related_label, source_view, due_at)
    values
        (btrim(p_title), p_description, p_task_type, coalesce(p_priority,'medium'),
         'open', p_assigned_to, v_uid, p_related_kind, p_related_id, p_related_label,
         p_source_view, p_due_at)
    returning task_id into v_task;

    perform swift_v2._cockpit_task_event(
        v_task, 'created', null, 'open', null,
        jsonb_build_object('task_type', p_task_type, 'priority', coalesce(p_priority,'medium'),
                           'has_due', (p_due_at is not null), 'actor_role', v_role));
    return v_task;
end;
$$;

create or replace function swift_v2.cockpit_update_task(
    p_task_id uuid,
    p_set_title boolean default false,        p_title text default null,
    p_set_description boolean default false,  p_description text default null,
    p_set_task_type boolean default false,    p_task_type text default null,
    p_set_priority boolean default false,     p_priority text default null,
    p_set_status boolean default false,       p_status text default null,
    p_set_assigned boolean default false,     p_assigned_to uuid default null,
    p_set_related boolean default false,      p_related_kind text default null,
                                              p_related_id uuid default null,
                                              p_related_label text default null,
    p_set_source_view boolean default false,  p_source_view text default null,
    p_set_due boolean default false,          p_due_at timestamptz default null
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
    v_old  swift_v2.cockpit_tasks%rowtype;
begin
    select * into v_old from swift_v2.cockpit_tasks where task_id = p_task_id;
    if v_old.task_id is null then raise exception 'task_not_found'; end if;

    if p_set_title and (p_title is null or length(btrim(p_title)) = 0) then
        raise exception 'title_required';
    end if;

    perform swift_v2._cockpit_task_validate(
        case when p_set_task_type then p_task_type end,
        case when p_set_priority then p_priority end,
        case when p_set_status then p_status end,
        case when p_set_related then p_related_kind end);

    update swift_v2.cockpit_tasks set
        title         = case when p_set_title then btrim(coalesce(p_title, title)) else title end,
        description   = case when p_set_description then p_description else description end,
        task_type     = case when p_set_task_type and p_task_type is not null then p_task_type else task_type end,
        priority      = case when p_set_priority and p_priority is not null then p_priority else priority end,
        status        = case when p_set_status and p_status is not null then p_status else status end,
        assigned_to   = case when p_set_assigned then p_assigned_to else assigned_to end,
        related_kind  = case when p_set_related then p_related_kind else related_kind end,
        related_id    = case when p_set_related then p_related_id else related_id end,
        related_label = case when p_set_related then p_related_label else related_label end,
        source_view   = case when p_set_source_view then p_source_view else source_view end,
        due_at        = case when p_set_due then p_due_at else due_at end,
        completed_at  = case when p_set_status and p_status = 'done' then now()
                             when p_set_status and p_status <> 'done' then null
                             else completed_at end,
        updated_at    = now()
    where task_id = p_task_id;

    perform swift_v2._cockpit_task_event(
        p_task_id, 'updated', v_old.status,
        case when p_set_status then p_status else v_old.status end, null,
        jsonb_build_object('actor_role', v_role));

    if p_set_status and p_status is distinct from v_old.status then
        perform swift_v2._cockpit_task_event(
            p_task_id, 'status_changed', v_old.status, p_status, null, '{}'::jsonb);
    end if;
    if p_set_priority and p_priority is distinct from v_old.priority then
        perform swift_v2._cockpit_task_event(
            p_task_id, 'priority_changed', null, null, null,
            jsonb_build_object('old', v_old.priority, 'new', p_priority));
    end if;
    if p_set_assigned and p_assigned_to is distinct from v_old.assigned_to then
        perform swift_v2._cockpit_task_event(
            p_task_id, 'assigned', null, null, null,
            jsonb_build_object('reassigned', true));
    end if;
end;
$$;

create or replace function swift_v2.cockpit_complete_task(
    p_task_id uuid, p_note text default null
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
    v_old  text;
begin
    select status into v_old from swift_v2.cockpit_tasks where task_id = p_task_id;
    if v_old is null then raise exception 'task_not_found'; end if;

    update swift_v2.cockpit_tasks
       set status = 'done', completed_at = now(), updated_at = now()
     where task_id = p_task_id;

    perform swift_v2._cockpit_task_event(
        p_task_id, 'completed', v_old, 'done', p_note,
        jsonb_build_object('actor_role', v_role));
end;
$$;

create or replace function swift_v2.cockpit_reopen_task(
    p_task_id uuid, p_note text default null
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
    v_old  text;
begin
    select status into v_old from swift_v2.cockpit_tasks where task_id = p_task_id;
    if v_old is null then raise exception 'task_not_found'; end if;

    update swift_v2.cockpit_tasks
       set status = 'open', completed_at = null, updated_at = now()
     where task_id = p_task_id;

    perform swift_v2._cockpit_task_event(
        p_task_id, 'reopened', v_old, 'open', p_note,
        jsonb_build_object('actor_role', v_role));
end;
$$;

create or replace function swift_v2.cockpit_archive_task(
    p_task_id uuid, p_note text default null
) returns void language plpgsql security definer
  set search_path = swift_v2, public, pg_catalog
as $$
declare
    v_role text := swift_v2._cockpit_writer_role();
    v_old  text;
begin
    if v_role not in ('lead','admin') then raise exception 'insufficient_role'; end if;
    select status into v_old from swift_v2.cockpit_tasks where task_id = p_task_id;
    if v_old is null then raise exception 'task_not_found'; end if;

    update swift_v2.cockpit_tasks
       set status = 'archived', updated_at = now()
     where task_id = p_task_id;

    perform swift_v2._cockpit_task_event(
        p_task_id, 'archived', v_old, 'archived', p_note,
        jsonb_build_object('actor_role', v_role));
end;
$$;

-- Grants: executable by authenticated; role enforcement is internal.
revoke all on function swift_v2.cockpit_create_task(text,text,text,text,uuid,text,uuid,text,text,timestamptz) from public, anon;
grant execute on function swift_v2.cockpit_create_task(text,text,text,text,uuid,text,uuid,text,text,timestamptz) to authenticated;
revoke all on function swift_v2.cockpit_update_task(uuid,boolean,text,boolean,text,boolean,text,boolean,text,boolean,text,boolean,uuid,boolean,text,uuid,text,boolean,text,boolean,timestamptz) from public, anon;
grant execute on function swift_v2.cockpit_update_task(uuid,boolean,text,boolean,text,boolean,text,boolean,text,boolean,text,boolean,uuid,boolean,text,uuid,text,boolean,text,boolean,timestamptz) to authenticated;
revoke all on function swift_v2.cockpit_complete_task(uuid,text) from public, anon;
grant execute on function swift_v2.cockpit_complete_task(uuid,text) to authenticated;
revoke all on function swift_v2.cockpit_reopen_task(uuid,text) from public, anon;
grant execute on function swift_v2.cockpit_reopen_task(uuid,text) to authenticated;
revoke all on function swift_v2.cockpit_archive_task(uuid,text) from public, anon;
grant execute on function swift_v2.cockpit_archive_task(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) Safe team-visible read view (active cockpit users; anon = 0 rows)
-- ---------------------------------------------------------------------------
create or replace view swift_v2.v_cockpit_my_tasks
  with (security_invoker = false) as
select
    t.task_id,
    t.title,
    t.description,
    t.task_type,
    t.priority,
    t.status,
    t.assigned_to,
    ap.display_name as assigned_to_name,
    ap.email        as assigned_to_email,
    t.created_by,
    cp.display_name as created_by_name,
    cp.email        as created_by_email,
    t.related_kind,
    t.related_id,
    t.related_label,
    t.source_view,
    t.due_at,
    t.completed_at,
    t.created_at,
    t.updated_at,
    greatest(0, (current_date - t.created_at::date)) as age_days,
    case
        when t.due_at is null then 'no_due_date'
        when t.due_at::date < current_date then 'overdue'
        when t.due_at::date = current_date then 'today'
        when t.due_at::date = current_date + 1 then 'tomorrow'
        else 'upcoming'
    end as due_bucket,
    (select count(*) from swift_v2.cockpit_task_events e where e.task_id = t.task_id) as event_count,
    (select max(e.created_at) from swift_v2.cockpit_task_events e where e.task_id = t.task_id) as latest_event_at
from swift_v2.cockpit_tasks t
left join swift_v2.cockpit_user_profiles ap on ap.user_id = t.assigned_to
left join swift_v2.cockpit_user_profiles cp on cp.user_id = t.created_by
where exists (
    select 1 from swift_v2.cockpit_user_profiles p
    where p.user_id = (select auth.uid()) and p.is_active
);

comment on view swift_v2.v_cockpit_my_tasks is
  'Phase 6E: team-visible task read view for active cockpit users (anon = 0 rows). Exposes safe task fields + cockpit-staff display names/emails (internal users, not case PII). No raw announcement text / case PII / secrets.';

revoke all on swift_v2.v_cockpit_my_tasks from public, anon;
grant select on swift_v2.v_cockpit_my_tasks to authenticated;
