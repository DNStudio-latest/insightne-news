/** @type {import('next').NextConfig} */
const nextConfig = {
  // The fonts used to draw the WhatsApp news-card pictures.
  outputFileTracingIncludes: { "/card/[slug]": ["./assets/fonts/**"] },
  experimental: {
    // Photos are made smaller in the browser before upload; this allows up to 4 MB just in case.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
