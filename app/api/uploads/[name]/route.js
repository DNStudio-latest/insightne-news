// Practice mode only: shows photos saved on this computer (online, photos are stored by Supabase).
import fs from "node:fs";
import path from "node:path";
import { usingSupabase } from "../../../../lib/db.js";

const TYPES = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function GET(_request, { params }) {
  const { name } = await params;
  if (usingSupabase || !/^[a-f0-9-]+\.(jpg|png|webp)$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const bytes = fs.readFileSync(path.join(process.cwd(), "data", "uploads", name));
    return new Response(bytes, { headers: { "Content-Type": TYPES[name.split(".").pop()], "Cache-Control": "public, max-age=31536000" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
