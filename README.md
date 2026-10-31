# Dusk

A quiet, browser-only evening with 200 birds. Brush the sky with a finger or pointer; the flock parts, turns, and gathers again. Pause holds the scene still. Reset restores the seeded flock.

## Local preview

No dependencies or build step are required. With Node.js installed, run `npm start` and open http://127.0.0.1:43179. The development server binds only to this computer. Another port can be selected with `PORT=43200 npm start`.

For a single-file preview that can be opened directly without a server, run `node scripts/build-preview.js` and open `test-results/Dusk.html`. This file contains the same CSS and simulation as the modular source.

The page is static and uses relative asset URLs, so its source files can later be hosted on GitHub Pages. Nothing has been published and no remote repository has been created.

## Model and timing

This is a simplified behavioural model inspired by [Craig Reynolds’ boids](https://www.red3d.com/cwr/boids/), using local separation, alignment and cohesion, plus predictive pointer avoidance, a gentle changing goal and soft boundary steering. It is an expressive approximation, not a biological model. Each bird has an individual position and velocity; the flock is not a prerecorded animation. Body heading, bank and independent wing phase follow simulated motion.

Simulation advances at a fixed 120 Hz with a seeded initial state and interpolated drawing. The clock caps an interrupted frame at 100 ms and discards the residual on pause/visibility changes, preventing a large catch-up jump. Reduced-motion preference starts the scene paused and can be explicitly resumed. Pointer cancellation, lost capture, page hiding and window blur clear the interaction. Touch gestures on the canvas do not scroll the page.

## Verification

`npm test` checks identical full-state trajectories at one-second checkpoints for the same seeded gesture at 30 and 120 render frames per second, deterministic reset, resize, bounded speeds, pointer response, pause-gap handling, and two simulated minutes of numerical stability and regrouping.

For browser checks, install Playwright as a development tool, start the local server, and run `node tests/browser-qa.cjs`. An existing Playwright module can be selected with `PLAYWRIGHT_MODULE=/absolute/path/to/playwright`. Screenshots are saved under ignored `test-results/browser/`.

Browser QA was run with locally installed Playwright in Chromium and WebKit at iPhone 13 emulated and desktop sizes. It checks loading, canvas bounds, no scroll, pause/resume/reset, touch or pointer interaction, reduced motion, landscape resizing and page errors. Chromium uses native protocol touch-drag/cancel and two-finger events. The available WebKit automation API exposes native tap only; its additional drag/cancel and two-finger lifecycle checks use synthetic pointer events backed by a captured native mouse pointer. These exercise application handlers, not native WebKit touch dispatch. It is emulation, not a physical iPhone test. Cross-engine floating-point trajectories are not asserted identical.

No accounts, network calls, analytics, audio or external assets are used by the experience.
