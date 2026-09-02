# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-09-02

### Added

- **`isPanning`** on the hook's returned API — `true` while the user is
  actively dragging the canvas. The drag lives entirely inside imperative
  listeners, so consumers previously had no way to observe it; the obvious use
  is drag styling, but a "don't animate while dragging" guard reads the same
  flag. It is de-duped against a ref, so a touchmove stream cannot queue a
  render per frame.

  With `cooperativeTouch` it stays `false` until a one-finger gesture locks to
  the horizontal axis: a vertical swipe is a page scroll, not a pan, and
  reporting it as one would flash the drag styling every time someone scrolls
  past the canvas. It is also `false` during a two-finger pinch — that is a
  zoom.

### Fixed

- **`<PanZoomSvg>` now shows `cursor: grabbing` while dragging.** It pinned
  `grab` for the whole lifetime of the canvas, so a drag gave no cursor
  feedback at all.
- **`<PanZoomSvg>` no longer shows a grab cursor when `pan={false}`.** A grab
  cursor on a canvas that cannot be dragged promises an interaction that does
  not exist. An explicit `style.cursor` still wins in both cases.

## [0.2.0] - 2026-06-12

### Added

- **`cooperativeTouch` option** — axis-locked one-finger gestures for canvases
  embedded in scrollable pages: horizontal drags pan the SVG, vertical swipes
  fall through to native page scroll, and two-finger pinch always zooms the
  SVG (never the page). Battle-tested on a production ERP whose full-width
  dimension-comparison canvas was a mobile scroll trap without it. Opt-in;
  default behavior is unchanged.
- `<PanZoomSvg>` sets `touch-action: pan-y pinch-zoom` automatically when
  `cooperativeTouch` is enabled (`none` otherwise, as before).

### Fixed

- **Stale drag state after `touchcancel`** — when the browser claims a gesture
  (e.g. it starts a native scroll), the hook now resets its pan/pinch tracking.
  Previously the next touch could resume a phantom drag.

## [0.1.0] - 2026-05-27

### Added

- `usePanZoomViewBox` — headless pan & zoom for an SVG via its `viewBox`:
  cursor-anchored wheel zoom, drag-to-pan, one-finger pan and two-finger pinch,
  programmatic `zoomBy` / `setZoom` / `reset` / `setViewBox`, and an `onChange`
  callback. Imperative listeners bind once and read live state from a ref, so
  fast wheel/pinch deltas are never dropped.
- `PanZoomSvg` — a thin, mostly-unstyled component wrapper with a `controls`
  render prop and an imperative `ref` API.
- `resolveLabelOverlap` — pure 1-D label de-overlap solver (weighted pairwise
  relaxation) for chart axes, dimension rulers, and timelines.
- Full TypeScript types, dual ESM/CJS builds, and zero runtime dependencies.

[0.2.0]: https://github.com/therealsunson/react-viewbox-panzoom/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/therealsunson/react-viewbox-panzoom/releases/tag/v0.1.0
