// MapLibre GL JS 6 runs map work in a module worker that Metro does not bundle.
// Copy it to public/ so the web build serves it at /maplibre-gl-worker.mjs (see territory-map.web.tsx).
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-worker.mjs');
const dest = path.join(__dirname, '..', 'public', 'maplibre-gl-worker.mjs');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
