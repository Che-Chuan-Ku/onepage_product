/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Render single-container: nginx reverse-proxies /api and /ws to the backend,
  // so Next runs as a standalone server (Dockerfile copies .next/standalone).
  output: "standalone",
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
