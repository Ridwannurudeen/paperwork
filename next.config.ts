import type { NextConfig } from "next";
import path from "node:path";

const securityHeaders = [
  // No clickjacking. The product is single-purpose; no legitimate iframe use.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop browsers from sniffing content type away from what we send.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit the referer leak when the user clicks model-supplied URLs.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Only allow microphone (used by VoiceInputButton) on this origin.
  // Geolocation, camera, payment, etc. are not used and are blocked.
  {
    key: "Permissions-Policy",
    value:
      "microphone=(self), camera=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()",
  },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        // Apply to every route. Next.js adds its own framework headers on
        // top — these stack rather than override.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
