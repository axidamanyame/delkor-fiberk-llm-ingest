/** If a page is still on its Loading placeholder with no shell, stop the spin. */
(function (w, d) {
  function stuck() {
    if (d.getElementById('ult-root')) return false;
    if (w.__df_mounting) return false;
    var app = d.getElementById('app');
    if (!app) return false;
    var t = String(app.textContent || '').replace(/\s+/g, ' ').trim();
    return /^Loading/i.test(t) || t.length < 24;
  }
  function paint() {
    if (!stuck()) return;
    var app = d.getElementById('app');
    if (!app) return;
    app.innerHTML = '<div class="ult-card" style="margin:28px auto;max-width:520px;padding:20px">'
      + '<h1 style="margin:0 0 8px;font-size:20px">This screen did not open</h1>'
      + '<p style="color:#475569;line-height:1.45">The last page waited for a session that never arrived. Sign in, then open it from the menu.</p>'
      + '<p style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0">'
      + '<a class="ult-btn ult-btn-primary" href="/login.html">Sign in</a>'
      + '<a class="ult-btn ult-btn-outline" href="/dashboard.html">Home</a>'
      + '<a class="ult-btn ult-btn-outline" href="/dashboard.html">Home</a>'
      + '</p></div>';
  }
  w.addEventListener('unhandledrejection', function (ev) {
    try { console.warn('page rejection', ev.reason); } catch (e) {}
  });
  w.setTimeout(paint, 16000);
})(window, document);
