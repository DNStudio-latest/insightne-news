// Shows one proof screenshot of a News Hunter draft. Only a signed-in admin can see it.
import { currentRole } from "../../../lib/auth.js";
import { hunterStore } from "../../../lib/hunter/store.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if ((await currentRole()) !== "admin") return new Response("Not allowed", { status: 403 });
  const params = new URL(request.url).searchParams;
  const draft = await hunterStore.getDraft(params.get("draft") || "");
  const source = draft?.sources?.[Number(params.get("i"))];
  if (!source?.proof) return new Response("Not found", { status: 404 });
  const bytes = await hunterStore.readProof(source.proof);
  return new Response(bytes, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store" } });
}
