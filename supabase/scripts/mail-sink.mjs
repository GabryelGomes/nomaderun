// Caixa de e-mail de DESENVOLVIMENTO (substitui o mailpit quando a imagem não pode ser baixada).
// SMTP na porta 1025 (o Auth local envia para supabase_inbucket_<projeto>:1025) e página web na 8025
// (publicada em http://127.0.0.1:54324) com os e-mails recebidos e os links de recuperação de senha.
// Sem dependências: roda com o Node de qualquer imagem. Uso: bash supabase/scripts/mail-sink.sh
import http from 'node:http';
import net from 'node:net';

const messages = [];

function decodeBody(raw) {
  const split = raw.indexOf('\r\n\r\n');
  const headers = split >= 0 ? raw.slice(0, split) : '';
  let body = split >= 0 ? raw.slice(split + 4) : raw;
  const h = (name) => (new RegExp(`^${name}:\\s*(.+)$`, 'im').exec(headers) || [])[1]?.trim() ?? '';
  const enc = h('Content-Transfer-Encoding').toLowerCase();
  if (enc === 'quoted-printable') {
    body = body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, x) => String.fromCharCode(parseInt(x, 16)));
    body = Buffer.from(body, 'latin1').toString('utf8');
  } else if (enc === 'base64') {
    body = Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8');
  }
  const links = [...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  return { subject: h('Subject'), to: h('To'), from: h('From'), date: new Date().toISOString(), body, links };
}

net.createServer((socket) => {
  let data = false;
  let buffer = '';
  let raw = '';
  socket.write('220 nomaderun-mail-sink ESMTP\r\n');
  socket.on('data', (chunk) => {
    buffer += chunk.toString('latin1');
    while (true) {
      if (data) {
        const end = buffer.indexOf('\r\n.\r\n');
        if (end < 0) return;
        raw = buffer.slice(0, end).replace(/^\.\./gm, '.');
        buffer = buffer.slice(end + 5);
        data = false;
        messages.unshift(decodeBody(Buffer.from(raw, 'latin1').toString('latin1')));
        if (messages.length > 50) messages.pop();
        socket.write('250 OK: queued\r\n');
        continue;
      }
      const nl = buffer.indexOf('\r\n');
      if (nl < 0) return;
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 2);
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === 'EHLO') socket.write('250-nomaderun-mail-sink\r\n250 8BITMIME\r\n');
      else if (cmd === 'HELO') socket.write('250 nomaderun-mail-sink\r\n');
      else if (cmd === 'DATA') { data = true; socket.write('354 End data with <CR><LF>.<CR><LF>\r\n'); }
      else if (cmd === 'QUIT') { socket.end('221 Bye\r\n'); return; }
      else socket.write('250 OK\r\n');
    }
  });
  socket.on('error', () => {});
}).listen(1025);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

http.createServer((req, res) => {
  if (req.url?.startsWith('/api/messages')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ messages }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset="utf-8"><title>Caixa de e-mail local — NOMADE RUN</title>
<body style="font-family:sans-serif;max-width:860px;margin:24px auto;padding:0 16px">
<h1>Caixa de e-mail local (desenvolvimento)</h1><p>${messages.length} e-mail(s). Atualize a página para ver novos.</p>
${messages.map((m) => `<section style="border:1px solid #ccc;border-radius:8px;padding:12px;margin:12px 0">
<b>${esc(m.subject)}</b><br><small>para ${esc(m.to)} · ${esc(m.date)}</small>
<ul>${m.links.map((l) => `<li><a href="${esc(l)}">${esc(l)}</a></li>`).join('')}</ul>
<details><summary>Corpo</summary><pre style="white-space:pre-wrap">${esc(m.body)}</pre></details></section>`).join('')}
</body>`);
}).listen(8025);

console.log('mail-sink: SMTP :1025, web :8025');
