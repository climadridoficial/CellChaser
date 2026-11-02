# Radar scan corrections
- [x] Separate OPERA access errors from absent radar transmission in composite, individual panel and static catalogue; preserve only fresh OPERA images and never trigger automatic OpenData for access errors.
- [x] Share OPERA metadata and volume downloads across users, radar views and storm jobs; database leases, credential-isolated cache and provider cooldowns applied. Twelve tests pass; real preview has no direct browser ORD requests, honors current 429 cooldown, and renders map without errors. Successful live OPERA reuse remains blocked by upstream 429; published hosts need updated code.
- [x] Keep neighbouring radars' composite echoes visible when a station is opened (applies to every radar); verified San Sebastián keeps all 14 overlays.
- [x] Fix single-digit lightning period days and explicit NOV glyphs; real 2 Nov GIF and both preview/CellChaser.com show the overlay and six UTC intervals. Prediction legend renders on both; current shared frames can be empty/incomplete, not a missing control.
- [x] Investigate Gran Canaria VRAD: stored 13:57 OPERA advisory has 95% coverage, while 14:00 DBZH has no exact-time VRAD (short/long scans differ by three minutes). Preserve exact-time/elevation policy; additionally fix DBZH-filtered discovery excluding velocity-only files. 29 tests pass; scheduled ingest change still needs publishing on its existing host.
- [x] Fix Worker-incompatible OPERA downloads and separate AEMET processing failures from source outages; 35 tests pass, authenticated jobs succeed, and Gran Canaria's real 16:20 UTC cone/advisory renders without browser errors. Published schedules still need the corrected code published.
- [x] Correct elevation availability using actual product/range/time files; missing angles do not trigger AEMET fallback. Sixteen tests pass; real Sierra Fuentes 1.5° short-range and 2.1° long-range scans verified in the browser.
- [x] Fix single-digit AEMET footer days; real Valencia, Málaga and Gran Canaria 1 Nov images now read 12:10 UTC (test added).
- [x] Replace priority credentials 1 and 2 individually and save credential 3 securely; implement priority rotation before older backups.
- [x] Verify priority ordering (3 tests), successful live lightning GIF (200), and radar handling: Valencia/Málaga currently return no fresh/readable observation (204), not credential failure.
- [x] Explain that saved credential values cannot be displayed again; only their configured names can be listed.
- [x] Restore all fifteen AEMET radar markers during OPERA discovery failure; verified against a real 429 outage and twelve passing tests.
- [x] Shared rule-based storm advisories without AI charges, persisted with VRAD coverage and printed lightning intervals; three-scan motion retained. 39 tests passed; isolated popup browser-tested; authenticated OPERA run saved real frames for three radars.
- [ ] Verify positive VRAD/lightning evidence on a fresh real storm — Gran Canaria's real cone and DBZ-only advisory verified; current evidence has no usable VRAD/lightning.
- [x] Verify lightning age legend below the unchanged radar key and crosshair lightning reading; real strike inspected and age/geometry tests passed.
- [x] Fix lightning movement during zoom and add original-image four-corner alignment; signed-in corner stretching, rotation, saving and reloading verified.
- [x] Correct forecast rendering to preserve clean four-corner widening cones; direction tests and map-edge rendering verified.
- [x] Harden false-echo detection and turning forecasts, with regression tests.
- [x] Move real tracking to shared server computation, independent of composite visibility; actual 15 AEMET / 10 OPERA ingest and matching desktop/mobile observations verified.
- [ ] Activate updated automatic shared tracking on the published app — waits for user-requested publishing.
- [x] Add and verify temporary simulated storm playback, including intensity changes and closing the demo.
- [x] Completely remove the temporary demo after the user confirms they have finished reviewing it.
- [x] Storm-cell scan dots, traces and intensity-updating 30-minute forecast shapes; tests and a controlled browser storm verified.
- [x] Add remembered language selection and translate visible radar controls into English, Spanish, Portuguese, Catalan, Galician and Basque; all six switches and Portuguese persistence verified in the browser.
- [x] Hide outdated/down-source scans in live mode across AEMET/OPERA views; preserve history (14 tests passed; simulated old AEMET images verified live → history → live).
- [x] Correct raw scan range and map projection.
- [x] Load selected products and remove stale scans during changes.
- [x] Test decoding and verify real station product switching.

# Manual AEMET overlays
- [x] Add semi-transparent dragging and corner resizing on the map.
- [x] Save per-radar alignments privately with Cloud sign-in.
- [x] Extract echo colours, refresh every 10 minutes, and apply saved alignments.
- [x] Test alignment, masking, and map controls on a live Murcia image.
- [x] Verify signed-in saving/reloading (all 15 radars aligned and saved).
- [x] Disable alignment tools (kept for later) and bake the alignments in.

# Spain radar composite
- [x] OpenData images on the map by default.
- [x] Modes: only OpenData, OPERA else OpenData, only OPERA, off.
## Time slider
- [x] Diagnose OpenData composite slider: UI selects the hour correctly, but all archive rows stop at 31 Oct 23:50 UTC; published day-1 parser still rejects scans (Gran Canaria published 204 vs local 200 at 12:30 UTC); seven timestamp/timeline tests pass.
- [ ] Resume and verify OpenData archive and real slider playback after publishing the existing single-digit date correction; today's missing images cannot be recovered from the latest-only OpenData feed.
- [x] 6 h history slider, 10-min steps, play/pause, "En directo"
- [x] OPERA composite + station panel follow the slider
- [x] AEMET archive (every 5 min) + footer timestamp reading
- [x] Footer digits 4, 5, 8 solved from publishing lag until real glyphs are captured

# First-visit intro video
- [x] Show uploaded intro video (3s, 16:9) to first-time visitors, skippable, remembered via localStorage
