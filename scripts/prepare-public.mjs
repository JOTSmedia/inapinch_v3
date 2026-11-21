import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Root files are the source of truth for both GitHub Pages and the full app.
// Never use the whole repository as a public asset directory.
const root = fileURLToPath(new URL('../', import.meta.url));
const output = join(root, 'public');
const directory=JSON.parse(await readFile(join(root,'locations.json'),'utf8'));
await writeFile(join(root,'location-ids.json'),JSON.stringify(directory.locations.map(place=>place.id))); 
const entries = [
  'index.html',
  'app.js',
  'island-map.js',
  'street-map.js',
  'vector-map.js',
  'cartography.js',
  'venue-data.js',
  'locations.json',
  'logic.js',
  'map-theme.css',
  'ocean.css',
  'ocean.js',
  'ratings.js',
  'styles.css',
  'tropic-theme.css',
  'assets',
  'cities.json',
  'city-guide.js',
  'city-theme.css',
  'data',
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await Promise.all(entries.map(entry => cp(join(root, entry), join(output, entry), { recursive: true })));
console.log('Prepared frontend files in public/. Edit the repository root files.');
