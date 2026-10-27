// A reader's vote in the front-page poll. The browser sends a random code it made up; we keep only a
// scrambled version of it, so we can stop double votes without knowing who anyone is.
import crypto from "node:crypto";
import { db } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { id, choice, reader } = await request.json();
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "bad poll" }, { status: 400 });
    if (typeof reader !== "string" || !/^[\w-]{16,64}$/.test(reader)) return Response.json({ error: "bad reader" }, { status: 400 });
    const poll = await db.getPoll(id);
    if (!poll?.is_open) return Response.json({ error: "closed" }, { status: 410 });
    if (!Number.isInteger(choice) || choice < 0 || choice >= poll.options.length) return Response.json({ error: "bad choice" }, { status: 400 });
    const voter = crypto.createHmac("sha256", process.env.SESSION_SECRET || "insightne-poll").update(`${id}:${reader}`).digest("hex");
    const counted = await db.votePoll(id, choice, voter);
    return Response.json({ counted, counts: await db.pollCounts(id, poll.options.length) });
  } catch {
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
