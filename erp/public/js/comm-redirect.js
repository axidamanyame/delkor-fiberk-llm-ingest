/** Pull an old Communications / Essentials URL onto the color hub without a reload. */
export function pullIntoCommunications(defaultTab) {
  const q = new URLSearchParams(location.search);
  if (!q.get('tab') && defaultTab) q.set('tab', defaultTab);
  const qs = q.toString();
  const next = '/communications.html' + (qs ? '?' + qs : '');
  try {
    if (location.pathname.split('/').pop() !== 'communications.html') {
      history.replaceState({ spa: next }, '', next);
    }
  } catch { /* ignore */ }
  return next;
}
