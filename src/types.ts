/**
 * An SVG `viewBox` expressed as an object. Maps 1:1 to the four numbers in the
 * SVG `viewBox="x y width height"` attribute.
 */
export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

/** Serialize a {@link ViewBox} to the `viewBox` attribute string. */
export function viewBoxToString(vb: ViewBox): string {
  return `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
}
