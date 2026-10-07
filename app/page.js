'use client'
import { useEffect, useRef, useState } from 'react'
import './welcome-theme.css'
import './landing/landing.css'
import WelcomeNavbar, { WELCOME_NAV_LINKS as NAV_LINKS } from './components/WelcomeNavbar'
import WelcomeFooter from './components/WelcomeFooter'
import PortalMock, { Check, PHASE_TICKS, STORY_TICKS, TICK_MS, phaseOf } from './landing/PortalMock'
import { CONTACT_OFFICES, FAQ_DATA, PROGRAM_DEPARTMENTS, QUALIFICATIONS, REQ_TABS, STEPS, STEP_GUIDES, STORY } from './landing/landingData'
import { BSED_MIN_SHS_GRADE } from './lib/matching'

// ---------- Public guest welcome page ----------
// Oct 8 2026 redesign. Same sections, wording and links as the Sept 23
// version (which followed Ivy's index.html mockup), restyled and made more
// interactive:
//  - hero with an animated portal preview (sample applicant) and counting stats
//  - How to Apply: six steps with the guide always open next to a small
//    preview of that step
//  - Before You Apply: programs grouped by department, an
//    "Am I eligible?" check and a document checklist (nothing is saved)
//  - FAQ grouped by topic with search highlighting
//  - Contact cards with an open/closed status from each office's own hours
// Log In / Sign Up still route to /login (?mode=signup for Sign Up).

const ICON = {
  arrow: <svg className="ar" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
  left: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>,
  right: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>,
  search: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  clock: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  pin: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>,
  mail: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 6L2 7" /></svg>,
  fb: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
  bulb: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V17h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2z" /></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></svg>,
  megaphone: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>,
  megaphoneBig: <svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>,
  up: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m18 15-6-6-6 6" /></svg>,
}
const STEP_ICONS = [
  <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5M12 3v12" /></>,
  <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></>,
]
function StepIcon({ i, size = 34 }) {
  return <svg className="ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{STEP_ICONS[i]}</svg>
}

// "**bold**" in landingData.js -> <strong>. Plain text otherwise (no HTML).
function Rich({ text }) {
  return text.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}

// A 250 ms clock for the animated previews. `range` makes it loop inside
// [start, end) instead of the whole story.
function useTicker(paused, range) {
  const [tick, setTick] = useState(range ? range[0] : 0)
  const start = range ? range[0] : 0
  const end = range ? range[1] : STORY_TICKS
  useEffect(() => { setTick(start) }, [start])
  useEffect(() => {
    if (paused) return undefined
    const id = setInterval(() => setTick((t) => (t + 1 >= end || t < start ? start : t + 1)), TICK_MS)
    return () => clearInterval(id)
  }, [paused, start, end])
  return tick
}

function SectionHead({ eyebrow, title, lead, center }) {
  return (
    <div className={`shead${center ? ' center' : ''}`}>
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="h2">{title}</h2>
      {lead && <p className="lead">{lead}</p>}
    </div>
  )
}

// ---------- hero ----------
function CountUp({ to, delay, paused }) {
  const [n, setN] = useState(to)
  const [pop, setPop] = useState(false)
  const [reset, setReset] = useState(false)
  useEffect(() => {
    if (paused) return undefined
    let raf = 0
    let t1 = 0
    const run = () => {
      setReset(true)
      setPop(false)
      const t0 = performance.now()
      requestAnimationFrame(() => setReset(false))
      const frame = (now) => {
        const p = Math.min(1, (now - t0) / 1500)
        setN(Math.round((1 - Math.pow(1 - p, 3)) * to))
        if (p < 1) raf = requestAnimationFrame(frame)
        else setPop(true)
      }
      raf = requestAnimationFrame(frame)
    }
    t1 = setTimeout(run, delay)
    const every = setInterval(run, 9000)
    return () => { clearTimeout(t1); clearInterval(every); cancelAnimationFrame(raf) }
  }, [to, delay, paused])
  return (
    <>
      <span className={`num${pop ? ' pop' : ''}`} aria-label={String(to)}>{n}</span>
      <span className={`sbar${reset ? ' reset' : ''}`}><i /></span>
    </>
  )
}

