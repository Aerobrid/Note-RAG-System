/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  middlewareClientMaxBodySize: 200 * 1024 * 1024, // 200MB
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
