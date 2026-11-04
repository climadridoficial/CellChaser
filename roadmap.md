# Radar scan corrections
- [x] Make forecast corridors distinguishable with dark/light casing and lower fill; 27 regression tests pass, real 20:10 UTC light/36 dBZ/19 km/h advisory and desktop/mobile rendering checked. Investigation found overlapping fragment areas may inflate merged width; no arbitrary intensity/motion changes applied.
- [ ] Identify the user's exaggerated prediction before changing numerical rules — needs a screenshot or radar/time of the affected storm.
- [x] Restore missing predictions during advisory-only version 5 rollout using fresh compatible version 4 tracks; prefer version 5 including empty detections, preserve expiry/health/history and reject version 3. 42 tests and build OK; real preview displays three forecast polygons and 35 scan dots, real 00:00 UTC popup shows 35 km/h forecast to 01:00 UTC with no runtime errors. Vercel still requires updated deployment; version 5 scheduled reprocessing pending deployment.
- [x] Correct VRAD context association: newest measured same-elevation Doppler 0–5 minutes earlier, real timestamp/coverage retained, future/stale scans rejected, reflectivity motion unchanged. 63 tests and controlled browser comment pass; build OK. Real stored Barcelona-region esgld results confirm 98–99% VRAD at 21:47 discarded at 21:50 under version 4. Version 5 needs updated deployment and scheduled reprocessing; fresh end-to-end ingest remains unverified.
- [x] Correct reproduced intensity inflation when merging fragments: area-weighted upper-decile replaces hottest-fragment maximum, preserving real stronger regions and weakening on new scans; version 4 forces shared reprocessing. 38 tests pass and build OK. The user's specific past storm and Vercel deployment remain unverified; updated schedule must process new-version frames.
- [x] Diagnose Barcelona VRAD: real 21:17 storm frame has 96% measured coverage (-2.2 m/s), whereas 21:20 long-range DBZH has no same-time VRAD; confirmed current OPERA metadata. Clarify the generic unavailable comment across languages without mixing observation times; 42 tests pass and the real Barcelona 21:20 popup displays the corrected explanation. Vercel needs an updated deployment.
- [x] Fix Vercel-only individual OPERA errors despite successful composite: all OPERA panels share their own composite scan/history, preserving all quantities, manual selection and expiry. 34 tests pass; controlled Madrid browser check confirms identical image, no duplicate discovery or false error, products preserved and composite restored on close. Direct Vercel verification awaits deployment URL and updated deployment.
- [x] Preserve every advertised z-axis elevation in Valladolid/San Sebastián discovery; 26 tests pass and controlled browser selectors expose five enabled angles with manual selection. Long-range defaults unchanged. Current upstream angles and rendered-image switching remain unverified.
- [x] Increase Valladolid/San Sebastián shared images from 800 to 1600 pixels and distinguish cached elevations; 38 tests and mobile checks pass. Matched 18:10 long-range files are byte-identical to RadarSpain; its decoder maps undetect to -32 dBZ, ours keeps it transparent. Resolution alone does not prove screenshot parity; Vercel deployment unverified.
- [x] Remove the OPERA display cutoff below -15 dBZ and extend inspector/legend; 36 tests and controlled mobile checks through the real renderer preserve -25 dBZ echoes and no-data transparency for both stations. Matched live scans from other apps remain unverified.
- [x] Default Valladolid/San Sebastián to measured long-range scans in composite/history and individual views; 27 tests and controlled mobile checks verify long selected and manual short available. Current upstream availability and Vercel deployment not verified.
- [x] Rebuild Valladolid/San Sebastián opening around the exact composite image/candidate and shared discovery. Seventeen tests and controlled mobile checks confirm identical image URLs on opening, other radars hidden, and both manual ranges working. Live upstream parity not checked.
- [x] Correct Valladolid/San Sebastián range selection using measured ODIM distance, not velocity-product presence; 15 tests and controlled mobile checks verify long=240 km and short=120 km for both. Live upstream files not re-requested.
- [x] Replace misleading total-load warnings with source-specific and partial-update warnings; 18 tests pass and controlled browser check confirms five loaded radar layers plus partial warning. Vercel deployment not directly verified.
- [x] Enable individual long-range selection for San Sebastián and Valladolid; 13 tests pass and controlled desktop/mobile checks confirm enabled selection without relabelling short scans. Current upstream long-range availability is not verified.
- [x] Place individual OpenData backup/manual image on map with saved calibration; intercepted real GIF confirms one loaded overlay and cleanup on close. Cached metadata proves essse/eslid long-range links exist; current availability remains unverified without upstream requests.
- [x] Reduce automatic OPERA browser polling to once per ten minutes; disable immediate retries/focus/reconnect refetches. Eleven tests pass; intercepted browser clock verifies no additional calls at one minute and the next cycle at ten minutes, without upstream traffic.
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
