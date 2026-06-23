import { redirect } from "next/navigation";

// The app has no public landing surface. Route to the cockpit; middleware will
// send unauthenticated users to /login.
export default function RootPage() {
  redirect("/cockpit/dashboard");
}
