import sharp from 'sharp'

// Moved from app/api/upload/route.js (Oct 2026) so every upload path runs
// the same file checks.

// ---------- Validation limits ----------
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']

// ---------- File content check (Oct 7 2026) ----------
// Manuscript Ch. 3, File Upload Security Testing: "validates file type, file
// size, and file content ... rejection of disguised executable files ... and
// path traversal through manipulated filenames".
// Before this, the type check trusted the type the BROWSER claimed, so a
// program renamed to "birthcert.png" (and sent as image/png) passed. Now the
// first bytes of the file itself must be a real PDF, PNG or JPEG, and must
// match the claimed type. PDFs that carry scripts, launch actions or hidden
// attached files are refused too (a scanned document never needs those).
export const CANONICAL_TYPE = { 'image/jpg': 'image/jpeg' }
export const EXTENSION_FOR = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' }

export function detectFileType(buffer) {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'image/png'
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  return null
}

export const RISKY_PDF_PARTS = /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|XFA)\b/

// Keeps only letters, numbers, dot, dash and underscore, drops any folder
// parts ("../../x" can't climb out of the bucket), shortens long names and
// always ends with the extension of the REAL file type ("cv.pdf.exe" that is
// really a PDF is saved as "cv.pdf_exe.pdf").
export function safeStorageName(originalName, realType) {
  const base = String(originalName || 'document')
    .split(/[\\/]/)
    .pop()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/\.+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\-]+|[_\-]+$/g, '')
    .slice(0, 60) || 'document'
  return `${base}.${EXTENSION_FOR[realType]}`
}

// ---------- Image-quality precheck ----------
// Runs BEFORE OCR, on raw image uploads only (JPG/PNG straight from a phone
// camera — the actual source of blurry/glare/blank photos in practice; PDFs
// either have a real text layer or get rasterized by us at a controlled
// scale, so they don't need this). The goal is prevention, not correction:
// catch an obviously unusable photo immediately and send the applicant back
// to retake it, before spending time on a full OCR pass and before it ever
// becomes a "needs review" record someone has to triage later.
//
// This is a deliberately cheap, coarse check — a handful of pixel statistics
// via sharp, not a real blur/quality model. It's meant to catch the extreme,
// obvious cases (a blank page, a thumbnail-sized image, a photo washed out
// by glare or so out-of-focus it has almost no edges) — not to replace the
// OCR-confidence-based needsReview flag, which still catches everything more
// subtle than this.

// If either dimension is smaller than this, the image is treated as too
// low-resolution to reliably OCR (e.g. a thumbnail, a screenshot of a
// screenshot, or a heavily-downscaled photo).
const MIN_IMAGE_DIMENSION = 300

// Standard deviation of pixel brightness across the whole (grayscale) image.
// A real document photo — even a bad one — has edges: text, borders, a
// visible page against a background. A blank page, a glare-washed photo, or
// an image blurred past readability collapses toward one flat brightness
// value, which shows up as a very low stdev. Real scholarship-document test
// photos in this project ran well above this; deliberately conservative so
// this only catches the extreme cases and doesn't reject legitimate but
// low-contrast documents. Named and isolated the same way as
// a single tunable constant, not a scattered
// magic number, meant to be revisited against a larger sample set.
const MIN_CONTRAST_STDEV = 10

// Oct 21 2026 (panel, Oct 20 defense): the profile picture must be a
// 1x1-style ID photo on a plain white background. Two checks:
//   - shape: a real 2x2 photo, which is square. Width and height must be
//     equal (2% leeway for a slightly uneven crop) and at least 600px,
//     which is 2 inches at the standard 300 dpi print/scan resolution;
//   - background: the top, left and right edges (where the background
//     shows around the head) must be mostly white or very light grey.
// Thresholds are constants so they can be tuned after more tests.
const PROFILE_MIN_RATIO = 0.98
const PROFILE_MAX_RATIO = 1.02
const PROFILE_MIN_PIXELS = 600 // 2 inches x 300 dpi
const WHITE_MIN_BRIGHTNESS = 200 // 0-255, each channel's average
const WHITE_MAX_SATURATION = 40 // max(r,g,b) - min(r,g,b)
const WHITE_MIN_SHARE = 0.6 // 60% of the edge pixels

export async function checkProfilePhoto(buffer, width, height) {
  const ratio = width / height
  if (ratio < PROFILE_MIN_RATIO || ratio > PROFILE_MAX_RATIO) {
    return {
      passed: false,
      reason: 'not_square',
      message: `Your photo is ${width}×${height}px, which is not square. Please upload a 2x2 ID photo (same width and height, e.g. 600×600px), not a stretched, wide or tall picture.`
    }
  }
  if (width < PROFILE_MIN_PIXELS || height < PROFILE_MIN_PIXELS) {
    return {
      passed: false,
      reason: 'too_small_for_2x2',
      message: `Your photo is only ${width}×${height}px. A 2x2 ID photo needs at least ${PROFILE_MIN_PIXELS}×${PROFILE_MIN_PIXELS}px (2 inches at 300 dpi). Please upload a clearer scan or the original file from the photo studio.`
    }
  }

  // Shrink to 100x100 first: fast, and enough to judge the background.
  const size = 100
  const { data } = await sharp(buffer).rotate().resize(size, size, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const band = 12 // edge band, in pixels of the 100x100 copy
  let total = 0
  let white = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inTop = y < band
      const inSide = (x < band || x >= size - band) && y < size * 0.6
      if (!inTop && !inSide) continue
      const i = (y * size + x) * 3
      const r = data[i], g = data[i + 1], b = data[i + 2]
      total++
      if (Math.min(r, g, b) >= WHITE_MIN_BRIGHTNESS && Math.max(r, g, b) - Math.min(r, g, b) <= WHITE_MAX_SATURATION) white++
    }
  }
  if (total === 0 || white / total < WHITE_MIN_SHARE) {
    return {
      passed: false,
      reason: 'not_white_background',
      message: 'The background of your photo does not look plain white. Please upload an ID photo taken against a plain white wall or background, with no frames, borders or other objects behind you.'
    }
  }

  return { passed: true }
}

export async function checkImageQuality(buffer, documentType) {
  const metadata = await sharp(buffer).metadata()
  const { width = 0, height = 0 } = metadata

  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    return {
      passed: false,
      reason: 'too_small',
      message: `This image is only ${width}×${height}px, too low-resolution to read reliably. Please upload a higher-resolution photo or scan (at least ${MIN_IMAGE_DIMENSION}px on each side).`
    }
  }

  // The contrast/readability check below exists to catch document photos
  // (PSA, Form 138, IDs) that are too blank/blurry/glared-over for OCR to
  // read. A profile picture is never OCR'd — checking "text readability"
  // on a person's face photo is testing the wrong thing and rejects
  // perfectly good photos (e.g. a plain, evenly-lit headshot can have low
  // grayscale variance without being blurry at all). Skip it for that type
  // only; the resolution check above still applies to everything.
  if (documentType === 'profilepic') {
    return checkProfilePhoto(buffer, width, height)
  }

  const stats = await sharp(buffer).grayscale().stats()
  const stdev = stats.channels[0]?.stdev ?? 0

  if (stdev < MIN_CONTRAST_STDEV) {
    return {
      passed: false,
      reason: 'low_contrast',
      message: 'This photo appears blank, extremely blurry, or washed out by glare, so no readable detail could be detected. Please retake it on a flat surface, with even lighting and no glare, holding the camera steady.'
    }
  }

  return { passed: true }
}
