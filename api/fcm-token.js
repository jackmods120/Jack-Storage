// api/fcm-token.js — ذەخیرەکردن و وەرگرتنی FCM tokenەکان

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';

  try {
    // ════ POST — ذەخیرەکردنی token ════════════════════════
    if (req.method === 'POST') {
      const { userId, token } = req.body;
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });

      // ذەخیرەکردن لەژێر fcm_tokens/{userId}/{tokenKey}
      // بە key ی token خۆی بۆ ئەوەی duplicate نەبێت
      const safeToken = token.replace(/[.#$/[\]]/g, '_');
      await fetch(`${DB_URL}/fcm_tokens/${userId}/${safeToken}.json`, {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ token, updatedAt: Date.now() }),
      });

      return res.status(200).json({ success: true });
    }

    // ════ GET — وەرگرتنی هەموو tokenەکان ════════════════
    if (req.method === 'GET') {
      const fbRes  = await fetch(`${DB_URL}/fcm_tokens.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(200).json({ success: true, tokens: [] });

      const tokens = [];
      for (const [userId, userTokens] of Object.entries(fbData)) {
        if (typeof userTokens === 'object') {
          for (const [, val] of Object.entries(userTokens)) {
            if (val && val.token) tokens.push(val.token);
          }
        }
      }
      return res.status(200).json({ success: true, tokens });
    }

    // ════ DELETE — سڕینەوەی token ═══════════════════════
    if (req.method === 'DELETE') {
      const { userId, token } = req.body;
      if (!userId || !token) return res.status(400).json({ error: 'userId and token required' });
      const safeToken = token.replace(/[.#$/[\]]/g, '_');
      await fetch(`${DB_URL}/fcm_tokens/${userId}/${safeToken}.json`, { method: 'DELETE' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
