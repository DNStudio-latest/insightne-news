import { login } from "../actions.js";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function LoginPage({ searchParams }) {
  const { wrong } = await searchParams;
  return (
    <div className="wrap">
      <form action={login} className="login">
        <h1>Approval page</h1>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
        {wrong && <p className="error">That password is not right. Please try again.</p>}
        <button className="btn btn-approve" type="submit">Sign in</button>
      </form>
    </div>
  );
}
