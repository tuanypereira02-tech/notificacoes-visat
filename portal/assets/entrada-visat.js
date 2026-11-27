(() => {
  const link = document.querySelector('a[data-pagina]');
  if (!link) return;
  const destino = new URL(link.href);
  if (destino.origin !== location.origin) return;
  for (const [nome, valor] of new URLSearchParams(location.search)) destino.searchParams.set(nome, valor);
  if (location.hash) destino.hash = location.hash;
  location.replace(destino.href);
})();
