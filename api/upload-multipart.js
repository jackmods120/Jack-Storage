// api/upload-multipart.js — Fixed version with proper timeout handling

module.exports.config = {
  api: { bodyParser: false, responseLimit: false },
};

const https = require('https');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
  const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
  if (!BOT_TOKEN || !CHANNEL_ID) {
    return res.status(500).json({ error: 'Bot token or channel not configured' });
  }

  const contentType = req.headers['content-type'] || '';
  const bMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!bMatch) return res.status(400).json({ error: 'No boundary' });
  const boundary = bMatch[1];

  // ── بخوێنە بۆ RAM ────────────────────────────────────────
  const chunks = [];
  let totalSize = 0;
  const MAX = 50 * 1024 * 1024; // 50MB سنوور (Vercel free limit)

  // ── Global timeout: 55 چرکە (پێش Vercel 60s limit) ───────
  let finished = false;
  const globalTimer = setTimeout(() => {
    if (!finished) {
      finished = true;
      try { res.status(504).json({ error: 'Upload timeout - try a smaller file' }); } catch(e) {}
    }
  }, 55000);

  req.on('data', chunk => {
    totalSize += chunk.length;
    if (totalSize > MAX) {
      req.destroy();
      if (!finished) {
        finished = true;
        clearTimeout(globalTimer);
        return res.status(413).json({ error: 'File too large (max 50MB on free plan)' });
      }
      return;
    }
    chunks.push(chunk);
  });

  req.on('error', err => {
    if (!finished) {
      finished = true;
      clearTimeout(globalTimer);
      res.status(500).json({ error: err.message });
    }
  });

  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks);
      chunks.length = 0;

      // ── Parse multipart ──────────────────────────────────
      const delim     = Buffer.from('\r\n--' + boundary);
      const firstLine = Buffer.from('--' + boundary + '\r\n');

      let fileBuffer = null;
      let fileName   = 'upload_' + Date.now();
      let mimeType   = 'application/octet-stream';
      let fileType   = 'image';

      let pos = indexOf(raw, firstLine, 0);
      if (pos === -1) {
        clearTimeout(globalTimer);
        finished = true;
        return res.status(400).json({ error: 'Bad multipart' });
      }
      pos += firstLine.length;

      while (pos < raw.length) {
        const headerEnd = indexOf(raw, Buffer.from('\r\n\r\n'), pos);
        if (headerEnd === -1) break;
        const header    = raw.slice(pos, headerEnd).toString('utf8');
        const bodyStart = headerEnd + 4;
        const bodyEnd   = indexOf(raw, delim, bodyStart);
        const body      = bodyEnd === -1 ? raw.slice(bodyStart) : raw.slice(bodyStart, bodyEnd);

        const nameM = header.match(/name="([^"]+)"/i);
        if (nameM) {
          if (nameM[1] === 'type') {
            fileType = body.toString('utf8').trim();
          } else if (nameM[1] === 'file') {
            const fnM = header.match(/filename="([^"]+)"/i);
            if (fnM) fileName = fnM[1];
            const ctM = header.match(/Content-Type:\s*([^\r\n]+)/i);
            if (ctM) mimeType = ctM[1].trim();
            fileBuffer = Buffer.from(body);
          }
        }
        if (bodyEnd === -1) break;
        pos = bodyEnd + delim.length;
        if (raw[pos] === 0x0d) pos += 2;
        if (raw[pos] === 0x2d && raw[pos+1] === 0x2d) break;
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        clearTimeout(globalTimer);
        finished = true;
        return res.status(400).json({ error: 'No file data parsed' });
      }

      // ── ناردن بۆ Telegram ────────────────────────────────
      const tgBoundary = '----TGBoundary' + Date.now();
      const endpoint   = fileType === 'video' ? 'sendVideo'
                       : fileType === 'image' ? 'sendPhoto'
                       : 'sendDocument';
      const fieldName  = fileType === 'video' ? 'video'
                       : fileType === 'image' ? 'photo'
                       : 'document';

      let headerStr =
        '--' + tgBoundary + '\r\n' +
        'Content-Disposition: form-data; name="chat_id"\r\n\r\n' +
        CHANNEL_ID + '\r\n';

      if (fileType === 'video') {
        headerStr +=
          '--' + tgBoundary + '\r\n' +
          'Content-Disposition: form-data; name="supports_streaming"\r\n\r\ntrue\r\n';
      }

      headerStr +=
        '--' + tgBoundary + '\r\n' +
        'Content-Disposition: form-data; name="' + fieldName + '"; filename="' + fileName + '"\r\n' +
        'Content-Type: ' + mimeType + '\r\n\r\n';

      const headerPart = Buffer.from(headerStr);
      const footerPart = Buffer.from('\r\n--' + tgBoundary + '--\r\n');
      const totalLen   = headerPart.length + fileBuffer.length + footerPart.length;

      const tgOptions = {
        hostname: 'api.telegram.org',
        path    : '/bot' + BOT_TOKEN + '/' + endpoint,
        method  : 'POST',
        headers : {
          'Content-Type'  : 'multipart/form-data; boundary=' + tgBoundary,
          'Content-Length': totalLen,
        },
      };

      const tgReq = https.request(tgOptions, tgRes => {
        let body = '';
        // ── Timeout بۆ وەڵامی Telegram ───────────────────
        tgRes.setTimeout(40000, () => {
          tgRes.destroy();
          if (!finished) {
            finished = true;
            clearTimeout(globalTimer);
            try { res.status(504).json({ error: 'Telegram response timeout' }); } catch(e) {}
          }
        });
        tgRes.on('data', d => body += d);
        tgRes.on('end', () => {
          if (finished) return;
          finished = true;
          clearTimeout(globalTimer);
          try {
            // دڵنیابوون body تەواوە
            if (!body || body.trim() === '') {
              return res.status(502).json({ error: 'Empty response from Telegram' });
            }
            const data = JSON.parse(body);
            if (!data.ok) {
              return res.status(500).json({ error: data.description || 'Telegram error' });
            }
            const msg     = data.result;
            let fileId, thumbId;
            if (fileType === 'video') {
              fileId  = msg.video?.file_id;
              thumbId = msg.video?.thumbnail?.file_id || msg.video?.thumb?.file_id || '';
            } else if (fileType === 'image') {
              const photos = msg.photo;
              fileId  = Array.isArray(photos) ? photos[photos.length - 1].file_id : '';
              thumbId = '';
            } else {
              fileId  = msg.document?.file_id;
              thumbId = '';
            }

            // ── لینکی ڕاستەوخۆ دروست بکە بە message_id ──
            // کەناڵ پابلیکە: t.me/username/message_id کاردەکات
            // هیچ سنووری فایل نییە — 20MB یان 200MB جیاوازی نییە
            const CHANNEL_USERNAME = process.env.TELEGRAM_CHANNEL_USERNAME || 'jack_storage_apps';
            const messageId = msg.message_id;
            const directUrl = `https://t.me/${CHANNEL_USERNAME}/${messageId}`;

            return res.status(200).json({
              success: true, file_id: fileId, thumb_id: thumbId,
              direct_url: directUrl, message_id: messageId, type: fileType,
            });
          } catch(e) {
            try { res.status(500).json({ error: 'Parse TG response: ' + e.message + ' | body: ' + body.substring(0, 100) }); } catch(e2) {}
          }
        });
        tgRes.on('error', e => {
          if (!finished) {
            finished = true;
            clearTimeout(globalTimer);
            try { res.status(500).json({ error: 'TG response error: ' + e.message }); } catch(e2) {}
          }
        });
      });

      // ── Timeout بۆ connectکردن بۆ Telegram ───────────────
      tgReq.setTimeout(45000, () => {
        tgReq.destroy();
        if (!finished) {
          finished = true;
          clearTimeout(globalTimer);
          try { res.status(504).json({ error: 'Telegram connection timeout' }); } catch(e) {}
        }
      });

      tgReq.on('error', e => {
        if (!finished) {
          finished = true;
          clearTimeout(globalTimer);
          try { res.status(500).json({ error: 'TG request error: ' + e.message }); } catch(e2) {}
        }
      });

      tgReq.write(headerPart);
      tgReq.write(fileBuffer);
      tgReq.write(footerPart);
      tgReq.end();

    } catch(e) {
      if (!finished) {
        finished = true;
        clearTimeout(globalTimer);
        try { res.status(500).json({ error: e.message }); } catch(e2) {}
      }
    }
  });
};

function indexOf(buf, search, offset) {
  for (let i = offset||0; i <= buf.length - search.length; i++) {
    let ok = true;
    for (let j = 0; j < search.length; j++) {
      if (buf[i+j] !== search[j]) { ok=false; break; }
    }
    if (ok) return i;
  }
  return -1;
}
