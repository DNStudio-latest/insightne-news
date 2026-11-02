import { login } from "../actions.js";
import { totpEnabled } from "../../../lib/totp.js";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }) {
  const { wrong, limited } = await searchParams;
  return (
    <div className="wrap">
      <form action={login} className="login">
        <h1>Approval page</h1>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        {totpEnabled() && (
          <>
            <label htmlFor="code">Security code <span className="hint">(admin only: the 6 digits in your authenticator app)</span></label>
            <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} pattern="[0-9 ]*" />
          </>
        )}
        {wrong && <p className="error">That password{totpEnabled() ? " or code" : ""} is not right. Please try again.</p>}
        {limited && <p className="error">Too many tries. Please wait 15 minutes and try again.</p>}
        <button className="btn btn-approve" type="submit">Sign in</button>
      </form>
    </div>
  );
}
