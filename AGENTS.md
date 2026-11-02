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
- Discover every ORD quantity/tilt; select actual product/range/time files with the composite policy, preserving manual choices. Only confirmed station-wide absence permits AEMET fallback; access/decoding errors do not. Preserve known OPERA identities during catalogue errors.
- AEMET calls stay server-side in aemet-upstream.ts; accept case-sensitive deployment aliases Opendata1 through Opendata5 with AEMET_PRIORITY_KEY_n fallbacks and rotate priority credentials before comma-separated AEMET_API_KEYS backups, so external deployments retain credential compatibility. Credentials never reach browsers.
- Radars missing from OPERA appear as AEMET-only stations and show the regional backup in the panel; AEMET image map placement uses the fixed four-corner calibration in src/lib/aemet-calibration.ts (copied from the owner's saved manual alignments); outlines are removed in source pixels, then images and storm grids are warped via src/lib/aemet-warp.ts into the corners' enclosing box, because the GIF lacks published pixel bounds.
- Keep a static AEMET location catalog separate from OPERA availability; discovery failures preserve radar markers and fresh OpenData fallbacks, while successful discovery replaces fallback markers without duplicates.
- Keep manual alignment behind AEMET_ALIGNMENT_ENABLED for recalibration; re-copy confirmed calibration constants afterward.
- The Spain radar composite chooses a source per radar via compositeSource() in src/lib/composite.ts and hides tile layers while active; OPERA composite scans render at a reduced canvas size because ten decodes run at once.
- AEMET alignment and echo display share the same validated image crop and Leaflet bounds; this preserves manual registration across image refreshes without inventing geographic precision.
- Store radar alignments per authenticated user and radar code in Cloud with owner-scoped RLS; no anonymous writes or browser-only durable calibration storage.
- Reuse the quadrilateral AEMET renderer and alignment editor for lightning with its own source dimensions and the owner-scoped `lightning` calibration key; this keeps corner editing, source cropping and zoom registration consistent without changing radar calibrations.
- Keep lightning calibration tools behind LIGHTNING_ALIGNMENT_ENABLED after calibration and copy the confirmed saved corners into the shared default; strip background and outlines before the same quadrilateral transform so normal viewing retains registration.
- Lightning inspector inverts the calibrated homography; read the GIF's dated PERIODO before cropping, display UTC clock intervals in the legend and calculate elapsed intervals against current time. Never infer polarity or substitute fetch time for printed time; unreadable periods remain unknown.
- AEMET outline removal uses fixed per-radar outline maps in public/aemet-masks (captured from near-rain-free frames), falling back to the thin-line heuristic if the layout no longer matches; outline pixels over rain take the dominant neighbouring echo colour only, never generative image editing.
- Keep lazy map loading inside its own error boundary with explicit reload recovery; stale preview module failures must not blank the entire radar app.
- One shared time-slider position (null = live, 10-minute slots, src/lib/timeline.ts) drives tiles, the Spain composite and the station panel; every source publishes on that cadence, so frames are matched only within their own slot.
- Apply the shared radar-freshness predicate and periodic expiry checks to composite and station displays; live endpoints never substitute archived frames, preventing cached outage data from appearing live.
- Keep interface translations in the typed i18n catalog and render through LanguageProvider/useI18n; persist language only after hydration so switching does not disturb radar state or server rendering.
- AEMET regional history comes from our own archive (aemet_radar_frames, filled by the scheduled /api/public/jobs/aemet-archive route) because OpenData serves only the latest image; frames are labelled with the time read from the GIF footer (src/lib/aemet-timestamp.ts), never the fetch time, since AEMET lags and keeps serving stale images.
- Compute real cells and forecasts centrally during the existing authenticated archive schedule, persist versioned per-radar/source frames in Cloud, and let browsers only read/render shared results independently of composite visibility; this ensures canonical predictions across devices and no per-device radar decoding for tracking. Use numerical OPERA DBZH or calibrated outline-cleaned AEMET categories, spatial core filtering, repeated detections and motion-gated Hungarian association; forecasts are experimental reflectivity extrapolations, never official warnings.
- Render saved storm forecast polygons with Leaflet clipping and simplification disabled so viewport edges cannot add or collapse forecast corners.
- Share OPERA metadata/volumes through persisted leases and host/credential cooldowns; external hosts without server credentials delegate to the managed cache. Keep staggered storm jobs, validated manual redirects, and source health independent of processing failures.
- Persist deterministic advisory facts inside versioned storm-track JSON during scheduled ingest; browsers translate these shared facts rather than generating independent messages, and all cache readers use storm-version.ts.
- Discover all OPERA quantities before selecting DBZH and exact-time/elevation VRAD, preserving velocity-only files; sample measured coverage and report radial air motion, never replacing three reflectivity motion scans.
- Lightning advisories use calibrated newest-bin source-image pixels and printed UTC intervals, reject future/stale periods, and never report pixel counts as strike counts or infer polarity.
