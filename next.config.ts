import type { NextConfig } from "next";

// Базовые security-заголовки. Минимальный набор, не ломающий Pusher и Anthropic.
// почему не CSP: Pusher, react-day-picker, Anthropic SDK имеют inline-скрипты
// на этапе hydration и runtime; писать CSP для Next App Router без поломок —
// отдельная задача, оставим на будущее.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Производительность: компилируем без source maps в проде, чтобы bundle меньше
  productionBrowserSourceMaps: false,
};

export default nextConfig;
