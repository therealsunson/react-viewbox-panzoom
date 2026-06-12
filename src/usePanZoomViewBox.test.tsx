import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type PanZoomViewBox,
  type UsePanZoomViewBoxOptions,
  usePanZoomViewBox,
} from './usePanZoomViewBox'

const INITIAL = { x: 0, y: 0, width: 800, height: 500 }

/** Renders the hook, mocks the container's box, and surfaces the live API. */
function setup(options?: Partial<UsePanZoomViewBoxOptions>) {
  const apiBox: { current: PanZoomViewBox | null } = { current: null }

  function Harness() {
    const api = usePanZoomViewBox({ initial: INITIAL, ...options })
    apiBox.current = api
    return (
      <div ref={api.containerRef} data-testid="container">
        <svg data-testid="svg" viewBox={api.viewBoxString} />
        <span data-testid="vb">{api.viewBoxString}</span>
        <span data-testid="zoom">{api.zoom.toFixed(5)}</span>
      </div>
    )
  }

  const utils = render(<Harness />)
  const container = utils.getByTestId('container') as HTMLDivElement
  // jsdom returns an all-zero rect; give the viewport a real size.
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 500, width: 800, height: 500,
    toJSON: () => ({}),
  } as DOMRect)

  const vb = () => utils.getByTestId('vb').textContent!
  const zoom = () => Number(utils.getByTestId('zoom').textContent)
  const api = () => apiBox.current!
  return { ...utils, container, vb, zoom, api }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('usePanZoomViewBox', () => {
  it('starts at the initial viewBox, zoom 1', () => {
    const { vb, zoom } = setup()
    expect(vb()).toBe('0 0 800 500')
    expect(zoom()).toBe(1)
  })

  it('zoomBy(2) halves the viewBox size about the center', () => {
    const { api, vb, zoom } = setup()
    act(() => api().zoomBy(2))
    // Width/height halve; box stays centered on (400, 250).
    expect(vb()).toBe('200 125 400 250')
    expect(zoom()).toBe(2)
  })

  it('clamps zoom to [minZoom, maxZoom]', () => {
    const { api, zoom } = setup({ minZoom: 0.5, maxZoom: 4 })
    act(() => api().setZoom(100))
    expect(zoom()).toBe(4)
    act(() => api().setZoom(0.001))
    expect(zoom()).toBe(0.5)
  })

  it('reset() restores the initial frame', () => {
    const { api, vb, zoom } = setup()
    act(() => api().zoomBy(3))
    expect(zoom()).toBe(3)
    act(() => api().reset())
    expect(vb()).toBe('0 0 800 500')
    expect(zoom()).toBe(1)
  })

  it('setViewBox() derives the implied zoom from the width ratio', () => {
    const { api, vb, zoom } = setup()
    act(() => api().setViewBox({ x: 100, y: 100, width: 200, height: 125 }))
    expect(vb()).toBe('100 100 200 125')
    expect(zoom()).toBe(4) // 800 / 200
  })

  it('fires onChange with the new viewBox', () => {
    const onChange = vi.fn()
    const { api } = setup({ onChange })
    act(() => api().zoomBy(2))
    expect(onChange).toHaveBeenCalledWith({ x: 200, y: 125, width: 400, height: 250 })
  })

  it('wheel up zooms in, anchored under the cursor', () => {
    const { container, zoom, vb } = setup({ wheelStep: 1.2 })
    act(() => {
      container.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, clientX: 0, clientY: 0, bubbles: true, cancelable: true }),
      )
    })
    // Zoomed in by one step...
    expect(zoom()).toBeCloseTo(1.2, 5)
    // ...and the top-left corner (the cursor anchor) stayed put at 0,0.
    expect(vb()).toMatch(/^0 0 /)
  })

  it('wheel down zooms out', () => {
    const { container, zoom } = setup({ wheelStep: 1.25 })
    act(() => {
      container.dispatchEvent(
        new WheelEvent('wheel', { deltaY: 120, clientX: 400, clientY: 250, bubbles: true, cancelable: true }),
      )
    })
    expect(zoom()).toBeCloseTo(0.8, 5) // 1 / 1.25
  })
})

