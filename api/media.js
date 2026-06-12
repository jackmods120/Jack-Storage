// api/media.js — Telegram File Proxy + info endpoint
// چارەسەر: ئەگەر file_path پێدرا، ڕاستەوخۆ URL دروست دەکرێت
// بەبێ getFile — بۆیە سنووری 20MB کێشەی نییە
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  const { id, redirect, info, fp } = req.query;
  // id  = file_id  (هەمیشە پێویستە)
  // fp  = file_path ی ذەخیرەکراو (ئەختیاری — بۆ فایلی گەورە)
  if (!id) return res.status(400).json({ error: 'file_id required' });

  try {
    let fileUrl  = '';
    let filePath = '';

    // ── ئەگەر file_path ی ذەخیرەکراو هەیە، ڕاستەوخۆ بەکاری بهێنە ──
    if (fp && fp.trim() !== '') {
      filePath = fp.trim();
      fileUrl  = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    } else {
      // ── ئەگەرنا getFile بەکاری بهێنە (بۆ فایلی بچووکتر لە 20MB) ──
      const infoRes  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${id}`);
      const infoData = await infoRes.json();
      if (!infoData.ok) return res.status(404).json({ error: 'File not found' });
      filePath = infoData.result.file_path;
      fileUrl  = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
    }

    // ── info=1 → URL ی ڕاستەوخۆ بگەڕێنەوە (بۆ DownloadManager) ──
    if (info === '1') {
      return res.status(200).json({ ok: true, url: fileUrl, file_path: filePath });
    }

    // ── redirect=1 → ڕاستەوخۆ بەرەو Telegram ──────────────────────
    if (redirect === '1') {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.redirect(302, fileUrl);
    }

    // ── proxy mode (بۆ فایلی بچووک) ──────────────────────────────────
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) return res.status(502).json({ error: 'Fetch failed' });

    const contentType = fileRes.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await fileRes.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Length', arrayBuffer.byteLength);
    return res.send(Buffer.from(arrayBuffer));

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
