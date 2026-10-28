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
- Radars missing from OPERA appear as AEMET-only stations and show the regional backup in the panel; AEMET image map placement uses the fixed calibration in src/lib/aemet-calibration.ts (copied from the owner's saved manual alignments) because the GIF lacks published pixel bounds.
- The manual alignment UI stays in the codebase behind AEMET_ALIGNMENT_ENABLED instead of being deleted; it may be re-enabled to recalibrate, after which the calibration constants must be re-copied.
- The Spain radar composite chooses a source per radar via compositeSource() in src/lib/composite.ts and hides tile layers while active; OPERA composite scans render at a reduced canvas size because ten decodes run at once.
- AEMET alignment and echo display share the same validated image crop and Leaflet bounds; this preserves manual registration across image refreshes without inventing geographic precision.
- Store radar alignments per authenticated user and radar code in Cloud with owner-scoped RLS; no anonymous writes or browser-only durable calibration storage.
- AEMET echo masking preserves original echo colours and only conservatively removes thin shared-colour linework; never use generative image editing for measured weather data.
- Keep lazy map loading inside its own error boundary with explicit reload recovery; stale preview module failures must not blank the entire radar app.