function Hero({ paused, onTogglePause, onHowTo }) {
  const tick = useTicker(paused)
  const { done, phase, f } = phaseOf(tick)
  const shown = done ? 6 : f >= 0.12 ? phase + 1 : phase
  const programCount = PROGRAM_DEPARTMENTS.reduce((n, d) => n + d.programs.length, 0)
  return (
    <section className="hero" id="hero">
      <div className="blob" style={{ width: 520, height: 520, right: -80, top: -160, background: '#BFD0F7', opacity: 0.55, animation: 'lp-drift1 14s ease-in-out infinite' }} />
      <div className="blob" style={{ width: 360, height: 360, right: '30%', top: 240, background: '#F1E2B0', opacity: 0.45, animation: 'lp-drift2 18s ease-in-out infinite' }} />
      <div className="blob" style={{ width: 300, height: 300, left: -120, top: 120, background: '#CDE7D6', opacity: 0.5, animation: 'lp-drift2 16s ease-in-out infinite reverse' }} />
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <span className="eyebrow rise" style={{ color: 'var(--green)', '--d': '.05s' }}>City College of Calamba</span>
          <h1><span className="rise" style={{ '--d': '.15s' }}>Scholarship</span> <span className="rise" style={{ '--d': '.3s' }}><span className="hl">Portal</span></span></h1>
          <p className="hero-sub rise" style={{ '--d': '.45s' }}>Your all-in-one platform providing comprehensive application procedures, guidelines, and real-time notifications for aspiring City College of Calamba scholars.</p>
          <div className="hero-btns rise" style={{ '--d': '.6s' }}>
            <a href="/login?mode=signup" className="btn btn-navy shine">Apply Now {ICON.arrow}</a>
            <a href="#how-to-apply" className="btn btn-light" onClick={(e) => { e.preventDefault(); onHowTo() }}>How to Apply</a>
          </div>
          <div className="stats rise" style={{ '--d': '.75s' }}>
            <div className="stat"><CountUp to={programCount} delay={900} paused={paused} /><span className="slabel">programs offered</span></div>
            <div className="stat"><CountUp to={PROGRAM_DEPARTMENTS.length} delay={1150} paused={paused} /><span className="slabel">departments</span></div>
            <div className="stat"><CountUp to={STEPS.length} delay={1400} paused={paused} /><span className="slabel">steps, all online</span></div>
          </div>
        </div>
        <div className="stage-wrap">
          <div className="mockpos rise" style={{ '--d': '.5s' }}><PortalMock tick={tick} tilt /></div>
          <div className="nstack" aria-hidden="true">
            <span className={`bell${shown && f < 0.5 ? ' ringing' : ''}`}>{ICON.bell}{shown > 0 && <em>{shown}</em>}</span>
            {STORY.emails.slice(0, shown).map(([subject, body], i) => {
              const rank = shown - 1 - i
              return (
                <div className="ncard" key={subject} style={{ transform: `translateY(${-rank * 14}px) scale(${1 - rank * 0.05})`, opacity: rank > 2 ? 0 : 1 - rank * 0.25, zIndex: 10 - rank }}>
                  <span className="nico">{ICON.mail}</span>
                  <span className="nmeta"><b>ISKOLUSYON</b>email &middot; now</span>
                  <span className="nsubj">{subject}</span>
                  <span className="nprev">{body}</span>
                </div>
              )
            })}
          </div>
          <span className="caption">
            Illustration of the portal with sample data.
            <button type="button" className="pausebtn" onClick={onTogglePause}>{paused ? 'Play animation' : 'Pause animation'}</button>
          </span>
        </div>
      </div>
    </section>
  )
}

