import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'
import { type ViewBox, viewBoxToString } from './types'

export interface UsePanZoomViewBoxOptions {
  /**
   * The base ("100%") viewBox — the frame shown at zoom = 1 and restored by
   * {@link PanZoomViewBox.reset}. Usually your SVG's natural coordinate frame,
   * e.g. `{ x: 0, y: 0, width: 800, height: 500 }`.
   */
  initial: ViewBox
  /** Smallest allowed zoom multiplier (relative to `initial`). Default `0.25`. */
  minZoom?: number
  /** Largest allowed zoom multiplier (relative to `initial`). Default `8`. */
  maxZoom?: number
  /** Multiplier applied per wheel notch. Default `1.15`. */
  wheelStep?: number
  /** Enable cursor-anchored wheel zoom. Default `true`. */
  wheel?: boolean
  /** Enable drag-to-pan (mouse) and one-finger pan (touch). Default `true`. */
  pan?: boolean
  /** Enable two-finger pinch zoom. Default `true`. */
  pinch?: boolean
  /** Fired whenever the viewBox changes (zoom, pan, reset, or imperative set). */
  onChange?: (viewBox: ViewBox) => void
}

export interface PanZoomViewBox {
  /**
   * Attach to the element that wraps your `<svg>`. The SVG is expected to fill
   * this element (`width: 100%; height: 100%`) — the container's box is used as
   * the viewport for cursor-anchored zoom and pan math.
   */
  containerRef: RefObject<HTMLDivElement | null>
  /** The current viewBox. */
  viewBox: ViewBox
  /** The current viewBox serialized for the SVG `viewBox` attribute. */
  viewBoxString: string
  /** The current zoom multiplier (`1` = `initial`). */
  zoom: number
  /** Zoom about the viewport center by a factor (`> 1` in, `< 1` out). */
  zoomBy: (factor: number) => void
  /** Set the absolute zoom multiplier, anchored on the viewport center. */
  setZoom: (zoom: number) => void
  /** Restore the `initial` viewBox (zoom = 1). */
  reset: () => void
  /** Imperatively replace the viewBox (e.g. to fit a sub-region). Updates zoom. */
  setViewBox: (viewBox: ViewBox) => void
}

const DEFAULTS = {
  minZoom: 0.25,
  maxZoom: 8,
  wheelStep: 1.15,
  wheel: true,
  pan: true,
  pinch: true,
} as const

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by)

/**
 * Headless pan & zoom for an SVG, driven by its `viewBox` attribute.
 *
 * Unlike CSS-`transform` pan/zoom libraries, this mutates the `viewBox`, so the
 * vector content stays crisp at any zoom, stroke widths and text scale exactly
 * as the spec defines, and hit-testing keeps working. The hook owns no DOM and
 * imposes no styles — you render the `<svg>`, bind `viewBox` to
 * {@link PanZoomViewBox.viewBoxString}, and wire `containerRef`.
 *
 * @example
 * ```tsx
 * function Diagram() {
 *   const pz = usePanZoomViewBox({ initial: { x: 0, y: 0, width: 800, height: 500 } })
 *   return (
 *     <div ref={pz.containerRef} style={{ width: '100%', height: 400, cursor: 'grab' }}>
 *       <svg viewBox={pz.viewBoxString} style={{ width: '100%', height: '100%' }}>
 *         {/* ...your shapes... *\/}
 *       </svg>
 *       <button onClick={() => pz.zoomBy(1.2)}>+</button>
 *       <button onClick={() => pz.zoomBy(0.8)}>−</button>
 *       <button onClick={pz.reset}>Reset</button>
 *     </div>
 *   )
 * }
 * ```
 *
 * ### Why a ref mirror?
 * Wheel and touch listeners are attached imperatively (`addEventListener`) with
 * `{ passive: false }` so they can `preventDefault()` page scroll/zoom. They are
 * bound **once** and read the live viewBox from a ref (`vbRef`) instead of from
 * the render closure. Re-binding on every viewBox change (the naive approach)
 * drops fast wheel/pinch deltas in the remove/re-add gap — this avoids that.
 */
