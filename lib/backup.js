// Backup of the website's database: every table is read through the Supabase API, packed into one compressed file and
// locked with a passphrase (AES-256-GCM), so a copy that lands in a public place (a GitHub download) or in Google Drive
// is unreadable without the passphrase. Photos in Supabase Storage are NOT part of this file.
import crypto from "node:crypto";
import zlib from "node:zlib";

const MAGIC = Buffer.from("INEBK1"); // file type + version
const PAGE = 1000; // rows per request (the API's default limit)

// ---- locking and unlocking -------------------------------------------------------------------------------------------

export function encryptBackup(plain, passphrase) {
  if (!passphrase || String(passphrase).length < 16) throw new Error("The backup passphrase is missing or too short (use at least 16 characters).");
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(String(passphrase), salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(zlib.gzipSync(plain)), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

// Returns the original bytes, or throws when the passphrase is wrong or the file is damaged.
export function decryptBackup(file, passphrase) {
  if (file.length < MAGIC.length + 44 || !file.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("This is not an InsightNE backup file.");
  let at = MAGIC.length;
  const salt = file.subarray(at, (at += 16));
  const iv = file.subarray(at, (at += 12));
  const tag = file.subarray(at, (at += 16));
  const key = crypto.scryptSync(String(passphrase), salt, 32);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  try {
    return zlib.gunzipSync(Buffer.concat([decipher.update(file.subarray(at)), decipher.final()]));
  } catch {
    throw new Error("Wrong passphrase, or the backup file is damaged.");
  }
}

// ---- reading the database --------------------------------------------------------------------------------------------

// Every table of the public schema, read page by page. Returns { exported_at, tables: { name: [rows] }, counts: { name: n } }.
export async function exportDatabase({ url, key, fetchFn = fetch, now = new Date() }) {
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const spec = await fetchFn(`${url}/rest/v1/`, { headers });
  if (!spec.ok) throw new Error(`The database did not answer (${spec.status}).`);
  const defs = (await spec.json()).definitions || {};
  const tables = {};
  const counts = {};
  for (const [name, def] of Object.entries(defs)) {
    // Rows are read in a fixed order (the primary key) so no row is skipped or repeated between pages.
    const pk = Object.entries(def.properties || {})
      .filter(([, p]) => /Primary Key/.test(p.description || ""))
      .map(([col]) => col);
    const order = pk.length ? `&order=${pk.join(",")}` : "";
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const res = await fetchFn(`${url}/rest/v1/${encodeURIComponent(name)}?select=*${order}`, { headers: { ...headers, Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" } });
      if (!res.ok) throw new Error(`Could not read table ${name} (${res.status}).`);
      const page = await res.json();
      rows.push(...page);
      if (page.length < PAGE) break;
    }
    tables[name] = rows;
    counts[name] = rows.length;
  }
  return { exported_at: now.toISOString(), tables, counts };
}

// Packs a database export into the locked file. Unlocks it again to be sure it can be read back, and checks the row counts.
export function packBackup(data, passphrase) {
  const file = encryptBackup(Buffer.from(JSON.stringify(data)), passphrase);
  const back = JSON.parse(decryptBackup(file, passphrase).toString("utf8"));
  for (const [name, n] of Object.entries(data.counts)) {
    if ((back.tables[name] || []).length !== n) throw new Error(`Backup check failed: table ${name} did not come back with ${n} rows.`);
  }
  return file;
}
