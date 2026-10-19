(() => {
  const root = document.documentElement;
  const still = /static/.test(location.search);
  if (still) {
    root.classList.add('static');
    if (/bare/.test(location.search)) root.classList.add('bare');
    if (/cut/.test(location.search)) root.classList.add('cut');
    document.querySelectorAll('svg').forEach((s) => { if (s.pauseAnimations) { s.pauseAnimations(); s.setCurrentTime(8.2); } });
    return;
  }
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Brilho laranja que segue o cursor (referência: hero do site do Lando Norris)
  const blob = document.querySelector('.cursor-blob');
  let tx = innerWidth / 2, ty = innerHeight / 2, x = tx, y = ty;
  if (fine && !calm) {
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
    (function loop() { x += (tx - x) * 0.12; y += (ty - y) * 0.12; blob.style.transform = `translate(${x}px,${y}px)`; requestAnimationFrame(loop); })();
  }

  // Celulares inclinam em 3D na direção do cursor
  document.querySelectorAll('.shot').forEach((shot) => {
    const phone = shot.querySelector('.phone');
    if (!fine || calm) return;
    shot.addEventListener('pointermove', (e) => {
      const r = shot.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      phone.style.setProperty('--ry', `${px * 14}deg`);
      phone.style.setProperty('--rx', `${-py * 10}deg`);
    });
    shot.addEventListener('pointerleave', () => { phone.style.setProperty('--ry', '0deg'); phone.style.setProperty('--rx', '0deg'); });
  });

  // Botões magnéticos
  document.querySelectorAll('.cta').forEach((b) => {
    if (!fine || calm) return;
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.08}px,${(e.clientY - r.top - r.height / 2) * 0.2}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });

  // Cronômetro da corrida ao vivo
  const t = document.querySelector('.time');
  let s = t ? t.textContent.split(':').reduce((a, v) => a * 60 + Number(v), 0) : 0;
  if (t && !calm) setInterval(() => { s++; t.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 1000);
})();
