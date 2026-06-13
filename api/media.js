// api/media.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
  const CHANNEL     = process.env.TELEGRAM_CHANNEL_USERNAME || 'jack_storage_apps';
  const OWNER_CHAT  = '5977475208';

  const { id, info, du } = req.query;
  if (!id) return res.status(400).json({ error: 'file_id required' });

  try {
    // ── هەوڵ ١: getFile (کاردەکات بۆ ≤20MB) ──────────────────────
    const gf1 = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${id}`);
    const gd1 = await gf1.json();

    if (gd1.ok) {
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${gd1.result.file_path}`;
      if (info === '1') return res.status(200).json({ ok: true, url: fileUrl });
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.redirect(302, fileUrl);
    }

    // ── هەوڵ ٢: فایل گەورەیە (+20MB) — message_id لە du بدۆزەرەوە ──
    let messageId = null;
    if (du) {
      const m = du.match(/\/(\d+)$/);
      if (m) messageId = parseInt(m[1]);
    }

    if (messageId) {
      // forwardMessage بۆ owner PM — ئینجا file_id ی نوێ وەردەگرێت
      const fwdRes  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/forwardMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:      OWNER_CHAT,
          from_chat_id: `@${CHANNEL}`,
          message_id:   messageId,
        }),
      });
      const fwdData = await fwdRes.json();

      if (fwdData.ok) {
        const msg       = fwdData.result;
        const newFileId = msg.document?.file_id || msg.video?.file_id || msg.audio?.file_id || '';

        if (newFileId) {
          const gf2 = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${newFileId}`);
          const gd2 = await gf2.json();

          if (gd2.ok) {
            const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${gd2.result.file_path}`;
            if (info === '1') return res.status(200).json({ ok: true, url: fileUrl });
            res.setHeader('Cache-Control', 'public, max-age=3600');
            return res.redirect(302, fileUrl);
          }
        }
      }
    }

    // ── پاشەکەوت: t.me لینک ──────────────────────────────────────
    if (du) {
      res.setHeader('Cache-Control', 'no-cache');
      return res.redirect(302, du.trim());
    }

    return res.status(404).json({ error: 'File not found' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
