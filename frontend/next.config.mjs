/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Real-backend wiring (integration test): set BACKEND_ORIGIN to proxy
  // /api/* and /ws/* to the Spring backend; unset → MSW mock mode as before.
  async rewrites() {
    const backend = process.env.BACKEND_ORIGIN;
    if (!backend) return [];
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/ws/:path*", destination: `${backend}/ws/:path*` },
    ];
  },
};

export default nextConfig;