// ---------- announcements ----------
function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
  } catch {
    return ''
  }
}
function timeAgo(iso) {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const days = Math.floor((Date.now() - t) / 864e5)
  if (days <= 0) return 'Posted today'
  if (days === 1) return 'Posted yesterday'
  if (days < 30) return `Posted ${days} days ago`
  const months = Math.floor(days / 30)
  return `Posted ${months} month${months > 1 ? 's' : ''} ago`
}
function isNew(iso) {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return Number.isFinite(t) && Date.now() - t < 7 * 24 * 3600 * 1000
}
function AnnCard({ item, featured }) {
  const [open, setOpen] = useState(false)
  const text = item.body || item.message || ''
  const long = text.length > (featured ? 260 : 120)
  const date = formatDate(item.created_at)
  if (featured) {
    return (
      <article className={`ann-card featured${open ? ' open' : ''}`}>
        <span className="ann-sheen" aria-hidden="true" />
        <span className="ann-big" aria-hidden="true">{ICON.megaphoneBig}</span>
        <div className="ann-body">
          <div className="ann-top">
            <span className="ann-ico" aria-hidden="true">{ICON.megaphone}</span>
            <span className="ann-meta"><b className="ann-latest">Latest</b>{date && <time dateTime={item.created_at}>{date}</time>}</span>
          </div>
          <h3>{item.title}</h3>
          <p>{text}</p>
          {long && <button type="button" className="ann-more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Show less' : 'Read more'}</button>}
        </div>
        <div className="ann-foot"><span className="avatar" aria-hidden="true">CCC</span><span>City College of Calamba{item.created_at ? ` · ${timeAgo(item.created_at)}` : ''}</span></div>
      </article>
    )
  }
  return (
    <article className={`ann-card small${open ? ' open' : ''}`}>
      <div className="ann-top">
        <span className="ann-ico" aria-hidden="true">{ICON.megaphone}</span>
        <span className="ann-meta">{isNew(item.created_at) && <b className="ann-new">New</b>}{date && <time dateTime={item.created_at}>{date}</time>}</span>
      </div>
      <h3>{item.title}</h3>
      <p>{text}</p>
      {long && <button type="button" className="ann-more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>{open ? 'Show less' : 'Read more'}</button>}
    </article>
  )
}
function Announcements({ items }) {
  const [page, setPage] = useState(0)
  const per = 3
  const list = items.length
    ? items
    : [{ id: 'empty', title: 'No announcements yet', body: 'Official announcements such as qualifications, steps, and exam schedules will appear here once they are posted.' }]
  const pages = Math.max(1, Math.ceil(list.length / per))
  const cur = Math.min(page, pages - 1)
  const slice = list.slice(cur * per, cur * per + per)
  return (
    <section className="annsec" id="announcement">
      <div className="wrap ann">
        <div className="ann-head">
          <div className="shead">
            <span className="eyebrow"><i className="live" aria-hidden="true" />Announcements</span>
            <h2 className="h2">Latest updates for applicants</h2>
          </div>
          {pages > 1 && (
            <div className="ann-nav">
              <span className="ann-dots" aria-hidden="true">{Array.from({ length: pages }, (_, k) => <i key={k} className={k === cur ? 'on' : ''} />)}</span>
              <button type="button" className="arr" aria-label="Previous announcements" onClick={() => setPage((cur - 1 + pages) % pages)}>{ICON.left}</button>
              <button type="button" className="arr" aria-label="Next announcements" onClick={() => setPage((cur + 1) % pages)}>{ICON.right}</button>
            </div>
          )}
        </div>
        <div className={`ann-grid n${slice.length}`} key={cur}>
          <AnnCard item={slice[0]} featured={slice[0].id !== 'empty'} />
          {slice.length > 1 && <div className="ann-side">{slice.slice(1).map((it) => <AnnCard key={it.id} item={it} />)}</div>}
        </div>
        {items.length > 0 && <span className="ann-count">Showing {cur * per + 1}&ndash;{cur * per + slice.length} of {list.length} announcements</span>}
      </div>
    </section>
  )
}

// ---------- how to apply ----------
function HowToApply({ paused }) {
  const [step, setStep] = useState(0)
  const [group, setGroup] = useState(0)
  const [tipOpen, setTipOpen] = useState(false)
  const start = step * PHASE_TICKS
  const end = step === 5 ? STORY_TICKS : (step + 1) * PHASE_TICKS
  const tick = useTicker(paused, [start, end])
  const guide = STEP_GUIDES[step]
  const [celebrate, setCelebrate] = useState(0)
  const pick = (i) => { setStep(i); setGroup(0); setTipOpen(false); if (i === 5) setCelebrate((c) => c + 1) }
  useEffect(() => {
    if (!tipOpen) return undefined
    const close = () => setTipOpen(false)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [tipOpen])
  return (
    <section className="journey" id="how-to-apply">
      <div className="wrap journey-in">
        <div className="shead center">
          <span className="eyebrow" style={{ color: '#FFD400' }}>How to Apply</span>
          <h2 className="h2" style={{ color: '#fff', fontSize: 40 }}>Six steps, all in one portal</h2>
          <p className="lead" style={{ color: 'rgba(255,255,255,.75)' }}>Click a step to see what to do and what your screen will look like.</p>
        </div>
        <div className="track" style={{ '--p': step / 5 }}>
          <span className="rail" /><span className="beam" />
          {step === 5 && <Celebrate key={`c${celebrate}`} />}
          {step === 5 && <Rain key={`r${celebrate}`} />}
          {STEPS.map((s, i) => {
            const isDone = i < step
            const isNow = i === step
            return (
              <button type="button" className="sbtn" key={s.title} onClick={() => pick(i)} aria-pressed={isNow} aria-label={`Step ${i + 1}: ${s.title}`}>
                <span className={`ring2${isDone ? ' done' : ''}${isNow ? ' now' : ''}`}>
                  <StepIcon i={i} />
                  <span className="tick"><Check size={34} width={2.6} /></span>
                  <span className="no">{i + 1}</span>
                </span>
                <span className={`scard${isDone ? ' done' : ''}${isNow ? ' now' : ''}`}>
                  {isDone && <span className="tag tag-done">DONE</span>}
                  {isNow && <span className="tag tag-now">NOW</span>}
                  <span className="st">{s.title}</span>
                  <span className="sdsc">{s.desc}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="gpanel">
          <div className="gbody">
            <aside className="gside">
              <div className="gsidehead">
                <span className="gbig">0{step + 1}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <span className="gof">Step <b>{step + 1}</b> of 6</span>
                  <h3 className="gtitle">{guide.title}</h3>
                </span>
              </div>
              <span className="gpips">{STEPS.map((s, k) => <i key={s.title} className={k < step ? 'pd' : k === step ? 'pn' : ''} />)}</span>
              <div className="minimock"><span className="minilabel">What Juan sees</span><PortalMock tick={tick} /></div>
              <div className="gmode">Juan&rsquo;s screen for this step. Pick another step above, or use Next.</div>
              <span className="gnav">
                <button type="button" className="gprev" aria-label="Previous step" disabled={step === 0} onClick={() => pick(step - 1)}>{ICON.left}</button>
                <button type="button" className="gnext" disabled={step === 5} onClick={() => pick(step + 1)}>{step === 5 ? 'Last step' : `Next: ${STEPS[step + 1].title}`} {step < 5 && ICON.right}</button>
              </span>
            </aside>
            <div className="gmain" key={step}>
              <div className="gtop">
                {guide.groups.length > 1 ? (
                  <div className="gswitch" role="tablist">
                    {guide.groups.map((g, k) => (
                      <button type="button" role="tab" aria-selected={group === k} className={`gsw${group === k ? ' on' : ''}`} key={g.label} onClick={() => setGroup(k)}>{g.label}</button>
                    ))}
                  </div>
                ) : <span className="ghow">How to do it</span>}
                {guide.note && (
                  <span className={`gtipw${tipOpen ? ' open' : ''}`}>
                    <button type="button" className="gbulb" aria-label="Tip" aria-describedby={`tip${step}`} onClick={(e) => { e.stopPropagation(); setTipOpen((o) => !o) }}>{ICON.bulb}</button>
                    <span className="gpop" role="tooltip" id={`tip${step}`}><b>Tip</b><Rich text={guide.note} /></span>
                  </span>
                )}
              </div>
              <ol className="gtl" key={group}>
                {guide.groups[group].items.map((it) => <li key={it}><span><Rich text={it} /></span></li>)}
              </ol>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <a href="/login?mode=signup" className="btn btn-green shine">Start with step 1 {ICON.arrow}</a>
        </div>
      </div>
    </section>
  )
}

// ---------- before you apply ----------
const CONFETTI = Array.from({ length: 34 }, (_, i) => {
  const a = (i / 34) * Math.PI * 2 + (i % 3) * 0.2
  const d = 120 + ((i * 37) % 160)
  return { x: Math.round(Math.cos(a) * d * 1.7), y: Math.round(Math.sin(a) * d - 70), r: (i * 47) % 360, c: ['#C8A84B', '#FFD400', '#2E9D5B', '#5B8CFF', '#ffffff', '#E07B39'][i % 6], round: i % 2 === 0, delay: (i % 5) * 0.03 }
})
const RAIN = Array.from({ length: 70 }, (_, i) => ({ left: (i * 37) % 100, dx: ((i * 53) % 120) - 60, r: (i * 71) % 720, c: ['#C8A84B', '#FFD400', '#2E9D5B', '#5B8CFF', '#ffffff', '#E07B39'][i % 6], round: i % 3 === 0, delay: ((i * 13) % 20) / 20 }))
function Rain() {
  return (
    <span className="rain" aria-hidden="true">
      {RAIN.map((p, i) => <i key={i} className={p.round ? 'round' : ''} style={{ left: `${p.left}%`, '--dx': `${p.dx}px`, '--r': `${p.r}deg`, background: p.c, animationDelay: `${p.delay}s` }} />)}
    </span>
  )
}
function Celebrate() {
  return (
    <div className="burst" aria-hidden="true">
      <span className="burst-msg">Congratulations, scholar!</span>
      <span className="boom">{CONFETTI.map((p, i) => <i key={i} className={p.round ? 'round' : ''} style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, '--r': `${p.r}deg`, background: p.c, animationDelay: `${p.delay}s` }} />)}</span>
    </div>
  )
}

const BSED_PREFIX = 'Bachelor of Secondary Education Major in '
function ProgramRow({ name, children }) {
  return (
    <div className="prog">
      <div className="pinfo"><span className="pname">{name}</span>{children}</div>
    </div>
  )
}

function Programs() {
  return (
    <div className="pane">
      <div className="pane-head"><h3>Programs Offered</h3></div>
      <div className="depts">
        {PROGRAM_DEPARTMENTS.map((d) => {
          const bsed = d.programs.filter((p) => p.startsWith(BSED_PREFIX))
          const others = d.programs.filter((p) => !p.startsWith(BSED_PREFIX))
          const n = d.programs.length
          return (
            <div className="dept" key={d.name}>
              <div className="dhead">
                <span className="dname">{d.name}</span>
                <span className="dcount">{n} program{n > 1 ? 's' : ''}{bsed.length ? ` · ${bsed.length} BSEd majors` : ''}</span>
              </div>
              <div>
                {others.map((p) => <ProgramRow key={p} name={p} />)}
                {bsed.length > 0 && (
                  <ProgramRow name="Bachelor of Secondary Education">
                    <span className="majors">
                      {bsed.map((p) => {
                        const major = p.slice(BSED_PREFIX.length)
                        const strict = major === 'Science' || major === 'Mathematics'
                        return <span className="major" key={p}>{major}{strict && <sup>*</sup>}</span>
                      })}
                    </span>
                    <span className="pnote">* Science and Mathematics majors need a senior high school grade of <b>{BSED_MIN_SHS_GRADE} or higher</b> in Math and Science.</span>
                  </ProgramRow>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CheckBox({ checked, onChange, children }) {
  return (
    <label className={`ebox${checked ? ' on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="emark"><Check size={13} /></span>
      <span>{children}</span>
    </label>
  )
}

const ELIGIBILITY = [
  { text: <>I live in the <b>City of Calamba</b></>, missing: 'residency in Calamba' },
  { text: <>I have a <b>Voter&rsquo;s ID or COMELEC Voter&rsquo;s Certificate</b>, or my parent or guardian does</>, missing: 'a voter’s ID or certificate' },
  { text: <>I have <b>no failing grades</b> on my academic record</>, missing: 'a record with no failing grades' },
]
function Qualifications() {
  const [ticks, setTicks] = useState([false, false, false])
  const n = ticks.filter(Boolean).length
  const missing = ELIGIBILITY.filter((_, i) => !ticks[i]).map((e) => e.missing)
  return (
    <div className="pane">
      <div className="pane-head"><h3>Applicant Qualifications</h3></div>
      <div className="elig">
        <div className="eleft">
          <span className="ekick">Quick check</span>
          <h4 className="etitle">Am I eligible to apply?</h4>
          <span className="esub">Tick what applies to you. Nothing is saved.</span>
          {ELIGIBILITY.map((e, i) => (
            <CheckBox key={e.missing} checked={ticks[i]} onChange={(v) => setTicks((t) => t.map((x, k) => (k === i ? v : x)))}>{e.text}</CheckBox>
          ))}
        </div>
        <div className={`eright${n === 3 ? ' yes' : ''}`} aria-live="polite">
          <span className="eicon">{n === 3 ? <Check size={24} width={3} /> : `${n}/3`}</span>
          <span className="evt">{n === 3 ? 'You can apply!' : n === 0 ? 'Tick the three boxes' : 'Almost there'}</span>
          <span className="evs">{n === 3 ? 'You meet the basic qualifications. Create your account to start.' : n === 0 ? 'We’ll tell you if you can apply.' : `Still needed: ${missing.join(', ')}. Ask the GCTCDO office if you’re unsure.`}</span>
          {n === 3 && <a href="/login?mode=signup" className="btn btn-green shine" style={{ minHeight: 46, padding: '0 22px', marginTop: 6 }}>Apply Now {ICON.arrow}</a>}
        </div>
      </div>
      <details className="fullq">
        <summary>Read the full qualifications</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 14 }}>
          {QUALIFICATIONS.map((q) => <p key={q}>{q}</p>)}
        </div>
      </details>
    </div>
  )
}

function Requirements() {
  const [tab, setTab] = useState(0)
  const [ready, setReady] = useState({})
  const r = REQ_TABS[tab]
  const got = r.items.filter((_, k) => ready[`${tab}-${k}`]).length
  return (
    <div className="pane">
      <div className="pane-head">
        <h3>Admission Requirements</h3>
        <div className="iam">
          <span>I am a</span>
          <div role="tablist" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {REQ_TABS.map((t, i) => (
              <button type="button" role="tab" aria-selected={tab === i} className={`seg${tab === i ? ' on' : ''}`} key={t.label} onClick={() => setTab(i)}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="rcard" key={tab}>
        {r.items.length > 0 && (
          <>
            <div className="rhead"><span>Your document checklist</span><span className="rcount"><b>{got}</b> of {r.items.length} ready</span></div>
            <div className={`rbar${got === r.items.length ? ' full' : ''}`}><i style={{ width: `${(got / r.items.length) * 100}%` }} /></div>
            <div className="rlist">
              {r.items.map((t, k) => (
                <CheckBox key={t} checked={!!ready[`${tab}-${k}`]} onChange={(v) => setReady((s) => ({ ...s, [`${tab}-${k}`]: v }))}>{t}</CheckBox>
              ))}
            </div>
          </>
        )}
        {r.transfereeRules.length > 0 && (
          <div className="rrules">
            <span>The City College will accept transferees provided they have passed the following qualifications:</span>
            <ol>{r.transfereeRules.map((t) => <li key={t}>{t}</li>)}</ol>
          </div>
        )}
        {r.note && <p className="rnote">{r.note}</p>}
        <p className="rfmt"><Check size={14} width={2.6} /><span>When you upload, use <b>PDF, JPG or PNG</b> files up to <b>10 MB</b> each.</span></p>
      </div>
    </div>
  )
}

const BYA_TABS = ['Programs Offered', 'Applicant Qualifications', 'Admission Requirements']
function BeforeYouApply({ tab, setTab }) {
  return (
    <section id="before-you-apply">
      <div className="wrap sec bya-in">
        <SectionHead eyebrow="Before You Apply" title="Programs, qualifications and requirements" center />
        <div className="bya-tabs" role="tablist">
          {BYA_TABS.map((t, i) => (
            <button type="button" role="tab" aria-selected={tab === i} className={`tab${tab === i ? ' on' : ''}`} key={t} onClick={() => setTab(i)}><span className="n">0{i + 1}</span>{t}</button>
          ))}
        </div>
        {tab === 0 && <Programs />}
        {tab === 1 && <Qualifications />}
        {tab === 2 && <Requirements />}
      </div>
    </section>
  )
}

// ---------- FAQ ----------
function Highlight({ text, query }) {
  if (!query) return text
  const k = text.toLowerCase().indexOf(query)
  if (k < 0) return text
  return <>{text.slice(0, k)}<mark>{text.slice(k, k + query.length)}</mark>{text.slice(k + query.length)}</>
}
function Faq() {
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('All')
  const [open, setOpen] = useState(FAQ_DATA[0].subcategories[0].items[0].q)
  const q = query.trim().toLowerCase()
  const total = FAQ_DATA.reduce((n, c) => n + c.subcategories.reduce((m, s) => m + s.items.length, 0), 0)
  const groups = FAQ_DATA.filter((c) => cat === 'All' || c.category === cat).flatMap((c) =>
    c.subcategories.map((s) => ({
      category: c.category,
      name: s.name,
      items: s.items.filter((it) => !q || `${it.q} ${it.a}`.toLowerCase().includes(q)),
    })).filter((s) => s.items.length > 0))
  const shown = groups.reduce((n, g) => n + g.items.length, 0)
  const count = (c) => (c === 'All' ? total : FAQ_DATA.find((x) => x.category === c).subcategories.reduce((m, s) => m + s.items.length, 0))
  return (
    <section className="faqsec" id="faq">
      <div className="wrap sec faqgrid">
        <aside className="faqside">
          <SectionHead eyebrow="FAQ" title="Questions applicants ask" />
          <div className="search">
            <span className="si">{ICON.search}</span>
            <input type="search" aria-label="Search questions" placeholder="Search, e.g. exam permit" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <nav className="faqnav" aria-label="FAQ topics">
            {['All', ...FAQ_DATA.map((c) => c.category)].map((c) => (
              <button type="button" className={`fcat${cat === c ? ' on' : ''}`} key={c} onClick={() => setCat(c)}><span>{c === 'All' ? 'All questions' : c}</span><b>{count(c)}</b></button>
            ))}
          </nav>
          <div className="faqhelp">
            <strong>Still have a question?</strong>
            <span>Ask the office directly. Their hours and emails are below.</span>
            <a href="#contact" onClick={(e) => { e.preventDefault(); document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }) }}>Contact our offices {ICON.arrow}</a>
          </div>
        </aside>
        <div className="faqmain">
          <div className="faqcount">{shown} question{shown === 1 ? '' : 's'}</div>
          {groups.map((g) => (
            <div className="fgroup" key={`${g.category}-${g.name}`}>
              <div><span className="fgcat">{g.category}</span><h3>{g.name}</h3></div>
              <div className="fglist">
                {g.items.map((it) => {
                  const isOpen = open === it.q
                  return (
                    <div className={`fqi${isOpen ? ' open' : ''}`} key={it.q}>
                      <button type="button" className="fq" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : it.q)}>
                        <span><Highlight text={it.q} query={q} /></span><span className="sg" aria-hidden="true">+</span>
                      </button>
                      <div className="fqa"><div><p>{it.a}</p></div></div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {shown === 0 && <div className="faqempty">No questions match. Try another word, or ask the offices below.</div>}
        </div>
      </div>
    </section>
  )
}

// ---------- contact ----------
function manilaNow() {
  try {
    const parts = {}
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach((p) => { parts[p.type] = p.value })
    return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), hour: (Number(parts.hour) % 24) + Number(parts.minute) / 60 }
  } catch {
    return null
  }
}
function OfficeCard({ office, now }) {
  const [copied, setCopied] = useState('')
  const isOpen = now && office.days.includes(now.dow) && now.hour >= office.openHour && now.hour < office.closeHour
  const copy = (addr) => {
    try {
      navigator.clipboard.writeText(addr).then(() => { setCopied(addr); setTimeout(() => setCopied(''), 1600) }, () => {})
    } catch { /* clipboard not available: the address is still shown */ }
  }
  return (
    <article className="ocard">
      <div className="ohead">
        <span className="oshort">{office.short}</span>
        {now && <span className={`ostatus ${isOpen ? 'open' : 'closed'}`}><i />{isOpen ? 'Open now' : 'Closed now'}</span>}
      </div>
      <h3 className="oname">{office.name}</h3>
      <div className="oweek" aria-hidden="true">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, k) => {
          const dow = (k + 1) % 7
          return <span key={k} className={`${office.days.includes(dow) ? 'on' : ''}${now && now.dow === dow ? ' today' : ''}`}>{d}</span>
        })}
      </div>
      <p className="orow">{ICON.clock}<span>{office.hours}</span></p>
      <p className="orow">{ICON.pin}<span>{office.address}</span></p>
      <div className="omails">
        {office.emails.map((m) => (
          <div className="omail" key={m.address}>
            <span className="oico">{ICON.mail}</span>
            <span className="addr"><a href={`mailto:${m.address}`}>{m.address}</a>{m.note && <span className="onote">{m.note}</span>}</span>
            <button type="button" className={`ocopy${copied === m.address ? ' done' : ''}`} onClick={() => copy(m.address)} aria-label={`Copy ${m.address}`}>{ICON.copy}<span>{copied === m.address ? 'Copied' : 'Copy'}</span></button>
          </div>
        ))}
      </div>
      <a className="ofb" href={office.fb.href} target="_blank" rel="noopener noreferrer">{ICON.fb}<span>{office.fb.label}</span></a>
    </article>
  )
}
function Contact() {
  const [now, setNow] = useState(null)
  useEffect(() => {
    setNow(manilaNow())
    const id = setInterval(() => setNow(manilaNow()), 60000)
    return () => clearInterval(id)
  }, [])
  return (
    <section id="contact">
      <div className="wrap sec contact-in">
        <SectionHead eyebrow="Contact" title="Contact our offices" />
        <div className="ocards">{CONTACT_OFFICES.map((o) => <OfficeCard key={o.short} office={o} now={now} />)}</div>
        <div className="mapframe">
          <iframe
            title="City College of Calamba, Calamba City, Laguna"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d965.0069!2d121.1675199!3d14.2120907!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33bd622b2e539df1%3A0x9102ac773e8a0b99!2sCity%20College%20of%20Calamba!5e0!3m2!1sen!2sph!4v1717000000000!5m2!1sen!2sph"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="maplabel">
            <span>{ICON.pin} City College of Calamba &middot; Brgy. Real, Calamba City, Laguna 4027</span>
            <a href="https://maps.google.com/?q=City+College+of+Calamba" target="_blank" rel="noopener noreferrer">Open in Google Maps {ICON.arrow}</a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- page ----------
export default function WelcomePage() {
  const [announcements, setAnnouncements] = useState([])
  const [bya, setBya] = useState(0)
  const [paused, setPaused] = useState(false)
  const [showToTop, setShowToTop] = useState(false)
  const [activeNav, setActiveNav] = useState('hero')
  const mainRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/announcements')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const rows = Array.isArray(data) ? data : data.announcements || []
        setAnnouncements(rows.filter((row) => row.type === 'announcement'))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const sections = NAV_LINKS.map((n) => document.getElementById(n.id)).filter(Boolean)
    const onScroll = () => {
      setShowToTop(window.scrollY > 300)
      let cur = 'hero'
      sections.forEach((s) => { if (window.scrollY >= s.offsetTop - 90) cur = s.id })
      setActiveNav(cur)
    }
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function scrollToId(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function openBeforeYouApplySection(idx) {
    setBya(idx)
    scrollToId('before-you-apply')
  }

  return (
    <main className={`welcome-page lp${paused ? ' stopped' : ''}`} ref={mainRef}>
      <WelcomeNavbar activeId={activeNav} onLinkClick={(id) => (id === 'before-you-apply' ? openBeforeYouApplySection(0) : scrollToId(id))} />
      <Hero paused={paused} onTogglePause={() => setPaused((p) => !p)} onHowTo={() => scrollToId('how-to-apply')} />
      <Announcements items={announcements} />
      <HowToApply paused={paused} />
      <BeforeYouApply tab={bya} setTab={setBya} />
      <Faq />
      <Contact />
      <WelcomeFooter onBeforeYouApplyClick={openBeforeYouApplySection} onFaqClick={() => scrollToId('faq')} />
      <button type="button" className={`w-to-top${showToTop ? ' show' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Scroll to top">{ICON.up}</button>
    </main>
  )
}
