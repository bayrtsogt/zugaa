import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@zugaa/ui", "@zugaa/auth", "@zugaa/wallet", "@zugaa/db"],
  poweredByHeader: false,
  // Put <meta> tags in <head> for every client (not streamed into <body>);
  // story metadata comes from the same cached query as the page.
  htmlLimitedBots: /.*/,
  images: { unoptimized: true },
  // Admin bulk story import posts whole JSON files through a server action.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

// Enables Cloudflare bindings in `next dev` (no-op otherwise).
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev()).catch(() => {});
}
