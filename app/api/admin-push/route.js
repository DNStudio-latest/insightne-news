// The admin's phone signs up for (POST) or stops (DELETE) the quiet "a reporter's story is waiting" alert.
// Only a signed-in admin can do this.
import { currentRole } from "../../../lib/auth.js";
import { isPushServiceUrl } from "../../../lib/push-hosts.js";
import { addAdminDevice, removeAdminDevice } from "../../../lib/admin-alert.js";

export const dynamic = "force-dynamic";

const validEndpoint = (e) => typeof e === "string" && e.length < 1000 && isPushServiceUrl(e);

export async function POST(request) {
  if ((await currentRole()) !== "admin") return Response.json({ error: "admin only" }, { status: 403 });
  try {
    const { subscription } = await request.json();
    const keys = subscription?.keys;
    if (!validEndpoint(subscription?.endpoint) || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
      return Response.json({ error: "bad subscription" }, { status: 400 });
    }
    await addAdminDevice({ endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh.slice(0, 200), auth: keys.auth.slice(0, 100) } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(request) {
  if ((await currentRole()) !== "admin") return Response.json({ error: "admin only" }, { status: 403 });
  try {
    const { endpoint } = await request.json();
    if (validEndpoint(endpoint)) await removeAdminDevice(endpoint);
  } catch {}
  return new Response(null, { status: 204 });
}
