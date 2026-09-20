/** Vercel serverless — ERP Assistant + AI tools. Set XAI_API_KEY in Vercel env. */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'Method Not Allowed' }); return; }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    res.status(200).json({ ok: false, error: 'AI is not available in this environment' });
    return;
  }

  let body = {};
  try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { res.status(400).json({ ok: false, error: 'Invalid JSON' }); return; }

  const title = String(body.title || '').slice(0, 80);
  const raw = body.fields && typeof body.fields === 'object' ? body.fields : {};
  const cleaned = {};
  let chars = 0;
  for (const [k, v] of Object.entries(raw)) {
    const key = String(k).slice(0, 40);
    const val = String(v ?? '').slice(0, 1200);
    if (!val.trim()) continue;
    cleaned[key] = val;
    chars += val.length;
  }
  if (chars > 4000) { res.status(200).json({ ok: false, error: 'Input is too long' }); return; }
  const lines = Object.entries(cleaned)
    .filter(([k]) => k.toLowerCase() !== 'language')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  if (!lines) { res.status(200).json({ ok: false, error: 'Fill the required fields' }); return; }

  const lang = cleaned.language || cleaned.Language || 'English';
  const help = /erp assistant/i.test(title);
  const system = help
    ? `You are the Delkor-Fiberk ERP assistant for signed-in staff in Ghana. Answer with short facts. Prefer live desks over Fiberkapp migrated books. Name the left-menu path to open. No preamble. Language: ${lang}.`
    : `You write short commercial copy for Delkor-Fiberk Group (Ghana). No preamble. Language: ${lang}.`;

  try {
    const r = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'grok-4.5',
        max_tokens: help ? 280 : 400,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Tool: ${title || 'Copy'}\n${lines}` },
        ],
      }),
    });
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || '';
    if (!r.ok) {
      res.status(200).json({ ok: false, error: 'xAI API error ' + r.status });
      return;
    }
    res.status(200).json({ ok: true, text });
  } catch (err) {
    res.status(200).json({ ok: false, error: String(err?.message || err) });
  }
};