/** jsdom has no Touch/TouchEvent constructors — fake the bits the hook reads. */
function fireTouch(
  el: Element,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  touches: Array<{ clientX: number; clientY: number }> = [],
) {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    touches: Array<{ clientX: number; clientY: number }>
  }
  e.touches = touches
  act(() => {
    el.dispatchEvent(e)
  })
  return e
}

describe('touch gestures', () => {
  it('default (capture) mode: one-finger pan moves the viewBox in any direction', () => {
    const { container, vb } = setup()
    fireTouch(container, 'touchstart', [{ clientX: 100, clientY: 100 }])
    const move = fireTouch(container, 'touchmove', [{ clientX: 100, clientY: 40 }])
    // 60px up on a 500px-tall viewport over a 500-unit box → y pans by +60.
    expect(vb()).toBe('0 60 800 500')
    // Capture mode owns the gesture outright — the page never scrolls.
    expect(move.defaultPrevented).toBe(true)
  })

  it('cooperative mode: vertical swipes pass through to the page', () => {
    const { container, vb } = setup({ cooperativeTouch: true })
    fireTouch(container, 'touchstart', [{ clientX: 100, clientY: 100 }])
    const move = fireTouch(container, 'touchmove', [{ clientX: 102, clientY: 180 }])
    // Axis locked to vertical: the SVG must not pan, and the browser keeps
    // the event (native page scroll).
    expect(vb()).toBe('0 0 800 500')
    expect(move.defaultPrevented).toBe(false)
  })

  it('cooperative mode: horizontal drags pan the SVG', () => {
    const { container, vb } = setup({ cooperativeTouch: true })
    fireTouch(container, 'touchstart', [{ clientX: 100, clientY: 100 }])
    const move = fireTouch(container, 'touchmove', [{ clientX: 180, clientY: 102 }])
    // 80px right on an 800px-wide viewport over an 800-unit box → x pans by -80
    // (and the slight 2px downward drift pans y by -2 — 'h' lock gates which
    // gestures pan, it doesn't zero the other axis mid-pan).
    expect(vb()).toBe('-80 -2 800 500')
    expect(move.defaultPrevented).toBe(true)
  })

  it('cooperative mode: the axis lock is sticky for the whole gesture', () => {
    const { container, vb } = setup({ cooperativeTouch: true })
    fireTouch(container, 'touchstart', [{ clientX: 100, clientY: 100 }])
    fireTouch(container, 'touchmove', [{ clientX: 102, clientY: 180 }]) // locks 'v'
    // Later the finger moves mostly horizontally — still a page scroll.
    fireTouch(container, 'touchmove', [{ clientX: 300, clientY: 185 }])
    expect(vb()).toBe('0 0 800 500')
  })

  it('cooperative mode: two-finger pinch zooms the SVG, never the page', () => {
    const { container, zoom } = setup({ cooperativeTouch: true })
    fireTouch(container, 'touchstart', [
      { clientX: 300, clientY: 250 },
      { clientX: 500, clientY: 250 },
    ])
    const move = fireTouch(container, 'touchmove', [
      { clientX: 200, clientY: 250 },
      { clientX: 600, clientY: 250 },
    ])
    expect(zoom()).toBeCloseTo(2, 5) // spread doubled: 200px → 400px
    expect(move.defaultPrevented).toBe(true)
  })

  it('touchcancel resets the gesture (no stale drag, fresh axis lock)', () => {
    const { container, vb } = setup({ cooperativeTouch: true })
    fireTouch(container, 'touchstart', [{ clientX: 100, clientY: 100 }])
    fireTouch(container, 'touchmove', [{ clientX: 102, clientY: 180 }]) // locks 'v'
    fireTouch(container, 'touchcancel')
    // A brand-new gesture decides its own axis — horizontal now pans.
    fireTouch(container, 'touchstart', [{ clientX: 100, clientY: 100 }])
    fireTouch(container, 'touchmove', [{ clientX: 180, clientY: 100 }])
    expect(vb()).toBe('-80 0 800 500')
  })
})
