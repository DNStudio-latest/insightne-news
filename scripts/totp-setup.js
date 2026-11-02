// Makes the secret for the admin's two-step sign-in. Run once:  npm run totp-setup
// Nothing is saved or sent anywhere: you copy the secret into your authenticator app and into Vercel.
import { newTotpSecret, totpCode } from "../lib/totp.js";

const secret = newTotpSecret();
const spaced = secret.match(/.{1,4}/g).join(" ");
const uri = `otpauth://totp/InsightNE%20News:admin?secret=${secret}&issuer=InsightNE%20News&algorithm=SHA1&digits=6&period=30`;

console.log(`
Two-step sign-in for the InsightNE News admin
=============================================

1. In your authenticator app (Google Authenticator, Microsoft Authenticator or Authy):
   tap  +  →  "Enter a setup key"  →  Account: InsightNE News admin
   Key:  ${spaced}
   Type of key: Time based.

2. The app now shows a 6-digit code that changes every 30 seconds. Check that this matches
   (this computer's clock must be right):  ${totpCode(secret, Math.floor(Date.now() / 30000))}

3. In Vercel > your project > Settings > Environment Variables, add:
   Name:  ADMIN_TOTP_SECRET
   Value: ${secret}
   Then Redeploy. From then on, the admin sign-in asks for your password AND the 6-digit code.

Keep the key somewhere safe (not in a chat or an email): with it, anyone can make the codes.
If you lose your phone, delete ADMIN_TOTP_SECRET in Vercel and redeploy to switch two-step sign-in off.

(For your own records, the same key as a link for apps that can open it: ${uri})
`);
