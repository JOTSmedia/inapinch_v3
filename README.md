# IN A PINCH · V3

**24 themed cities. 27,431 mapped places. One less thing to worry about.**

V3 is an independent website in the `v3` folder. V1 and V2 are preserved.

## Preview and upload

- Double-click **OPEN_ME.html** for the portable preview. Keep the adjacent `assets` folder. Its bundled directory is compressed and decoded locally; a modern browser with DecompressionStream support is needed. Maps, fonts, and new venue discovery require internet access.
- For a normal local preview, run `python3 -m http.server 8080` inside this folder, then open `http://localhost:8080`.
- For GitHub Pages, upload the **contents** of `IN_A_PINCH_V3_GITHUB_UPLOAD`, retaining all subfolders. `index.html` must be directly at the root. Choose **Settings → Pages → Deploy from a branch → main → /(root)**.
- To retain the previous website, upload this whole directory as `/v3/` and visit `/v3/`.
- **No map API key, account, token, billing setup, or environment variable is required.** MapLibre, its Leaflet binding, and Leaflet are bundled locally. OpenFreeMap supplies the public vector geography.

## What changed

- Restaurant/bar coverage expands from 292 starter listings to **27,431 mapped places**, including restaurants, bars, pubs, cafés, beer gardens, fast food, food halls, nightclubs, and mapped restroom points.
- All 24 cities have at least 200 bundled listings. NYC has 5,900, San Francisco 2,837, Chicago 1,958, and Austin 976.
- The default Wireframe map now styles **actual roads, parks, water, buildings, rail lines, and neighborhood labels**. It uses original city palettes inspired by the cartographic poster approach of Terraink. It no longer relies on a grid over a recolored raster map. City mode provides a lighter treatment. Each destination has its own palette and map identity.
- At neighborhood zoom, panning discovers additional mapped venues beyond the bundled areas. **Explore more** zooms into neighborhood detail. Discovered places are deduplicated and optionally retained in this browser’s IndexedDB. Only public venue coordinates are cached; the user’s own location is not saved.
- The list renders 60 places at a time with **Show 60 more**. Searches, filters, sorting, result counts, and map pins use the full loaded directory.
- Numbered, access-coded markers match the list. Filters, saved stops, detail panels, walking directions, current-location startup, and all 24 selectable cities are retained.
- Restaurant/bar listings open Google Maps business searches using the name and address, or the name and mapped coordinates when the source does not supply a street address. These are searches rather than verified Google Place IDs.

## Coverage and accuracy

This is broad **mapped venue coverage**, not a guarantee that every real restaurant or bar is listed. The bundled snapshots cover central areas of each city; additional places are discovered as neighborhoods are explored. `data/coverage.json` records the shipped city totals and source scope.

The public vector data snapshot is **November 15, 2026**. Existing authored records keep their own sources and review dates. New records retain the source tile and feature ID. Do not infer that a mapped business offers a public bathroom. Venue bathrooms, fees, hours, changing facilities, and accessibility remain unknown unless supported by the original directory. A mapped restroom point establishes community map evidence, not current access or opening status.

Of the 27,431 listings, **1,404 have documented or community-mapped restroom evidence**. These are not 1,404 verified free bathrooms. The free/public and accessibility filters continue to require the corresponding access facts.

The app can use your location on a fresh visit to select a supported nearby metro area and sort by distance, subject to browser permission. Explicit city and restroom share links preserve their chosen destination. Outside the 24 mapped metro areas, the interface explains the coverage limit instead of inventing nearby results.

## City lineup

| City | Bundled places | City theme |
| --- | ---: | --- |
| Key West, FL | 250 | Island time |
| New York City, NY | 5,900 | The city that never stops |
| Miami, FL | 664 | Art Deco afterglow |
| Los Angeles, CA | 861 | Golden-hour state of mind |
| Austin, TX | 976 | Keep it weird |
| San Francisco, CA | 2,837 | A little fog. A lot of character. |
| Chicago, IL | 1,958 | By the lake |
| Seattle, WA | 1,446 | Coffee. Rain. Repeat. |
| New Orleans, LA | 729 | Let the good times roll |
| Nashville, TN | 481 | Music City |
| Boston, MA | 1,469 | History on every corner |
| Washington, DC, DC | 1,600 | A capital idea |
| San Diego, CA | 850 | Stay coastal |
| Portland, OR | 1,213 | Rain. Roses. Relief. |
| Denver, CO | 1,507 | Mile High pit stops |
| Las Vegas, NV | 548 | Neon nights |
| Phoenix, AZ | 394 | Sonoran sunshine |
| Atlanta, GA | 743 | City in the trees |
| Charleston, SC | 386 | Lowcountry charm |
| Savannah, GA | 226 | Under the live oaks |
| Orlando, FL | 284 | Beyond the theme parks |
| Honolulu, HI | 941 | Aloha, relief |
| Dallas, TX | 513 | Big D energy |
| Houston, TX | 655 | Space City |

## Shared ratings

Maps, directories, source links, search, filters, saved stops, and directions work on static hosting. Shared ratings require the included server and D1 database. The server allowlist includes the shipped directory. Newly discovered places do not offer shared ratings until they appear in a published snapshot. Ratings are not fabricated when a server is unavailable.

See `README_BACKEND.md` for the original server deployment instructions; its historical Key West counts describe V1.

## Files and maintenance

- `index.html`: production entry.
- `cities.json`: city identity and snapshot counts.
- `data/<city>.json`: complete per-city directory and provenance.
- `locations.json`: compact combined directory index. Full source notes live in the city files.
- `location-ids.json`: compact backend ratings allowlist, regenerated by the frontend preparation script.
- `cartography.js`: 24 original geographic color palettes and MapLibre styles.
- `vector-map.js`: vector basemap integration and viewport venue discovery.
- `venue-data.js`: conservative venue conversion, duplicate protection, and optional discovery cache.
- `street-map.js`: no-key raster fallback for unavailable WebGL/vector rendering.
- `app.js`: map/list behavior, pagination, location, details, and saved stops.
- `scripts/vector-poi.mjs`: reader for the public vector-tile protobuf format.
- `scripts/import-vector-venues.mjs`: refreshes central-area POI snapshots; download limit 47 MiB, no more than three concurrent tile requests. Raw processing files go under ignored `work/`.
- `node scripts/prepare-public.mjs`: stage frontend assets for the server build.
- `node scripts/build-portable.mjs`: regenerate the compressed double-click preview after edits.
- `npm test`: 45 automated checks covering directory consistency, coordinate parsing, source provenance, venue conversion, duplicate protection, city styles, local time, location behavior, business links, portable packaging, and ratings.

Native browser layout verification and the framework build were unavailable under the session’s local preview/network restrictions. The data import, JavaScript syntax, portable bundle, ZIP integrity, and automated checks were verified.
