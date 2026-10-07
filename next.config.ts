import type { NextConfig } from "next";

// Oct 7 2026 (manuscript Ch. 3: Data Transmission and Encryption Testing,
// Security Misconfiguration Testing). Browser safety rules sent with every
// page and API reply:
//  - Strict-Transport-Security: browsers must always use HTTPS for this site
//    for 2 years, even if someone types http:// or follows an old link.
//  - X-Content-Type-Options: nosniff: a browser never treats an uploaded file
//    as a different type than we say (a "picture" can't run as a script).
//  - X-Frame-Options / frame-ancestors: no other website may show our pages
//    inside a frame (stops "clickjacking", where a fake page sits on top of
//    the real admin buttons).
//  - Referrer-Policy: other sites only see "iskolusyon.dev", never the full
//    page address we came from.
//  - Permissions-Policy: the site never asks for the camera, microphone or
//    location.
//  - Content-Security-Policy (light version): no plugins (<object>), forms
//    may only send to this site, and <base> can't be changed by injected
//    markup. Scripts and styles are not restricted here because Next.js adds
//    its own inline scripts; React already escapes everything we display.
// poweredByHeader: false stops announcing "X-Powered-By: Next.js".
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
];

// Oct 1 2026: the tesseract.js / pdf-parse settings that used to be here were
// removed. Document reading runs in the separate iskolusyon-ocr-worker on
// Render, so this app no longer bundles OCR libraries or language files.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Oct 6 2026: the separate History page was replaced by each section's
  // upload row (file, View popup, earlier uploads, what was read). Old links
  // to /history land on the portal.
  async redirects() {
    return [{ source: "/history", destination: "/portal", permanent: false }];
  },
};

export default nextConfig;
