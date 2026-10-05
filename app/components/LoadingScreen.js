// Oct 5 2026: the branded loading screen (CCC logo, a moving bar and
// "Loading..."). Used by app/loading.js while a page is on its way, and by
// the admin and applicant pages while they check who is signed in. Inside a
// page, panels use the skeletons in components/Skeleton.js instead.
export default function LoadingScreen({ label = 'Loading...', inline = false }) {
  return (
    <div className={`sys-loading${inline ? ' inline' : ''}`} role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/LOGO_CCC.png" alt="" />
      <div className="sys-bar" aria-hidden="true">
        <span />
      </div>
      <span className="sys-loading-text">{label}</span>
    </div>
  )
}
