# Third-party notices

## Map data

Map geometry and some venue listings use OpenStreetMap data, © OpenStreetMap contributors, available under the Open Database License (ODbL). Preserve the visible attribution and source metadata when redistributing the map or database.

- https://www.openstreetmap.org/copyright
- https://opendatacommons.org/licenses/odbl/1-0/

Public-facility information links to its sources in `public/locations.json`.

## Map libraries

- Leaflet 1.9.4: BSD 2-Clause license. https://github.com/Leaflet/Leaflet
- Leaflet.markercluster: MIT license. https://github.com/Leaflet/Leaflet.markercluster

The corresponding license texts are included under `licenses/`. Other npm dependencies retain their own upstream licenses and are installed from `package-lock.json`.

## Fonts

The app loads Poiret One, Barlow Condensed, and Outfit from Google Fonts. Font files are not bundled in this export. Their upstream font-family repositories contain their licensing terms.

## Photos and video

The palm photo and the video footage were supplied by the project owner in the app-design conversation. This export does not grant additional rights to those media. `public/assets/video-sources.json` describes the source and edit selections.

## Street-map tile service

Cities other than Key West load OpenStreetMap Standard raster tiles from https://tile.openstreetmap.org. No key is needed. Preserve visible OpenStreetMap attribution and normal HTTP caching; do not bulk-download or prefetch tiles. Service policy: https://operations.osmfoundation.org/policies/tiles/.

## V3 vector maps and venue data

- MapLibre GL JS 5.6.1, BSD 3-Clause: https://github.com/maplibre/maplibre-gl-js . The upstream license is bundled in `assets/maplibre-LICENSE.txt`.
- MapLibre GL Leaflet binding 0.1.4, ISC: https://github.com/maplibre/maplibre-gl-leaflet . Its license is bundled in `assets/maplibre-leaflet-LICENSE.txt`.
- Vector tile hosting: OpenFreeMap, https://openfreemap.org/ . Schema: OpenMapTiles, https://openmaptiles.org/ . Underlying geography and POI data: © OpenStreetMap contributors, ODbL 1.0. Preserve visible attribution, per-record source metadata, and source provenance when redistributing the directory.
- The central-area POI snapshot was extracted from public vector tiles dated November 15, 2026. The bundled snapshot import used 47,290,379 bytes across 216 tiles, below the published 50 MB / 3,000 tile download ceiling, with no more than three requests in parallel.
- Cartographic palettes and application styles are original IN A PINCH work inspired by Terraink’s poster-map approach. No Terraink source, logo, trademarked branding, or artwork is bundled.