export function usePanZoomViewBox(
  options: UsePanZoomViewBoxOptions,
): PanZoomViewBox {
  const cfg = { ...DEFAULTS, ...options }
  const { initial, minZoom, maxZoom, wheelStep } = cfg

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [viewBox, setVbState] = useState<ViewBox>(initial)

  // Live mirrors for the imperative listeners (bound once, see docblock).
  const vbRef = useRef<ViewBox>(viewBox)
  const zoomRef = useRef(1)
  const initialRef = useRef<ViewBox>(initial)
  const onChangeRef = useRef(options.onChange)

  // Keep the base frame + onChange current without re-binding listeners.
  useEffect(() => {
    initialRef.current = initial
  }, [initial])
  useEffect(() => {
    onChangeRef.current = options.onChange
  }, [options.onChange])

  // Single funnel for every viewBox mutation: updates state + ref + fires onChange.
  const commit = useCallback((vb: ViewBox) => {
    vbRef.current = vb
    setVbState(vb)
    onChangeRef.current?.(vb)
  }, [])

  // Zoom about an explicit anchor point given in viewBox coordinates.
  const zoomAbout = useCallback(
    (nextZoom: number, anchorX: number, anchorY: number) => {
      const z = clamp(nextZoom, minZoom, maxZoom)
      const base = initialRef.current
      const cur = vbRef.current
      const w = base.width / z
      const h = base.height / z
      // Keep (anchorX, anchorY) under the same fractional position it occupied.
      const x = anchorX - ((anchorX - cur.x) * w) / cur.width
      const y = anchorY - ((anchorY - cur.y) * h) / cur.height
      zoomRef.current = z
      commit({ x, y, width: w, height: h })
    },
    [commit, minZoom, maxZoom],
  )

  const zoomBy = useCallback(
    (factor: number) => {
      const cur = vbRef.current
      zoomAbout(zoomRef.current * factor, cur.x + cur.width / 2, cur.y + cur.height / 2)
    },
    [zoomAbout],
  )

  const setZoom = useCallback(
    (z: number) => {
      const cur = vbRef.current
      zoomAbout(z, cur.x + cur.width / 2, cur.y + cur.height / 2)
    },
    [zoomAbout],
  )

  const reset = useCallback(() => {
    zoomRef.current = 1
    commit({ ...initialRef.current })
  }, [commit])

  const setViewBox = useCallback(
    (vb: ViewBox) => {
      // Derive the implied zoom from the width ratio so subsequent wheel/pinch
      // steps continue from the right place after an imperative fit.
      zoomRef.current = clamp(initialRef.current.width / vb.width, minZoom, maxZoom)
      commit(vb)
    },
    [commit, minZoom, maxZoom],
  )

  // Imperative wheel + touch listeners — bound once per enable-flag change.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const toViewBox = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect()
      const cur = vbRef.current
      return {
        x: cur.x + ((clientX - r.left) / r.width) * cur.width,
        y: cur.y + ((clientY - r.top) / r.height) * cur.height,
      }
    }

    const cleanups: Array<() => void> = []

    if (cfg.wheel) {
      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        const p = toViewBox(e.clientX, e.clientY)
        const factor = e.deltaY < 0 ? wheelStep : 1 / wheelStep
        zoomAbout(zoomRef.current * factor, p.x, p.y)
      }
      el.addEventListener('wheel', onWheel, { passive: false })
      cleanups.push(() => el.removeEventListener('wheel', onWheel))
    }

    // Drag-to-pan (mouse).
    if (cfg.pan) {
      let dragging = false
      let startX = 0
      let startY = 0
      let vbStartX = 0
      let vbStartY = 0

      const onDown = (e: MouseEvent) => {
        if (e.button !== 0) return
        dragging = true
        startX = e.clientX
        startY = e.clientY
        vbStartX = vbRef.current.x
        vbStartY = vbRef.current.y
        e.preventDefault()
      }
      const onMove = (e: MouseEvent) => {
        if (!dragging) return
        const r = el.getBoundingClientRect()
        const cur = vbRef.current
        commit({
          ...cur,
          x: vbStartX - ((e.clientX - startX) / r.width) * cur.width,
          y: vbStartY - ((e.clientY - startY) / r.height) * cur.height,
        })
      }
      const onUp = () => {
        dragging = false
      }
      el.addEventListener('mousedown', onDown)
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      cleanups.push(() => {
        el.removeEventListener('mousedown', onDown)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      })
    }

    // Touch: one finger pans, two fingers pinch-zoom.
    if (cfg.pan || cfg.pinch) {
      let panStartX = 0
      let panStartY = 0
      let vbStartX = 0
      let vbStartY = 0
      let panning = false
      let lastPinch = 0

      const onTouchStart = (e: TouchEvent) => {
        if (cfg.pan && e.touches.length === 1) {
          panning = true
          panStartX = e.touches[0].clientX
          panStartY = e.touches[0].clientY
          vbStartX = vbRef.current.x
          vbStartY = vbRef.current.y
        }
        if (cfg.pinch && e.touches.length === 2) {
          panning = false
          lastPinch = distance(
            e.touches[0].clientX,
            e.touches[0].clientY,
            e.touches[1].clientX,
            e.touches[1].clientY,
          )
        }
        e.preventDefault()
      }
      const onTouchMove = (e: TouchEvent) => {
        if (cfg.pan && panning && e.touches.length === 1) {
          const r = el.getBoundingClientRect()
          const cur = vbRef.current
          commit({
            ...cur,
            x: vbStartX - ((e.touches[0].clientX - panStartX) / r.width) * cur.width,
            y: vbStartY - ((e.touches[0].clientY - panStartY) / r.height) * cur.height,
          })
        } else if (cfg.pinch && e.touches.length === 2) {
          const d = distance(
            e.touches[0].clientX,
            e.touches[0].clientY,
            e.touches[1].clientX,
            e.touches[1].clientY,
          )
          if (lastPinch > 0) {
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
            const p = toViewBox(midX, midY)
            zoomAbout(zoomRef.current * (d / lastPinch), p.x, p.y)
          }
          lastPinch = d
        }
        e.preventDefault()
      }
      const onTouchEnd = () => {
        panning = false
        lastPinch = 0
      }
      el.addEventListener('touchstart', onTouchStart, { passive: false })
      el.addEventListener('touchmove', onTouchMove, { passive: false })
      el.addEventListener('touchend', onTouchEnd)
      cleanups.push(() => {
        el.removeEventListener('touchstart', onTouchStart)
        el.removeEventListener('touchmove', onTouchMove)
        el.removeEventListener('touchend', onTouchEnd)
      })
    }

    return () => cleanups.forEach((fn) => fn())
    // Listeners read live state from refs, so they only re-bind when an
    // enable-flag changes — never on viewBox/zoom updates.
  }, [cfg.wheel, cfg.pan, cfg.pinch, wheelStep, zoomAbout, commit])

  return {
    containerRef,
    viewBox,
    viewBoxString: viewBoxToString(viewBox),
    zoom: zoomRef.current,
    zoomBy,
    setZoom,
    reset,
    setViewBox,
  }
}
