// Aplica el tema antes de pintar para evitar parpadeo. Archivo aparte (no en línea) para
// que la CSP pueda prohibir scripts en línea.
(function () {
  var t = 'system';
  try {
    t = localStorage.getItem('svi.tema') || 'system';
  } catch (e) {}
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
})();
