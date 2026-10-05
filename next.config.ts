import type { NextConfig } from "next";

// Oct 1 2026: the tesseract.js / pdf-parse settings that used to be here were
// removed. Document reading runs in the separate iskolusyon-ocr-worker on
// Render, so this app no longer bundles OCR libraries or language files.
const nextConfig: NextConfig = {
  // Oct 6 2026: the separate History page was replaced by each section's
  // upload row (file, View popup, earlier uploads, what was read). Old links
  // to /history land on the portal.
  async redirects() {
    return [{ source: "/history", destination: "/portal", permanent: false }];
  },
};

export default nextConfig;
