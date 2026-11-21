import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/auth.js";
import { loadItems } from "../../../lib/desk-store.js";
import { publishesDirectly } from "../../../lib/staff.js";
import { settings } from "../../../lib/config.js";
import DeskApp from "./DeskApp.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "News desk", robots: { index: false, follow: false } };

// The phone "News desk": the same steps as the Windows InsightNE News Tool, done on the iPhone with the
// Gemini and ChatGPT apps. Admin and editors only.
export default async function DeskPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "admin" && user.role !== "editor") redirect("/admin");
  const items = await loadItems();
  return (
    <DeskApp
      initialItems={items}
      canPublish={publishesDirectly(user.role)}
      autoPost={Boolean(settings.facebook?.autoPost || settings.instagram?.autoPost)}
    />
  );
}
