/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Photos are made smaller in the browser before upload; this allows up to 4 MB just in case.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
