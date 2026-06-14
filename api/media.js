// api/media.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BOT   = process.env.TELEGRAM_BOT_TOKEN;
  const CH    = process.env.TELEGRAM_CHANNEL_USERNAME || 'jack_storage_apps';
  const OWNER = '5977475208';

  const { id, du, info } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    // ── ١: getFile ئەگەر ≤20MB بوو ────────────────────────
    const r1 = await (await fetch(`https://api.telegram.org/bot${BOT}/getFile?file_id=${id}`)).json();
    if (r1.ok) {
      const url = `https://api.telegram.org/file/bot${BOT}/${r1.result.file_path}`;
      if (info === '1') return res.status(200).json({ ok: true, url });
      return stream(url, res);
    }

    // ── ٢: +20MB — message_id لە du بدۆزەرەوە، forward بکە بۆ PM ─
    const msgId = du ? (du.match(/\/(\d+)$/) || [])[1] : null;
    if (!msgId) return res.status(404).json({ error: 'File >20MB, du param needed' });

    // forward بکە بۆ PM — file_id ی نوێ وەربگرە
    const fwd = await (await fetch(`https://api.telegram.org/bot${BOT}/forwardMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: OWNER, from_chat_id: `@${CH}`, message_id: parseInt(msgId) }),
    })).json();

    if (!fwd.ok) return res.status(502).json({ error: 'forward failed: ' + fwd.description });

    const doc = fwd.result.document || fwd.result.video || fwd.result.audio;
    if (!doc) return res.status(502).json({ error: 'No document in forwarded message' });

    // getFile بەسەر file_id ی نوێ — ئەمجارە کاردەکات چونکە PM file_id جیاوازە
    const r2 = await (await fetch(`https://api.telegram.org/bot${BOT}/getFile?file_id=${doc.file_id}`)).json();
    if (!r2.ok) return res.status(502).json({ error: 'getFile failed: ' + r2.description });

    const url2 = `https://api.telegram.org/file/bot${BOT}/${r2.result.file_path}`;
    if (info === '1') return res.status(200).json({ ok: true, url: url2 });
    return stream(url2, res);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

async function stream(url, res) {
  const r = await fetch(url);
  if (!r.ok) { res.status(502).json({ error: 'CDN error' }); return; }
  const ct = r.headers.get('content-type') || 'application/octet-stream';
  const cl = r.headers.get('content-length');
  res.setHeader('Content-Type', ct);
  res.setHeader('Content-Disposition', 'attachment');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  if (cl) res.setHeader('Content-Length', cl);
  const { Readable } = require('stream');
  Readable.fromWeb(r.body).pipe(res);
}
