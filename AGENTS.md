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
