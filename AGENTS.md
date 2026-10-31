<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use the public OpenStreetMap standard tiles for the background map; this avoids CARTO's API-key-required placeholder tiles.
- Normalize ODIM range units by the file's declared convention and render onto a Mercator pixel grid using measured azimuths; this preserves scan geography.
- Discover ORD multi-product volumes without parameter filtering, filter coverage quantities locally, and key file/decode state by the current selection; this avoids empty provider filters and stale product images.
- AEMET OpenData is called only server-side via src/lib/aemet-upstream.ts, rotating/retrying across the comma-separated AEMET_API_KEYS secret; AEMET responses are flaky per key and keys must not reach the browser.
- Radars missing from OPERA appear as AEMET-only stations and show the regional backup in the panel; AEMET image map placement uses the fixed four-corner calibration in src/lib/aemet-calibration.ts (copied from the owner's saved manual alignments); outlines are removed in source pixels, then images and storm grids are warped via src/lib/aemet-warp.ts into the corners' enclosing box, because the GIF lacks published pixel bounds.
- The manual alignment UI stays in the codebase behind AEMET_ALIGNMENT_ENABLED instead of being deleted; it may be re-enabled to recalibrate, after which the calibration constants must be re-copied.
- The Spain radar composite chooses a source per radar via compositeSource() in src/lib/composite.ts and hides tile layers while active; OPERA composite scans render at a reduced canvas size because ten decodes run at once.
- AEMET alignment and echo display share the same validated image crop and Leaflet bounds; this preserves manual registration across image refreshes without inventing geographic precision.
- Store radar alignments per authenticated user and radar code in Cloud with owner-scoped RLS; no anonymous writes or browser-only durable calibration storage.
- Reuse the quadrilateral AEMET renderer and alignment editor for lightning with its own source dimensions and the owner-scoped `lightning` calibration key; this keeps corner editing, source cropping and zoom registration consistent without changing radar calibrations.
- Keep lightning calibration tools behind LIGHTNING_ALIGNMENT_ENABLED after calibration and copy the confirmed saved corners into the shared default; strip background and outlines before the same quadrilateral transform so normal viewing retains registration.
- AEMET outline removal uses fixed per-radar outline maps in public/aemet-masks (captured from near-rain-free frames), falling back to the thin-line heuristic if the layout no longer matches; outline pixels over rain take the dominant neighbouring echo colour only, never generative image editing.
- Keep lazy map loading inside its own error boundary with explicit reload recovery; stale preview module failures must not blank the entire radar app.
- One shared time-slider position (null = live, 10-minute slots, src/lib/timeline.ts) drives tiles, the Spain composite and the station panel; every source publishes on that cadence, so frames are matched only within their own slot.
- Apply the shared radar-freshness predicate and periodic expiry checks to composite and station displays; live endpoints never substitute archived frames, preventing cached outage data from appearing live.
- Keep interface translations in the typed i18n catalog and render through LanguageProvider/useI18n; persist language only after hydration so switching does not disturb radar state or server rendering.
- AEMET regional history comes from our own archive (aemet_radar_frames, filled every 5 min by the scheduled /api/public/jobs/aemet-archive route) because OpenData serves only the latest image; frames are labelled with the time read from the GIF footer (src/lib/aemet-timestamp.ts), never the fetch time, since AEMET lags and keeps serving stale images.
- Compute real cells and forecasts centrally during the existing authenticated archive schedule, persist versioned per-radar/source frames in Cloud, and let browsers only read/render shared results independently of composite visibility; this ensures canonical predictions across devices and no per-device radar decoding for tracking. Use numerical OPERA DBZH or calibrated outline-cleaned AEMET categories, spatial core filtering, repeated detections and motion-gated Hungarian association; forecasts are experimental reflectivity extrapolations, never official warnings.
- Render saved storm forecast polygons with Leaflet clipping and simplification disabled so viewport edges cannot add or collapse forecast corners.
- OPERA storm detection runs in its own scheduled route (/api/public/jobs/opera-storms) split into parts across staggered schedules; one request has a limited outbound-call budget, so it must not share the AEMET archive request.
