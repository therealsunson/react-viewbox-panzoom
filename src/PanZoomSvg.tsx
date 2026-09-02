import {
  type CSSProperties,
  type ReactNode,
  type SVGProps,
  forwardRef,
  useImperativeHandle,
} from 'react'
import {
  type PanZoomViewBox,
  type UsePanZoomViewBoxOptions,
  usePanZoomViewBox,
} from './usePanZoomViewBox'
import { type ViewBox } from './types'

export interface PanZoomSvgProps extends Omit<UsePanZoomViewBoxOptions, 'initial'> {
  /** The base ("100%") viewBox. */
  viewBox: ViewBox
  /** SVG contents — paths, groups, text, anything. */
  children?: ReactNode
  /** Class for the wrapping container element. */
  className?: string
  /** Inline style for the wrapping container element. */
  style?: CSSProperties
  /** Extra props forwarded to the inner `<svg>` (e.g. `preserveAspectRatio`). */
  svgProps?: Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'ref'>
  /** Optional render prop for toolbar/controls; receives the live API. */
  controls?: (api: PanZoomViewBox) => ReactNode
}

/**
 * A thin, mostly-unstyled wrapper around {@link usePanZoomViewBox} for when you
 * just want a pannable/zoomable SVG without wiring the hook yourself. It sets
 * only the handful of styles the interaction needs (`touch-action`, the grab
 * cursor, and a full-bleed `<svg>`); everything else is yours via
 * `className`/`style`.
 *
 * The component's `ref` exposes the same {@link PanZoomViewBox} API the hook
 * returns, so parents can drive zoom/reset imperatively.
 *
 * @example
 * ```tsx
 * <PanZoomSvg
 *   viewBox={{ x: 0, y: 0, width: 800, height: 500 }}
 *   style={{ height: 400, border: '1px solid #ddd' }}
 *   controls={(pz) => (
 *     <div style={{ position: 'absolute', top: 8, right: 8 }}>
 *       <button onClick={() => pz.zoomBy(1.2)}>+</button>
 *       <button onClick={() => pz.zoomBy(0.8)}>−</button>
 *       <button onClick={pz.reset}>Reset</button>
 *     </div>
 *   )}
 * >
 *   <rect x={100} y={100} width={600} height={300} fill="#5b89c6" />
 * </PanZoomSvg>
 * ```
 */
export const PanZoomSvg = forwardRef<PanZoomViewBox, PanZoomSvgProps>(function PanZoomSvg(
  { viewBox, children, className, style, svgProps, controls, ...hookOptions },
  ref,
) {
  const api = usePanZoomViewBox({ initial: viewBox, ...hookOptions })
  useImperativeHandle(ref, () => api, [api])

  return (
    <div
      ref={api.containerRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        // Grab / grabbing, and NEITHER when panning is off: a grab cursor on a
        // canvas that cannot be dragged promises an interaction that does not
        // exist. `style` still wins, so a consumer can override all of it.
        cursor: hookOptions.pan === false ? undefined : api.isPanning ? 'grabbing' : 'grab',
        // Cooperative mode hands vertical swipes back to the browser, so the
        // page must be allowed to scroll vertically + handle its own pinch.
        touchAction: hookOptions.cooperativeTouch ? 'pan-y pinch-zoom' : 'none',
        ...style,
      }}
    >
      <svg
        {...svgProps}
        viewBox={api.viewBoxString}
        style={{ display: 'block', width: '100%', height: '100%', ...svgProps?.style }}
      >
        {children}
      </svg>
      {controls?.(api)}
    </div>
  )
})
