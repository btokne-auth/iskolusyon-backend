import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js", "pdf-parse"],
  // Sept 25, 2026: Vercel's serverless bundler doesn't include arbitrary
  // project files automatically -- only what it can trace from actual
  // code (imports/requires). tessdata/eng.traineddata.gz is read directly
  // off disk at runtime (not imported), so without this it silently isn't
  // there in production and tesseract.js falls back to re-downloading it
  // from a CDN on every single upload -- the real cause of uploads taking
  // close to Vercel's 60s timeout ceiling. This explicitly tells the
  // bundler to include it for the upload route.
  outputFileTracingIncludes: {
    "/api/upload": ["./tessdata/**"],
  },
};

export default nextConfig;