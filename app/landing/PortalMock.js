'use client'
import { STEPS, STORY } from './landingData'

// The animated "My Application" preview. It is a picture of the portal with
// sample data (Juan Dela Cruz), not the real portal: nothing here reads or
// writes any applicant's data.
//
// The story is driven by a tick counter (one tick = 250 ms). Each of the six
// steps lasts PHASE_TICKS ticks, then a short "passed" moment, then it loops.
export const PHASE_TICKS = 10
export const STORY_TICKS = PHASE_TICKS * 6 + 8
export const TICK_MS = 250

export function phaseOf(tick) {
  const done = tick >= PHASE_TICKS * 6
  const phase = done ? 5 : Math.floor(tick / PHASE_TICKS)
  return { done, phase, f: done ? 1 : (tick % PHASE_TICKS) / PHASE_TICKS }
}

const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

export function Check({ size = 11, width = 3.2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function Ok({ children }) {
  return (
    <span className="ok">
      <b><Check /></b>
      {children}
    </span>
  )
}

function Screen({ phase, f }) {
  if (phase === 0) {
    const sent = f >= 0.62
    const typed = STORY.email.slice(0, Math.ceil(clamp(f / 0.5) * STORY.email.length))
    return (
      <div className="stage" key="p0" style={{ gap: 12 }}>
        <span className="flabel">EMAIL</span>
        <div className="ffield">{typed}{!sent && <span className="caret" />}</div>
        <div className="prow">
          <span>{sent ? 'Account created' : 'Creating your account…'}</span>
          {sent ? <Ok>Code sent</Ok> : <span className="wait">Typing&hellip;</span>}
        </div>
      </div>
    )
  }
  if (phase === 1) {
    return (
      <div className="stage" key="p1">
        {STORY.profile.map(([label, value], i) => {
          const on = f >= 0.1 + i * 0.2
          return (
            <div className="prow" key={label}>
              <span className="plabel"><small>{label}</small>{on ? <b>{value}</b> : <span className="sk" />}</span>
              {on && <Ok />}
            </div>
          )
        })}
      </div>
    )
  }
  if (phase === 2) {
    return (
      <div className="stage" key="p2">
        {STORY.docs.map((d, i) => {
          const pc = Math.round(clamp((f - i * 0.2) / 0.4) * 100)
          const color = pc >= 100 ? '#1B6B3A' : pc > 0 ? '#003CD0' : '#8C99AE'
          return (
            <div className="prow col" key={d}>
              <span className="between"><span>{d}</span><span style={{ fontWeight: 700, color }}>{pc >= 100 ? 'Uploaded' : pc > 0 ? `Uploading ${pc}%` : 'Waiting'}</span></span>
              <span className="upbar"><i style={{ width: `${pc}%` }} /></span>
            </div>
          )
        })}
      </div>
    )
  }
  if (phase === 3) {
    return (
      <div className="stage" key="p3">
        {STORY.docs.map((d, i) => (
          <div className="prow" key={d}>
            <span>{d}</span>
            {f >= 0.18 + i * 0.18 ? <Ok>Verified</Ok> : <span className="wait">Checking&hellip;</span>}
          </div>
        ))}
        {f >= 0.76 && <span className="badge"><Check size={13} /> Documents complete &middot; Qualified for the exam</span>}
      </div>
    )
  }
  if (phase === 4) {
    const when = f < 0.25 ? 'in 3 days' : f < 0.5 ? 'in 2 days' : f < 0.75 ? 'tomorrow' : 'today'
    return (
      <div className="stage" key="p4" style={{ gap: 10 }}>
        <div className="examcard">
          <small>QUALIFYING EXAM &middot; BATCH 1</small>
          <strong>Your exam is {when}</strong>
          <span>Sample schedule &middot; Room and time in your portal</span>
        </div>
        <div className="prow">
          <span>Exam permit (issued onsite)</span>
          {f >= 0.75 ? <Ok>Issued</Ok> : <span className="wait">Pending</span>}
        </div>
      </div>
    )
  }
  return (
    <div className="stage passed" key="p5">
      <span className="bigok"><Check size={30} width={3} /></span>
      <strong>You passed!</strong>
      <span>Proceed with your medical exam and official enrollment. Welcome, CCC scholar.</span>
    </div>
  )
}

export default function PortalMock({ tick, tilt = false }) {
  const { done, phase, f } = phaseOf(tick)
  const [pill, pillBg, pillFg] = STORY.pills[phase]
  return (
    <div className={`mock${tilt ? ' tilt' : ''}`} aria-hidden="true">
      <div className="mbar">
        <i style={{ background: '#E3A6A0' }} /><i style={{ background: '#E8CF8E' }} /><i style={{ background: '#A9D3B6' }} />
        <span className="murl">iskolusyon.dev/portal</span>
        <span className="mlive"><i />LIVE PREVIEW</span>
      </div>
      <div className="mbody">
        <div className="mhead">
          <span className="mwho">
            <span className="avatar">JD</span>
            <span>
              <span className="mtitle">My Application</span>
              <span className="mstage">Step {phase + 1} of 6 &middot; {STEPS[phase].title}</span>
            </span>
          </span>
          <span className="mpill" style={{ background: pillBg, color: pillFg }}>{pill}</span>
        </div>
        <div className="msegs">
          {STEPS.map((s, i) => {
            const isDone = done || i < phase
            return (
              <span className="pseg" key={s.title}>
                <i style={{ width: `${isDone ? 100 : i === phase ? Math.round(f * 100) : 0}%`, background: isDone ? '#1B6B3A' : '#003CD0' }} />
              </span>
            )
          })}
        </div>
        <div className="mscreen"><Screen phase={phase} f={f} /></div>
      </div>
    </div>
  )
}
