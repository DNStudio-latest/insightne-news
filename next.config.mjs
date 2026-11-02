/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not tell every visitor which framework the site runs on.
  poweredByHeader: false,
  // Safety headers for every page: the site cannot be shown inside another website's frame (clickjacking), browsers
  // must not guess file types, no camera/microphone/location, forms can only send to this site, no plug-ins.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        ],
      },
    ];
  },
  // The fonts used to draw the WhatsApp news-card pictures.
  outputFileTracingIncludes: { "/card/[slug]": ["./assets/fonts/**"] },
  experimental: {
    // Photos are made smaller in the browser before upload; this allows up to 4 MB just in case.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
