# Cellchaser

Build a weather radar web app called "RadarES" with three data layers, combinable on one map each to hable in a menu.

1. Base fallback layer  RainViewer tiles Integrate the RainViewer Maps API (tile endpoint) as a quick-load fallback layer. Note: the free RainViewer tier only returns a single blue reflectivity color scheme — build the layer toggle UI to reflect that (label it "RainViewer (reflectivity, blue only)") rather than pretending it's multi-scheme.

2. Self-hosted alternative — LibreWXR Add support for pointing the app at a self-hosted LibreWXR instance (https://librewxr.net / https://github.com/JoshuaKimsey/LibreWXR) as a drop-in replacement for the RainViewer tile API, since it exposes the same tile URL scheme but pulls from EUMETNET OPERA and other government sources without the color/zoom restrictions. Let the user configure their LibreWXR base URL in settings, and fall back to public RainViewer if none is set.

3. Raw station data — EUMETNET OPERA / ORD API This is the core feature: a clickable map of individual European radar stations (starting with AEMET/Spain stations, ISO country code 724). When the user clicks a radar station marker, open a detail panel that:

Queries the ORD API at https://api.meteogate.eu/eu-eumetnet-weather-radar for that station's location_id

Lets the user switch the displayed product via a dropdown or button group: DBZH (reflectivity), TH (raw reflectivity), VRADH (radial velocity/VRAD), and any other standard_name values available for that specific station (not all stations will have all products — query availability and only show what exists)

Supports selecting elevation/tilt (level parameter) and a time range (datetime parameter), defaulting to the latest scan

Renders returned ODIM/HDF5 data as a radar image on the map (reflectivity/velocity color scale should switch automatically based on selected product)

Shows a small note when a product isn't available for that station (e.g. "VRAD not published for this radar") rather than failing silently

No API key needed for OPERA — anonymous access works but is rate-limited; add a settings field for an optional Meteogate API key for heavier use.

Keep the UI simple: map on the left/full-screen, layer toggle (RainViewer / LibreWXR / OPERA raw stations) at top, and station click opens a bottom sheet or side panel with the product switcher.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cellchaser.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/88dbce52-53e6-4bed-b307-5142b19c0c5e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
