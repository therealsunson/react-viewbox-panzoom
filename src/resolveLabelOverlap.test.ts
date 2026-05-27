import { describe, expect, it } from 'vitest'
import { resolveLabelOverlap, type LabelItem } from './resolveLabelOverlap'

const adjacentGaps = (centers: number[], size: number) =>
  centers.slice(1).map((c, i) => c - centers[i] - size)

describe('resolveLabelOverlap', () => {
  it('leaves non-overlapping labels untouched', () => {
    const items: LabelItem[] = [
      { center: 0, size: 20 },
      { center: 100, size: 20 },
      { center: 200, size: 20 },
    ]
    const out = resolveLabelOverlap(items)
    expect(out.map((r) => r.center)).toEqual([0, 100, 200])
    expect(out.every((r) => r.shift === 0)).toBe(true)
  })

  it('separates an overlapping cluster so no adjacent pair collides', () => {
    const size = 40
    const gap = 4
    const items: LabelItem[] = [
      { center: 100, size },
      { center: 110, size },
      { center: 125, size },
    ]
    const out = resolveLabelOverlap(items, { gap })
    const centers = out.map((r) => r.center)
    // Sorted, and every neighbour at least `size + gap` apart.
    expect(centers).toEqual([...centers].sort((a, b) => a - b))
    for (const g of adjacentGaps(centers, size)) {
      expect(g).toBeGreaterThanOrEqual(gap - 1e-6)
    }
  })

  it('keeps the cluster roughly centered on its original mean', () => {
    const items: LabelItem[] = [
      { center: 100, size: 40 },
      { center: 105, size: 40 },
      { center: 110, size: 40 },
    ]
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    const out = resolveLabelOverlap(items)
    expect(mean(out.map((r) => r.center))).toBeCloseTo(105, 0)
  })

  it('moves the heavier (more anchored) item less', () => {
    const out = resolveLabelOverlap([
      { center: 100, size: 40, weight: 10 },
      { center: 120, size: 40, weight: 1 },
    ])
    const heavy = out.find((r) => r.item.weight === 10)!
    const light = out.find((r) => r.item.weight === 1)!
    expect(Math.abs(heavy.shift)).toBeLessThan(Math.abs(light.shift))
  })

  it('does not mutate the input items', () => {
    const items: LabelItem[] = [
      { center: 100, size: 40 },
      { center: 110, size: 40 },
    ]
    const snapshot = items.map((i) => ({ ...i }))
    resolveLabelOverlap(items)
    expect(items).toEqual(snapshot)
  })

  it('handles empty and single-item inputs', () => {
    expect(resolveLabelOverlap([])).toEqual([])
    const single = resolveLabelOverlap([{ center: 7, size: 10 }])
    expect(single).toHaveLength(1)
    expect(single[0].center).toBe(7)
  })

  it('is deterministic', () => {
    const items: LabelItem[] = [
      { center: 50, size: 30 },
      { center: 55, size: 30 },
      { center: 60, size: 30 },
      { center: 200, size: 30 },
    ]
    const a = resolveLabelOverlap(items)
    const b = resolveLabelOverlap(items)
    expect(a.map((r) => r.center)).toEqual(b.map((r) => r.center))
  })
})
