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
    // Sept 26, 2026: same class of problem as the tessdata fix above, found
    // after switching to the legacy Tesseract engine (OEM.TESSERACT_ONLY)
    // to cut OCR compute cost -- production immediately crashed with
    // "ENOENT: no such file or directory, open
    // '.../tesseract.js-core/tesseract-core-relaxedsimd.wasm'". The
    // tesseract.js-core package's WASM engine files are read off disk at
    // runtime (not required/imported directly, so the bundler's static
    // trace never picks them up) -- same blind spot as eng.traineddata.gz.
    // Likely the same root cause behind the *original* OCR timeout too:
    // the default (LSTM) engine's WASM file probably wasn't reliably
    // bundled either, and whatever fallback path that failure took (a
    // slow/blocked network fetch, silently retried) is a better fit for
    // "quietly eats the full 60s" than "recognize() is just this slow".
    // Includes every core variant (~18MB total) rather than guessing which
    // one the runtime's SIMD-support detection will pick.
    "/api/upload": ["./tessdata/**", "./node_modules/tesseract.js-core/**"],
  },
};

export default nextConfig;