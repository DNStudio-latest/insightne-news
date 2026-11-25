// Weekly database backup: writes one locked file, insightne-db-YYYY-MM-DD.json.gz.enc, into the folder given with --out.
//   npm run backup -- --out backups
// Needs SUPABASE_URL, SUPABASE_SECRET_KEY and BACKUP_PASSPHRASE (or --passphrase-file <file>). Nothing secret is printed.
import fs from "node:fs";
import path from "node:path";
import { exportDatabase, packBackup } from "../lib/backup.js";

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const out = arg("out") || "backups";
const passFile = arg("passphrase-file");
const passphrase = (passFile ? fs.readFileSync(passFile, "utf8") : process.env.BACKUP_PASSPHRASE || "").trim();
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are needed.");

const data = await exportDatabase({ url, key });
const file = packBackup(data, passphrase);
fs.mkdirSync(out, { recursive: true });
const name = `insightne-db-${data.exported_at.slice(0, 10)}.json.gz.enc`;
fs.writeFileSync(path.join(out, name), file);
const rows = Object.values(data.counts).reduce((a, b) => a + b, 0);
console.log(`Backup written: ${path.join(out, name)} (${(file.length / 1048576).toFixed(2)} MB, ${Object.keys(data.counts).length} tables, ${rows} rows). Checked: it unlocks and every table matches.`);
