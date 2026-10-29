# Radar scan corrections
- [ ] Add storm-cell scan dots, movement traces and intensity-updating forecast quadrilaterals; verify detection, tracking and map controls.
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
- [x] 6 h history slider, 10-min steps, play/pause, "En directo"
- [x] OPERA composite + station panel follow the slider
- [x] AEMET archive (every 5 min) + footer timestamp reading
- [x] Footer digits 4, 5, 8 solved from publishing lag until real glyphs are captured
