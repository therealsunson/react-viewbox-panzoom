# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
