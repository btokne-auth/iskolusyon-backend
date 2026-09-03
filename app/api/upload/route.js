import { NextResponse } from 'next/server'
import { supabase } from '@/app/supabaseClient'
import crypto from 'crypto'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Convert file into a Buffer for processing
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate SHA-256 hash for document integrity verification
    const hashSum = crypto.createHash('sha256')
    hashSum.update(buffer)
    const fileHash = hashSum.digest('hex')

    // Define unique file name for the storage bucket
    const fileName = `${Date.now()}-${file.name}`

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

    // Save the file path and SHA-256 hash to your PostgreSQL table
    const { error: dbError } = await supabase
      .from('documents')
      .insert([
        { 
          file_path: data.path, 
          sha256_hash: fileHash 
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
      sha256Hash: fileHash
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
      .select('*') // grabs id, file_path, and sha256_hash

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