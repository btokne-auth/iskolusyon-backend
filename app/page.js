'use client'
import { useState } from 'react'

export default function Home() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState(null)

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setStatus('Processing secure upload and generating SHA-256 hash...')
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        setStatus('Document uploaded and verified successfully!')
        setDetails(data)
      } else {
        setStatus(`Error: ${data.error}`)
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">Iskolusyon</h1>
          <p className="text-sm text-slate-400">Secure Scholarship Document Verification & Storage</p>
        </div>

        <form onSubmit={handleUpload} className="space-y-5">
          <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 transition-colors rounded-xl p-6 text-center cursor-pointer bg-slate-950/40 relative group">
            <input 
              type="file" 
              onChange={(e) => setFile(e.target.files[0])}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="space-y-2 pointer-events-none">
              <div className="mx-auto w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                📄
              </div>
              <p className="text-sm font-medium text-slate-200">
                {file ? file.name : "Click to select document or drop file here"}
              </p>
              <p className="text-xs text-slate-500">Supports PDF, PNG, and JPG formats</p>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || !file}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 font-semibold rounded-xl transition shadow-lg shadow-blue-600/20 text-sm flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                <span>Hashing & Uploading...</span>
              </>
            ) : (
              <span>Upload & Verify Document</span>
            )}
          </button>
        </form>

        {status && (
          <div className={`p-4 rounded-xl text-sm font-medium ${details ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300' : 'bg-slate-800/50 text-slate-300'}`}>
            {status}
          </div>
        )}

        {details && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 text-xs">
            <div>
              <span className="text-slate-400 font-semibold block mb-1">Storage Path:</span>
              <span className="text-slate-200 font-mono bg-slate-900 p-2.5 rounded-lg block break-all">{details.filePath}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block mb-1">SHA-256 Integrity Hash:</span>
              <span className="text-blue-300 font-mono bg-slate-900 p-2.5 rounded-lg block break-all">{details.sha256Hash}</span>
            </div>
            <div className="pt-2">
              <a 
                href={details.publicUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="inline-flex items-center justify-center w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition"
              >
                View Document ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}