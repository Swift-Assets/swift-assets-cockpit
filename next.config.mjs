/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Cockpit is internal-only. Discourage indexing at the framework level;
  // real access control is enforced by Supabase Auth + middleware + RLS.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
