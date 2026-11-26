import { redirect } from "next/navigation";
import { currentUser } from "../../../../lib/auth.js";
import PhoneCheck from "./PhoneCheck.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Phone check", robots: { index: false, follow: false } };

// Open this on the iPhone: it tests each part of the News desk (sign-in, saving, sound, MP3 maker) and shows what fails.
export default async function CheckPage() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "admin" && user.role !== "editor") redirect("/admin");
  return <PhoneCheck />;
}
