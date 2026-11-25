// Unlocks a backup file into a readable JSON file (every table with its rows).
//   node scripts/backup-decrypt.js insightne-db-2026-11-30.json.gz.enc restored.json --passphrase-file passphrase.txt
import fs from "node:fs";
import { decryptBackup } from "../lib/backup.js";

const [input, output] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const i = process.argv.indexOf("--passphrase-file");
const passphrase = (i > -1 ? fs.readFileSync(process.argv[i + 1], "utf8") : process.env.BACKUP_PASSPHRASE || "").trim();
if (!input || !output) throw new Error("Usage: node scripts/backup-decrypt.js <backup file> <output.json> --passphrase-file <file>");
const json = decryptBackup(fs.readFileSync(input), passphrase);
fs.writeFileSync(output, json);
const data = JSON.parse(json.toString("utf8"));
console.log(`Unlocked: ${output}. Saved on ${data.exported_at}.`);
for (const [name, n] of Object.entries(data.counts)) console.log(`  ${name}: ${n} rows`);
