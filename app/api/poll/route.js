// A reader's vote in the front-page poll. The browser sends a random code it made up; we keep only a
// scrambled version of it, so we can stop double votes without knowing who anyone is.
import crypto from "node:crypto";
import { db } from "../../../lib/db.js";
import { clientIp, rateLimit, tooMany } from "../../../lib/rate-limit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    // A phone network can share one address between many readers, so the limit is generous.
    if (!(await rateLimit({ key: `poll:${clientIp(request.headers)}`, limit: 40, windowSec: 3600 })).ok) return tooMany(3600);
    const { id, choice, reader } = await request.json();
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "bad poll" }, { status: 400 });
    if (typeof reader !== "string" || !/^[\w-]{16,64}$/.test(reader)) return Response.json({ error: "bad reader" }, { status: 400 });
    const poll = await db.getPoll(id);
    if (!poll?.is_open) return Response.json({ error: "closed" }, { status: 410 });
    if (!Number.isInteger(choice) || choice < 0 || choice >= poll.options.length) return Response.json({ error: "bad choice" }, { status: 400 });
    if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET is not set");
    const voter = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(`${id}:${reader}`).digest("hex");
    const counted = await db.votePoll(id, choice, voter);
    return Response.json({ counted, counts: await db.pollCounts(id, poll.options.length) });
  } catch {
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
