// Oct 5 2026: skeleton placeholders. While a panel's data is loading, it
// shows grey blocks shaped like the content that's coming (with a soft
// shimmer) instead of a "Loading..." line, so the page doesn't jump when the
// data arrives and nothing misleading (like a count of 0) shows in the
// meantime. Labels and buttons that don't depend on the data still render
// normally around these. Styles are the .sk* classes in app/globals.css;
// the shimmer turns off for people who have reduced motion switched on.
//
// Each group is a role="status" region with a hidden "Loading ..." label,
// so screen readers still announce that something is loading.

const ROW_WIDTHS = [
  [150, 96, 170, 74, 80],
  [128, 90, 200, 92, 70],
  [170, 96, 150, 74, 86],
  [140, 90, 190, 84, 76],
  [116, 96, 170, 92, 80],
  [158, 90, 160, 74, 72],
]
const LINE_WIDTHS = ['92%', '78%', '64%', '86%', '70%', '58%']

function px(v) {
  return typeof v === 'number' ? `${v}px` : v
}

export function Skeleton({ width = '100%', height = 12, radius = 6, dark = false, style, className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={`sk${dark ? ' on-dark' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: px(width), height: px(height), borderRadius: px(radius), ...style }}
    />
  )
}

// A loading region with a hidden label for screen readers.
export function SkeletonRegion({ label = 'Loading...', children, style, className }) {
  return (
    <div role="status" aria-live="polite" style={style} className={className}>
      <span className="sk-sr">{label}</span>
      {children}
    </div>
  )
}

// Table-like rows: avatar, two-line name, a detail, a status pill, a date.
export function SkeletonRows({ rows = 6, label = 'Loading...', avatar = true }) {
  return (
    <SkeletonRegion label={label}>
      {Array.from({ length: rows }, (_, i) => {
        const w = ROW_WIDTHS[i % ROW_WIDTHS.length]
        return (
          <div className="sk-row" key={i} style={avatar ? undefined : { gridTemplateColumns: 'minmax(0,2fr) minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)' }}>
            {avatar && <Skeleton width={36} height={36} radius={18} />}
            <span className="sk-stack">
              <Skeleton width={w[0]} height={12} />
              <Skeleton width={w[1]} height={10} />
            </span>
            <Skeleton width={w[2]} height={11} />
            <Skeleton width={w[3]} height={22} radius={20} />
            <Skeleton width={w[4]} height={11} />
          </div>
        )
      })}
    </SkeletonRegion>
  )
}

// Card-like list items: icon, title, a few chips, two lines of text, meta.
export function SkeletonList({ items = 4, label = 'Loading...', chips = true }) {
  return (
    <SkeletonRegion label={label}>
      {Array.from({ length: items }, (_, i) => (
        <div className="sk-item" key={i}>
          <Skeleton width={36} height={36} radius={10} />
          <span className="sk-stack" style={{ gap: 9 }}>
            <Skeleton width={[260, 200, 300, 230][i % 4]} height={13} />
            {chips && (
              <span className="sk-chips">
                <Skeleton width={80} height={18} radius={20} />
                <Skeleton width={110} height={18} radius={20} />
                <Skeleton width={70} height={18} radius={20} />
              </span>
            )}
            <Skeleton width="100%" height={10} />
            <Skeleton width={LINE_WIDTHS[i % LINE_WIDTHS.length]} height={10} />
            <Skeleton width={150} height={9} />
          </span>
        </div>
      ))}
    </SkeletonRegion>
  )
}

// Labelled form fields (settings cards).
export function SkeletonForm({ fields = 3, label = 'Loading...' }) {
  return (
    <SkeletonRegion label={label}>
      {Array.from({ length: fields }, (_, i) => (
        <div className="sk-field" key={i}>
          <Skeleton width={[90, 120, 70, 110][i % 4]} height={10} />
          <Skeleton width="100%" height={40} radius={8} />
        </div>
      ))}
    </SkeletonRegion>
  )
}

// A few lines of text.
export function SkeletonText({ lines = 3, label = 'Loading...' }) {
  return (
    <SkeletonRegion label={label} className="sk-stack" style={{ gap: 10 }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={LINE_WIDTHS[i % LINE_WIDTHS.length]} height={11} />
      ))}
    </SkeletonRegion>
  )
}

// A grid of summary cards (label, big number, note).
export function SkeletonStatGrid({ cards = 4, label = 'Loading...', columns, style }) {
  return (
    <SkeletonRegion
      label={label}
      style={{ display: 'grid', gridTemplateColumns: `repeat(${columns || cards}, minmax(0, 1fr))`, gap: 16, marginBottom: 18, ...style }}
      className="sk-stat-grid"
    >
      {Array.from({ length: cards }, (_, i) => (
        <div
          key={i}
          className="sk-stack"
          style={{ gap: 12, padding: '18px 20px', background: '#fff', border: '1px solid var(--ccc-border)', borderRadius: 12 }}
        >
          <Skeleton width={[110, 90, 120, 80][i % 4]} height={10} />
          <Skeleton width={56} height={28} radius={7} />
          <Skeleton width="85%" height={9} />
        </div>
      ))}
    </SkeletonRegion>
  )
}
