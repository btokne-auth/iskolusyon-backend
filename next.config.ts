import type { NextConfig } from "next";

// Oct 1 2026: the tesseract.js / pdf-parse settings that used to be here were
// removed. Document reading runs in the separate iskolusyon-ocr-worker on
// Render, so this app no longer bundles OCR libraries or language files.
const nextConfig: NextConfig = {};

export default nextConfig;
