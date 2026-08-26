/** @type {import('next').NextConfig} */
const apiInternal = process.env.INTERNAL_API_URL || "http://localhost:5001";

const nextConfig = {
  output: "standalone",
  env: {
    INTERNAL_API_URL: process.env.INTERNAL_API_URL || "",
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternal}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${apiInternal}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
