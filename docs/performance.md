# 500-bird check

Measured on 2026-10-31 using the installed macOS browsers: Chromium 151.0.7922.34 and WebKit 26.5. Layout was 390×844 CSS pixels, DPR 3, mobile/touch emulation. This is a short Mac-hosted comparison, not a physical iPhone benchmark or a guarantee for all phones.

| Model | Chromium | Chromium, 4× CPU throttle | WebKit |
|---|---:|---:|---:|
| 200 birds, original scan | 120 fps | 120 fps | 60 fps |
| 500 birds, original scan | 120 fps | 49.6 fps | 60 fps |
| 500 birds, spatial grid | 120 fps | 68.6 fps | 59.8 fps |

The original 500-bird throttled run had a 31.5 ms p95 frame interval and 17.7% of intervals above 25 ms. The grid reduced those to 23.3 ms and 1.65%. The throttled grid run sampled 425 frame intervals over about 6.2 seconds. Unthrottled Chromium and WebKit p95 intervals were 9.3 ms and 19 ms respectively; their frame scheduling differs.

All runs warm up, then perform the same taps and drag workload. Chromium uses native touch protocol events; WebKit uses native taps and a mouse drag in the phone layout. Timing hooks measure the full app's animation intervals, simulation steps and drawing. Only the test response is instrumented. Four contacts per run also measure event receipt to the next sampled frame with visible feedback style: the largest observed value was 35.4 ms in the throttled 500-bird grid run. This is not hardware-to-display touch latency, and four samples are not a latency distribution.

Run the current comparison with a local server and `PLAYWRIGHT_MODULE=/path/to/playwright node tests/performance.cjs`. Results are written to ignored `test-results/performance/`. The pre-grid numbers were retained during implementation before replacing the all-pairs scan.

The grid's cell width equals the 100-unit neighbour radius, so each bird inspects its cell and eight adjacent cells. Steering rules, force limits and speed limits are unchanged. Independent comparison against the original scan across 30 viewport/seed cases and ten steps agreed within 1.19e-13; accumulation order can differ by floating-point rounding.

Verification also covers exact 30/120 fps replay at 500 birds, two simulated minutes with repeated touch perturbations, native tap visibility, and About focus/reading-pause behavior in both browsers. Native iPhone long-press behavior remains unverified by desktop WebKit.
