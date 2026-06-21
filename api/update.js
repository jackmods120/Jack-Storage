// api/update.js — ناردنی Update لەلایەن Owner + پشکنینی نوێترین وەشان
// تەنیا Owner دەتوانێت Update بنێرێت (OWNER_UID پشتڕاستی دەکرێتەوە)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL    = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';
  // خاوەنی بەرنامە — تەنیا ئەم uid ـە دەتوانێت Update بنێرێت
  const OWNER_UID = process.env.OWNER_UID || '';

  try {
    // ════ GET — وەرگرتنی نوێترین Update (هەموو پەڕەکان پشکنینی دەکەن) ════
    if (req.method === 'GET') {
      const fbRes  = await fetch(`${DB_URL}/app_update.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(200).json({ success: true, update: null });
      return res.status(200).json({ success: true, update: fbData });
    }

    // ════ POST — ناردنی Update نوێ (تەنیا Owner) ════
    if (req.method === 'POST') {
      const { userId, version, title, message, mandatory, downloadUrl } = req.body;

      if (!userId) return res.status(401).json({ error: 'userId required' });
      if (!OWNER_UID || userId !== OWNER_UID) {
        return res.status(403).json({ error: 'Only the app owner can send updates' });
      }
      if (!version) return res.status(400).json({ error: 'version required' });

      const update = {
        version    : version,
        title      : title       || 'وەشانێکی نوێ بەردەستە',
        message    : message     || '',
        mandatory  : mandatory === true,
        downloadUrl: downloadUrl || '',
        timestamp  : Date.now(),
        sentBy     : userId,
      };

      await fetch(`${DB_URL}/app_update.json`, {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(update),
      });

      return res.status(200).json({ success: true, update });
    }

    // ════ DELETE — لابردنی Update (تەنیا Owner) ════
    if (req.method === 'DELETE') {
      const { userId } = req.body || {};
      if (!OWNER_UID || userId !== OWNER_UID) {
        return res.status(403).json({ error: 'Only the app owner can remove updates' });
      }
      await fetch(`${DB_URL}/app_update.json`, { method: 'DELETE' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
