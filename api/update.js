// api/update.js — سیستەمی Force Update (تەنیا owner/admin دەتوانن بنێرن)
// ذەخیرەکردن لە هەمان DB-ی alight-motion-helper (وەک users/notifications)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL_USERS
    || 'https://alight-motion-helper-default-rtdb.firebaseio.com';

  try {
    // ════ GET — پشکنینی Update (هەموو ئەپ لە onCreate بانگی دەکات) ════
    // GET /api/update
    if (req.method === 'GET') {
      const r = await fetch(`${DB_URL}/app_update.json`);
      const data = await r.json();

      if (!data) {
        return res.status(200).json({ success: true, hasUpdate: false });
      }

      return res.status(200).json({
        success    : true,
        hasUpdate  : data.active === true,
        version    : data.version    || '',
        versionCode: data.versionCode || 0,
        title      : data.title      || 'هەوازکردنی سیستەم',
        message    : data.message    || '',
        apkUrl     : data.apkUrl     || '',
        forceUpdate: data.forceUpdate !== false,   // بنەڕەتی true
        senderName : data.senderName || '',
        timestamp  : data.timestamp  || 0,
      });
    }

    // ════ POST — ناردنی Update نوێ (تەنیا لە AdminPanel) ════
    // body: { uid, role, version, versionCode, title, message, apkUrl, forceUpdate, senderName }
    if (req.method === 'POST') {
      const {
        uid, role, version, versionCode, title, message,
        apkUrl, forceUpdate, senderName,
      } = req.body;

      // ── دڵنیابوون لە دەسەڵات ──
      if (!uid || !['owner', 'super_admin', 'admin'].includes(role)) {
        return res.status(403).json({ error: 'دەسەڵاتت نییە Update بنێریت' });
      }
      if (!version || !apkUrl) {
        return res.status(400).json({ error: 'version و apkUrl پێویستن' });
      }

      const record = {
        active     : true,
        version    : version,
        versionCode: versionCode || 0,
        title      : title   || 'وەشانی نوێ بەردەستە',
        message    : message || `وەشانی ${version} بەردەستە، تکایە نوێی بکەرەوە.`,
        apkUrl     : apkUrl,
        forceUpdate: forceUpdate !== false,
        senderName : senderName || 'بەڕێوەبەر',
        senderUid  : uid,
        timestamp  : Date.now(),
      };

      await fetch(`${DB_URL}/app_update.json`, {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(record),
      });

      return res.status(200).json({ success: true, update: record });
    }

    // ════ DELETE — لابردنی Update (ڕاگرتنی Force Update) ════
    // body: { uid, role }
    if (req.method === 'DELETE') {
      const { uid, role } = req.body || {};
      if (!uid || !['owner', 'super_admin', 'admin'].includes(role)) {
        return res.status(403).json({ error: 'دەسەڵاتت نییە' });
      }
      await fetch(`${DB_URL}/app_update.json`, { method: 'DELETE' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Update API error:', err);
    return res.status(500).json({ error: err.message });
  }
};
