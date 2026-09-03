import sharp from 'sharp'
import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import crypto from 'crypto'
import { PDFParse } from 'pdf-parse'
import { createWorker } from 'tesseract.js'

// ---------- Validation limits ----------
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']

// Below this many characters of embedded PDF text, we assume the PDF has no
// real text layer (i.e. it's a scanned/photographed document) and fall back
// to rasterizing pages + running OCR on them instead.
const MIN_DIGITAL_TEXT_LENGTH = 40

// ---------- OCR / text extraction helpers ----------

async function preprocessForOCR(buffer) {
  return sharp(buffer)
    .resize({ width: 2000, withoutEnlargement: false })  // upscale small/low-res photos
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer()
    // no .threshold() — let Tesseract binarize internally, it's better at it than a flat cutoff
}
// Runs Tesseract OCR on a single image buffer using an already-started worker.

async function ocrImageBuffer(worker, buffer) {
  const cleaned = await preprocessForOCR(buffer)
  console.log('Preprocessed buffer size:', cleaned.length, 'original:', buffer.length)  // TEMP
  const { data: { text } } = await worker.recognize(cleaned)
  return text
}

// Decides how to pull text out of the uploaded file:
// - images -> straight to Tesseract OCR
// - PDFs   -> try the embedded text layer first (fast, exact); if the PDF
//             turns out to be a scan with no real text layer, rasterize each
//             page to an image and OCR those instead.
async function extractText(buffer, mimeType) {
  if (mimeType.startsWith('image/')) {
    const worker = await createWorker('eng')
    try {
      const text = await ocrImageBuffer(worker, buffer)
      return { text: text.trim(), method: 'ocr-image' }
    } finally {
      await worker.terminate()
    }
  }

  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: buffer })
    try {
      const result = await parser.getText()
      const digitalText = (result.text || '').trim()

      if (digitalText.length >= MIN_DIGITAL_TEXT_LENGTH) {
        return { text: digitalText, method: 'pdf-embedded-text' }
      }

      // No usable text layer found — treat as a scanned PDF and OCR each page.
      const screenshot = await parser.getScreenshot({ scale: 2 })
      const worker = await createWorker('eng')
      try {
        let ocrText = ''
        for (const page of screenshot.pages) {
          ocrText += (await ocrImageBuffer(worker, page.data)) + '\n'
        }
        return { text: ocrText.trim(), method: 'ocr-scanned-pdf' }
      } finally {
        await worker.terminate()
      }
    } finally {
      await parser.destroy()
    }
  }

  return { text: '', method: 'unsupported' }
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Server-side validation: never trust the client's file picker alone
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF, JPG, or PNG.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File is too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Convert file into a Buffer for processing
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate SHA-256 hash for document integrity verification
    const hashSum = crypto.createHash('sha256')
    hashSum.update(buffer)
    const fileHash = hashSum.digest('hex')

    // Run text detection/OCR before upload so extraction failures don't
    // corrupt a half-finished storage/DB write. A failure here still lets
    // the document upload succeed — it just comes back with empty text.
    let extractedText = ''
    let extractionMethod = 'none'
    try {
      const result = await extractText(buffer, file.type)
      extractedText = result.text
      extractionMethod = result.method
    } catch (ocrError) {
      console.error('Text extraction failed:', ocrError)
    }

    // Define unique file name for the storage bucket
    const safeName = file.name
    .normalize('NFKD')                 // splits accented chars from their marks
    .replace(/[\u0300-\u036f]/g, '')   // strips the accent marks
    .replace(/[^\w.\-]+/g, '_')        // anything not a letter/number/./- becomes _
    .replace(/_+/g, '_')               // collapse repeated underscores
    const fileName = `${Date.now()}-${safeName}`

    // Upload directly to your Supabase bucket using the service role client
    const { data, error } = await supabase.storage
      .from('scholarship-documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Save the file path, SHA-256 hash, and extracted text to your PostgreSQL table
    const { error: dbError } = await supabase
      .from('documents')
      .insert([
        { 
          file_path: data.path, 
          sha256_hash: fileHash,
          extracted_text: extractedText
        }
      ])

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // Generate a secure signed URL valid for 1 hour (3600 seconds)
    const { data: signedUrlData, error: signError } = await supabase.storage
      .from('scholarship-documents')
      .createSignedUrl(fileName, 3600)

    if (signError) {
      return NextResponse.json({ error: signError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      filePath: data.path,
      publicUrl: signedUrlData.signedUrl, 
      sha256Hash: fileHash,
      extractedText,
      extractionMethod
    })

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    // 1. Fetch all records from your documents table
    const { data: docs, error: dbError } = await supabase
      .from('documents')
      .select('*') // grabs id, file_path, sha256_hash, and extracted_text

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 })
    }

    // 2. Loop through the records and generate fresh signed URLs for each
    const docsWithUrls = await Promise.all(docs.map(async (doc) => {
      const { data } = await supabase.storage
        .from('scholarship-documents')
        .createSignedUrl(doc.file_path, 3600)

      return {
        ...doc,
        publicUrl: data?.signedUrl
      }
    }))

    return NextResponse.json({ success: true, documents: docsWithUrls })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}