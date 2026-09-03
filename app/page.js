'use client'
import { useState, useEffect, useRef } from 'react'

// ---------- Small building blocks ----------

function IconUpload(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  )
}
function IconFile(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}
function IconX(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function IconExternal(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
  )
}
function IconEye(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconEyeOff(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.36 5.11A10.6 10.6 0 0112 5c6 0 9.5 7 9.5 7a13.6 13.6 0 01-3.13 3.94M6.6 6.6C4.16 8.2 2.5 10.5 2.5 12c0 0 3.5 7 9.5 7 1.13 0 2.19-.19 3.17-.53" />
    </svg>
  )
}
function IconCopy(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1" />
    </svg>
  )
}
function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
function IconClock(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// Password-style hash field: masked by default, toggle to reveal, click to copy.
function HashField({ hash, dim = false }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const masked = '•'.repeat(28)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      // clipboard unavailable — silently ignore
    }
  }

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border ${dim ? 'border-slate-800/70 bg-slate-950/40' : 'border-slate-800 bg-slate-950'} pl-3 pr-1.5 py-1.5`}>
      <span className={`flex-1 min-w-0 font-mono text-[11px] tracking-tight ${dim ? 'text-slate-500' : 'text-blue-300/90'} ${revealed ? 'truncate' : ''}`}>
        {revealed ? hash : masked}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="shrink-0 p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        aria-label={revealed ? 'Hide hash' : 'Reveal hash'}
        title={revealed ? 'Hide hash' : 'Reveal hash'}
      >
        {revealed ? <IconEyeOff className="w-3.5 h-3.5" /> : <IconEye className="w-3.5 h-3.5" />}
      </button>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        aria-label="Copy hash"
        title="Copy hash"
      >
        {copied ? <IconCheck className="w-3.5 h-3.5 text-emerald-400" /> : <IconCopy className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}

const getCleanFileName = (path) => {
  if (!path) return 'Unknown File'
  const parts = path.split('-')
  return parts.length > 1 ? parts.slice(1).join('-') : path
}

// ---------- Page ----------

export default function Home() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState(null)
  const [docHistory, setDocHistory] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const panelRef = useRef(null)

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/upload')
      const data = await res.json()
      if (data.success) {
        setDocHistory(data.documents)
      }
    } catch (error) {
      console.error('Failed to fetch history:', error)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [])

  // Close the history drawer on outside click / Escape
  useEffect(() => {
    if (!historyOpen) return
    const onKey = (e) => e.key === 'Escape' && setHistoryOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyOpen])

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true)
    else if (e.type === 'dragleave') setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

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
        setStatus('Document uploaded and verified successfully.')
        setDetails(data)
        fetchHistory()
        setFile(null)
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
    <main className="relative min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Ambient background */}
      <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full -z-10 pointer-events-none" />

      {/* Top bar */}
      <div className="w-full max-w-xl mx-auto px-4 pt-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            Iskolusyon
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Secure scholarship document verification & storage</p>
        </div>

        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="relative flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors text-xs font-semibold"
        >
          <IconClock className="w-4 h-4" />
          History
          {docHistory.length > 0 && (
            <span className="ml-0.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {docHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* Upload card */}
      <div className="w-full max-w-xl mx-auto px-4 py-8">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-8 sm:p-10 space-y-7">
          <form onSubmit={handleUpload} className="space-y-6">
            {!file ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-4
                  ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 bg-slate-950/50 hover:border-slate-500 hover:bg-slate-800/50'}`}
              >
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shadow-inner mb-2">
                  <IconUpload className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-200">Click to upload or drag and drop</p>
                  <p className="text-sm text-slate-500 mt-1">Supports PDF, PNG, and JPG formats up to 10MB</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-5 bg-blue-950/30 border border-blue-900/50 rounded-2xl">
                <div className="flex items-center space-x-4 overflow-hidden">
                  <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-400 shrink-0">
                    <IconFile className="w-6 h-6" />
                  </div>
                  <div className="truncate pr-4">
                    <p className="text-sm font-semibold text-slate-200 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
                  aria-label="Remove file"
                >
                  <IconX className="w-5 h-5" />
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file}
              className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 text-sm flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Securing & uploading...</span>
                </>
              ) : (
                <span>Upload & verify document</span>
              )}
            </button>
          </form>

          {status && (
            <div className={`p-4 rounded-xl text-sm font-medium flex items-center space-x-3 ${details ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300' : 'bg-slate-800/50 border border-slate-700 text-slate-300'}`}>
              {details && <IconCheck className="w-5 h-5 text-emerald-400 shrink-0" />}
              <span>{status}</span>
            </div>
          )}

          {details && (
            <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-inner">
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Storage path</span>
                <span className="text-slate-300 font-mono text-xs bg-slate-900/80 p-3 rounded-lg block break-all border border-slate-800/50">
                  {details.filePath}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">SHA-256 integrity hash</span>
                <HashField hash={details.sha256Hash} />
              </div>

              <a
                href={details.publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors space-x-2 text-sm"
              >
                <span>View uploaded document</span>
                <IconExternal className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* History drawer — tucked away, opened deliberately */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setHistoryOpen(false)}
          />
          <div
            ref={panelRef}
            className="relative w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col animate-[slideIn_0.2s_ease-out]"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800/80">
              <div>
                <h3 className="text-base font-bold text-white">Recent uploads</h3>
                <p className="text-xs text-slate-500 mt-0.5">{docHistory.length} document{docHistory.length === 1 ? '' : 's'} on record</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                aria-label="Close history"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {docHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-60 py-16">
                  <IconFile className="w-12 h-12 text-slate-600 mb-4" />
                  <p className="text-sm text-slate-400">No documents uploaded yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {docHistory.map((doc, index) => (
                    <div key={index} className="p-4 bg-slate-950/40 border border-slate-800/60 rounded-xl space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-slate-800/80 flex items-center justify-center shrink-0">
                            <IconFile className="w-4.5 h-4.5 text-slate-400" />
                          </div>
                          <p className="text-sm text-slate-200 font-medium truncate" title={doc.file_path}>
                            {getCleanFileName(doc.file_path)}
                          </p>
                        </div>
                        <a
                          href={doc.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 hover:text-blue-300 transition-colors shrink-0"
                          title="View document"
                          aria-label="View document"
                        >
                          <IconExternal className="w-4 h-4" />
                        </a>
                      </div>
                      <HashField hash={doc.sha256_hash} dim />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </main>
  )
}