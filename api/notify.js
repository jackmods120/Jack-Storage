// api/notify.js — تەنیا ذەخیرەکردن لە Firebase (بەبێ FCM Push)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  const NOTIF_DB = process.env.FIREBASE_DB_URL       || 'https://alight-helper-default-rtdb.firebaseio.com';
  const USERS_DB = process.env.FIREBASE_USERS_DB_URL || 'https://alight-motion-helper-default-rtdb.firebaseio.com';

  try {
    const { title, body, poster, excludeUserId, targetUserId } = req.body;
    const notifType   = req.body.type       || 'new_post';
    const category    = req.body.category   || '';
    const postId      = req.body.postId     || '';
    const commentId   = req.body.commentId  || '';
    const fromName    = req.body.fromName   || '';
    const fromAvatar  = req.body.fromAvatar || '';

    const timestamp = Date.now();
    const notifRecord = {
      type      : notifType,
      title     : title       || '',
      body      : body        || '',
      category  : category,
      postId    : postId,
      commentId : commentId,
      fromName  : fromName,
      fromAvatar: fromAvatar,
      timestamp : timestamp,
      read      : false,
    };

    // ── کۆمێنت: بۆ تەنیا یەک بەکارهێنەر ──
    if (targetUserId && targetUserId !== excludeUserId) {
      try {
        const notifKey = `${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
        await fetch(`${NOTIF_DB}/notifications/${targetUserId}/${notifKey}.json`, {
          method : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(notifRecord),
        });
      } catch (dbErr) {
        console.error('DB save error (single):', dbErr);
      }
    }
    // ── پۆستی نوێ: بۆ هەموو بەکارهێنەران ──
    else if (!targetUserId && (notifType === 'new_post' || notifType === 'admin_post')) {
      try {
        const usersRes  = await fetch(`${USERS_DB}/users.json`);
        const usersData = await usersRes.json();
        if (usersData && typeof usersData === 'object') {
          const savePromises = [];
          for (const uid of Object.keys(usersData)) {
            if (excludeUserId && uid === excludeUserId) continue;
            const notifKey = `${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
            savePromises.push(
              fetch(`${NOTIF_DB}/notifications/${uid}/${notifKey}.json`, {
                method : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body   : JSON.stringify({ ...notifRecord }),
              }).catch(e => console.error('DB broadcast save error for', uid, e))
            );
          }
          await Promise.all(savePromises);
        }
      } catch (dbErr) {
        console.error('DB broadcast save error:', dbErr);
      }
    }

    return res.status(200).json({ success: true, db: 'saved' });

  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
};
