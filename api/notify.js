// api/notify.js — ناردنی FCM notification بۆ هەموو بەکارهێنەران

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  const DB_URL     = process.env.FIREBASE_DB_URL  || 'https://jack-9a034-default-rtdb.firebaseio.com';
  const FCM_KEY    = process.env.FCM_SERVER_KEY;   // لە Vercel environment variables

  if (!FCM_KEY) return res.status(500).json({ error: 'FCM_SERVER_KEY not set in env' });

  try {
    const { title, body, poster, excludeUserId } = req.body;

    // ── وەرگرتنی هەموو tokenەکان ─────────────────────────
    const fbRes  = await fetch(`${DB_URL}/fcm_tokens.json`);
    const fbData = await fbRes.json();
    if (!fbData) return res.status(200).json({ success: true, sent: 0 });

    const tokens = [];
    for (const [userId, userTokens] of Object.entries(fbData)) {
      // ئەو بەکارهێنەرەی کە پۆستەکەی کردووە notification ناگات
      if (excludeUserId && userId === excludeUserId) continue;
      if (typeof userTokens === 'object') {
        for (const [, val] of Object.entries(userTokens)) {
          if (val && val.token) tokens.push(val.token);
        }
      }
    }

    if (tokens.length === 0)
      return res.status(200).json({ success: true, sent: 0, message: 'No tokens' });

    // ── ناردن بە batch ی ١۰۰تایی ────────────────────────
    const FCM_URL  = 'https://fcm.googleapis.com/fcm/send';
    const BATCH    = 100;
    let   sent     = 0;
    let   failed   = 0;

    for (let i = 0; i < tokens.length; i += BATCH) {
      const batch = tokens.slice(i, i + BATCH);
      const payload = {
        registration_ids: batch,
        notification: { title, body },
        data: {
          title  : title  || '',
          body   : body   || '',
          poster : poster || '',
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        priority: 'high',
        android : { priority: 'high', notification: { sound: 'default', channel_id: 'alight_helper_posts' } },
        apns    : { payload: { aps: { sound: 'default' } } },
      };

      const fcmRes = await fetch(FCM_URL, {
        method : 'POST',
        headers: {
          'Content-Type'  : 'application/json',
          'Authorization' : `key=${FCM_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      const fcmData = await fcmRes.json();
      sent   += fcmData.success || 0;
      failed += fcmData.failure || 0;

      // سڕینەوەی invalid tokenەکان
      if (fcmData.results) {
        for (let j = 0; j < fcmData.results.length; j++) {
          const r = fcmData.results[j];
          if (r.error === 'NotRegistered' || r.error === 'InvalidRegistration') {
            const badToken = batch[j].replace(/[.#$/[\]]/g, '_');
            // بدۆزەوە و بیسڕەوە
            for (const [uid, ut] of Object.entries(fbData)) {
              if (typeof ut === 'object') {
                for (const [tk] of Object.entries(ut)) {
                  if (tk === badToken) {
                    await fetch(`${DB_URL}/fcm_tokens/${uid}/${badToken}.json`, { method: 'DELETE' });
                  }
                }
              }
            }
          }
        }
      }
    }

    return res.status(200).json({ success: true, sent, failed, total: tokens.length });

  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
};
