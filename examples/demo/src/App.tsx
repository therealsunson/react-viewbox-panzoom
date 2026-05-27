import { useState } from 'react'
import {
  PanZoomSvg,
  resolveLabelOverlap,
  usePanZoomViewBox,
  type LabelItem,
} from 'react-viewbox-panzoom'

const BLUE = '#5b89c6'
const GREEN = '#4fa987'
const INK = '#1e293b'
const SLATE = '#64748b'

/* ---------------------------------------------------------------- helpers */

function boltRing(count: number, radius: number, cx: number, cy: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius }
  })
}

/* ----------------------------------------------------- pan & zoom panel */

const PART_VIEWBOX = { x: 0, y: 0, width: 800, height: 480 }

function Schematic() {
  const pz = usePanZoomViewBox({ initial: PART_VIEWBOX, minZoom: 0.4, maxZoom: 12 })
  const cx = 400
  const cy = 240

  return (
    <div className="stage" ref={pz.containerRef}>
      <svg viewBox={pz.viewBoxString} className="stage-svg">
        <defs>
          <pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="#dbe3ec" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={800} height={480} fill="url(#dots)" />

        {/* body */}
        <circle cx={cx} cy={cy} r={150} fill={BLUE} fillOpacity={0.08} stroke={BLUE} strokeWidth={3} />
        <circle cx={cx} cy={cy} r={100} fill={GREEN} fillOpacity={0.1} stroke={GREEN} strokeWidth={3} />
        <circle cx={cx} cy={cy} r={38} fill="#0f172a" fillOpacity={0.06} stroke={SLATE} strokeWidth={2} />

        {/* bolt circle */}
        {boltRing(8, 150, cx, cy).map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={9} fill={INK} />
        ))}

        {/* center cross */}
        <path d={`M${cx - 18} ${cy}H${cx + 18}M${cx} ${cy - 18}V${cy + 18}`} stroke={SLATE} strokeWidth={2} />

        {/* a dimension line that rewards zooming in */}
        <g stroke={BLUE} strokeWidth={1.5}>
          <line x1={cx - 150} y1={420} x2={cx + 150} y2={420} />
          <line x1={cx - 150} y1={414} x2={cx - 150} y2={426} />
          <line x1={cx + 150} y1={414} x2={cx + 150} y2={426} />
        </g>
        <text x={cx} y={438} textAnchor="middle" fontSize={13} fill="#3b6fb0" fontFamily="ui-monospace, monospace">
          Ø300.0 — bolt circle
        </text>
        <text x={20} y={30} fontSize={12} fill={SLATE} fontFamily="ui-monospace, monospace">
          part.svg
        </text>
      </svg>

      <div className="toolbar">
        <button onClick={() => pz.zoomBy(1.25)} aria-label="Zoom in">＋</button>
        <button onClick={() => pz.zoomBy(0.8)} aria-label="Zoom out">－</button>
        <button onClick={() => pz.setViewBox({ x: 230, y: 70, width: 340, height: 340 })}>Fit part</button>
        <button onClick={pz.reset}>Reset</button>
      </div>

      <div className="readout">{Math.round(pz.zoom * 100)}%</div>
      <div className="hint">scroll to zoom · drag to pan · pinch on touch</div>
    </div>
  )
}

/* --------------------------------------------------- label declutter panel */

const TICKS: { at: number; label: string }[] = [
  { at: 90, label: 'L1 86.0' },
  { at: 120, label: 'L2 58.0' },
  { at: 150, label: 'D2 41.5' },
  { at: 360, label: 'PCD 144' },
  { at: 410, label: 'D4 22.0' },
]
const LABEL_W = 64
const RULER_Y = 150
const TEXT_Y = 96

function DeclutterPanel() {
  const [declutter, setDeclutter] = useState(true)

  const items: LabelItem[] = TICKS.map((t) => ({ center: t.at, size: LABEL_W }))
  const resolved = resolveLabelOverlap(items, { gap: 10 })
  const placed = TICKS.map((t, i) => ({
    ...t,
    labelX: declutter ? resolved[i].center : t.at,
  }))

  return (
    <div>
      <svg viewBox="0 0 520 200" className="ruler-svg" role="img" aria-label="ruler with labels">
        <line x1={70} y1={RULER_Y} x2={450} y2={RULER_Y} stroke={SLATE} strokeWidth={1.5} />
        {placed.map((t, i) => (
          <g key={i}>
            <line x1={t.at} y1={RULER_Y - 6} x2={t.at} y2={RULER_Y + 6} stroke={SLATE} strokeWidth={1.5} />
            {/* leader from the (possibly shifted) label back to the true tick */}
            <path
              d={`M${t.labelX} ${TEXT_Y + 6} L${t.labelX} ${RULER_Y - 22} L${t.at} ${RULER_Y - 6}`}
              fill="none"
              stroke={BLUE}
              strokeWidth={1}
              strokeOpacity={0.45}
            />
            <rect
              x={t.labelX - LABEL_W / 2}
              y={TEXT_Y - 12}
              width={LABEL_W}
              height={18}
              rx={4}
              fill="#eef3f8"
              stroke={BLUE}
              strokeOpacity={0.5}
            />
            <text x={t.labelX} y={TEXT_Y + 1} textAnchor="middle" fontSize={11} fill="#3b6fb0" fontFamily="ui-monospace, monospace">
              {t.label}
            </text>
          </g>
        ))}
      </svg>

      <label className="switch">
        <input type="checkbox" checked={declutter} onChange={(e) => setDeclutter(e.target.checked)} />
        <span>
          <code>resolveLabelOverlap()</code> — {declutter ? 'on' : 'off'}
        </span>
      </label>
    </div>
  )
}

/* ------------------------------------------------------------------- page */

export default function App() {
  return (
    <main className="page">
      <header className="hero">
        <h1>react-viewbox-panzoom</h1>
        <p>
          Headless, dependency-free pan &amp; zoom for SVG via the <code>viewBox</code> attribute.
          Stays pixel-crisp at any zoom.
        </p>
        <nav className="links">
          <a href="https://github.com/therealsunson/react-viewbox-panzoom">GitHub</a>
          <a href="https://www.npmjs.com/package/react-viewbox-panzoom">npm</a>
        </nav>
      </header>

      <section className="card">
        <h2>Pan &amp; zoom a vector schematic</h2>
        <p className="muted">
          Driven by the SVG <code>viewBox</code> — hairlines stay 1px and text stays sharp no matter
          how far you zoom. Cursor-anchored wheel zoom, drag pan, pinch on touch.
        </p>
        <Schematic />
      </section>

      <section className="card">
        <h2>Declutter overlapping labels</h2>
        <p className="muted">
          The same library ships a pure 1-D label solver. Toggle it to spread colliding ruler labels
          apart — leader lines trace each back to its true tick.
        </p>
        <DeclutterPanel />
      </section>

      <footer className="foot">
        MIT © Rangsiman Chantasorn · built as an extraction from a production technical-drawing UI
      </footer>
    </main>
  )
}
