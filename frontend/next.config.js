/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Using the non-deprecated key for this Next.js version
    proxyClientMaxBodySize: 200 * 1024 * 1024, // 200MB
  },
  async rewrites() {
    // In Docker -> use the service name 'backend'
    // Fall back to localhost only if explicitly told or if service name fails
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://backend:8000";
    
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
