/** Servidor estático mínimo para o export web (rotas do expo-router viram arquivos .html). Uso: node serve.cjs <dist> <porta> */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };

function serve(root, port) {
  const base = path.resolve(root);
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0]);
    for (const c of [p, `${p}.html`, path.join(p, 'index.html'), '/index.html']) {
      const f = path.join(base, c);
      if (f.startsWith(base) && fs.existsSync(f) && fs.statSync(f).isFile()) {
        res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
        fs.createReadStream(f).pipe(res);
        return;
      }
    }
    res.writeHead(404);
    res.end();
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

module.exports = { serve };

if (require.main === module) {
  const [root, port] = process.argv.slice(2);
  serve(root, Number(port || 8098)).then(() => console.log(`servindo ${root} em http://127.0.0.1:${port || 8098}`));
}
