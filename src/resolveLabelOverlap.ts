export interface LabelItem {
  /** Center of the label along the axis (e.g. its `x` for a horizontal ruler). */
  center: number
  /** Extent of the label along the same axis (its width, for horizontal text). */
  size: number
  /**
   * Optional resistance to being moved, relative to its neighbours. An item
   * with a higher weight cedes less ground when it collides — useful to pin a
   * label near its true anchor while letting a flexible neighbour slide. When
   * omitted (or equal across a pair) the overlap is split evenly. Must be ≥ 0.
   */
  weight?: number
}

export interface ResolveLabelOverlapOptions {
  /** Minimum gap to keep between adjacent labels, in axis units. Default `4`. */
  gap?: number
  /**
   * Maximum relaxation passes. The solver exits early once a pass makes no
   * correction, so this is just a ceiling — raise it only for very large, very
   * tight clusters. Default `100`.
   */
  iterations?: number
}

export interface ResolvedLabel<T extends LabelItem> {
  /** The original item (object identity preserved). */
  item: T
  /** The original, pre-resolution center. */
  originalCenter: number
  /** The de-conflicted center to render at. */
  center: number
  /** Convenience: `center - originalCenter`. */
  shift: number
}

/**
 * Spread a set of labels along one axis so none overlap, moving each as little
 * as possible from its anchor.
 *
 * This is the 1-D label-decluttering problem that shows up on chart axes,
 * dimension rulers, timelines, and map callouts: several labels want to sit at
 * their true positions, but their boxes collide. A few passes of pairwise
 * relaxation push neighbours apart by exactly their overlap (optionally biased
 * by `weight`), preserving order and keeping total displacement small.
 *
 * Pure and deterministic — input items are never mutated; results come back
 * sorted by resolved center.
 *
 * @example
 * ```ts
 * const labels = [
 *   { center: 100, size: 40 },  // these three want to sit on top of
 *   { center: 110, size: 40 },  // each other...
 *   { center: 125, size: 40 },
 * ]
 * resolveLabelOverlap(labels).map((r) => r.center)
 * // → spread apart by ~44px each, centered on the original cluster
 * ```
 */
export function resolveLabelOverlap<T extends LabelItem>(
  items: T[],
  options: ResolveLabelOverlapOptions = {},
): ResolvedLabel<T>[] {
  const gap = options.gap ?? 4
  const iterations = options.iterations ?? 100

  const nodes = items.map((item) => ({
    item,
    originalCenter: item.center,
    center: item.center,
    size: Math.max(0, item.size),
    weight: item.weight != null ? Math.max(0, item.weight) : 1,
  }))

  // Resolve left-to-right; ties broken by original order for stability.
  nodes.sort((a, b) => a.center - b.center || a.originalCenter - b.originalCenter)

  for (let pass = 0; pass < iterations; pass++) {
    let moved = false
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i]
      const b = nodes[i + 1]
      const minSeparation = a.size / 2 + b.size / 2 + gap
      const overlap = minSeparation - (b.center - a.center)
      if (overlap > 1e-6) {
        // Split the correction inversely to weight: the heavier item moves less.
        const total = a.weight + b.weight
        const aShare = total > 0 ? b.weight / total : 0.5
        a.center -= overlap * aShare
        b.center += overlap * (1 - aShare)
        moved = true
      }
    }
    if (!moved) break
  }

  return nodes.map((n) => ({
    item: n.item,
    originalCenter: n.originalCenter,
    center: n.center,
    shift: n.center - n.originalCenter,
  }))
}
