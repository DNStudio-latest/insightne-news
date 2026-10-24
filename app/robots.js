// Tells search engines not to list the private approval page.
export default function robots() {
  return { rules: { userAgent: "*", allow: "/", disallow: "/admin" } };
}
