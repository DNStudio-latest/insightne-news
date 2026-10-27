// Makes the two secret keys for phone alerts and saves them in .env.local (never shown on screen).
// Run once: npm run alert-keys   Then copy the two lines into Vercel → Settings → Environment Variables.
import fs from "node:fs";
import webpush from "web-push";

const file = ".env.local";
const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
if (/^VAPID_PRIVATE_KEY=./m.test(current)) {
  console.log("Alert keys already exist in .env.local — nothing changed.");
} else {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  fs.appendFileSync(file, `${current.endsWith("\n") || !current ? "" : "\n"}VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`);
  console.log("Done. Two new lines (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY) were added to .env.local.");
}
