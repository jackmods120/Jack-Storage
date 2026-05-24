// api/notify.js — FCM V1 API (Legacy بەکارناهێنرێت)

const { GoogleAuth } = require('google-auth-library');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  const DB_URL    = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';
  const PROJECT   = process.env.FCM_PROJECT_ID  || 'alight-motion-helper';
  const SA_KEY    = process.env.FCM_SERVICE_ACCOUNT_KEY; // JSON string لە Vercel env

  try {
    const { title, body, poster, excludeUserId } = req.body;

    // ── وەرگرتنی هەموو tokenەکان ──────────────────────────
    const fbRes  = await fetch(`${DB_URL}/fcm_tokens.json`);
    const fbData = await fbRes.json();
    if (!fbData) return res.status(200).json({ success: true, sent: 0 });

    const tokens = [];
    for (const [userId, userTokens] of Object.entries(fbData)) {
      if (excludeUserId && userId === excludeUserId) continue;
      if (typeof userTokens === 'object') {
        for (const [, val] of Object.entries(userTokens)) {
          if (val && val.token) tokens.push(val.token);
        }
      }
    }

    if (tokens.length === 0)
      return res.status(200).json({ success: true, sent: 0 });

    // ── Access Token لە Service Account ──────────────────
    let accessToken = '';
    if (SA_KEY) {
      const saJson = JSON.parse(SA_KEY);
      const auth   = new GoogleAuth({
        credentials: saJson,
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      });
      const client = await auth.getClient();
      const at     = await client.getAccessToken();
      accessToken  = at.token;
    } else {
      // بەبێ Service Account — ذەخیرەکردنی notification لە Firebase DB
      // بەرنامەکە polling دەکات
      await fetch(`${DB_URL}/pending_notifications.json`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          title, body, poster: poster||'',
          timestamp: Date.now(), seen: false
        }),
      });
      return res.status(200).json({ 
        success: true, 
        method : 'db_polling',
        message: 'Saved to DB — app will poll on next open'
      });
    }

    // ── ناردن بە FCM V1 ────────────────────────────────────
    const FCM_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`;
    let sent = 0, failed = 0;

    for (const token of tokens) {
      try {
        const r = await fetch(FCM_URL, {
          method : 'POST',
          headers: {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { title: title||'', body: body||'', poster: poster||'' },
              android: {
                priority: 'high',
                notification: { channel_id: 'alight_helper_posts', sound: 'default' }
              },
            }
          }),
        });
        if (r.ok) sent++;
        else {
          failed++;
          const err = await r.json();
          // سڕینەوەی invalid token
          if (err?.error?.details?.[0]?.errorCode === 'UNREGISTERED') {
            for (const [uid, ut] of Object.entries(fbData)) {
              if (typeof ut === 'object') {
                for (const [tk, val] of Object.entries(ut)) {
                  if (val?.token === token) {
                    await fetch(`${DB_URL}/fcm_tokens/${uid}/${tk}.json`,
                      { method: 'DELETE' });
                  }
                }
              }
            }
          }
        }
      } catch (_) { failed++; }
    }

    return res.status(200).json({ success: true, sent, failed, total: tokens.length });

  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
};
