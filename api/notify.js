// api/notify.js — ذەخیرەکردن لە Firebase (بەبێ FCM Push)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ════ DELETE ═══════════════════════════════════════════════
  // سڕینەوەی ئاگادارکردنەوەی پەیوەندیدار بە commentId یان postId
  // ?targetUserId=xxx&postId=yyy&commentId=zzz  (commentId ئایەختیاریە)
  if (req.method === 'DELETE') {
    const DB = 'https://alight-motion-helper-default-rtdb.firebaseio.com';
    const { targetUserId, postId, commentId } = req.query;
    if (!targetUserId || !postId)
      return res.status(400).json({ error: 'targetUserId and postId required' });

    try {
      // هەموو ئاگادارکردنەوەکانی ئەو بەکارهێنەرە بخوێنەوە
      const fbRes  = await fetch(`${DB}/notifications/${targetUserId}.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(200).json({ success: true, deleted: 0 });

      const delJobs = [];
      for (const [key, n] of Object.entries(fbData)) {
        const matchPost    = n.postId === postId;
        const matchComment = !commentId || n.commentId === commentId;
        if (matchPost && matchComment) {
          delJobs.push(
            fetch(`${DB}/notifications/${targetUserId}/${key}.json`, { method: 'DELETE' })
              .catch(e => console.error('delete notif error:', e))
          );
        }
      }
      await Promise.all(delJobs);
      return res.status(200).json({ success: true, deleted: delJobs.length });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST or DELETE only' });

  // هەردووکیان لە هەمان DB — alight-motion-helper
  const DB = 'https://alight-motion-helper-default-rtdb.firebaseio.com';

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
        await fetch(`${DB}/notifications/${targetUserId}/${notifKey}.json`, {
          method : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(notifRecord),
        });
      } catch (e) {
        console.error('DB save error (single):', e);
      }
    }
    // ── پۆستی نوێ: بۆ هەموو بەکارهێنەران ──
    else if (!targetUserId && (notifType === 'new_post' || notifType === 'admin_post')) {
      try {
        const usersRes  = await fetch(`${DB}/users.json`);
        const usersData = await usersRes.json();
        if (usersData && typeof usersData === 'object') {
          const saves = [];
          for (const uid of Object.keys(usersData)) {
            if (excludeUserId && uid === excludeUserId) continue;
            const notifKey = `${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
            saves.push(
              fetch(`${DB}/notifications/${uid}/${notifKey}.json`, {
                method : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body   : JSON.stringify({ ...notifRecord }),
              }).catch(e => console.error('save error for', uid, e))
            );
          }
          await Promise.all(saves);
        }
      } catch (e) {
        console.error('DB broadcast error:', e);
      }
    }

    return res.status(200).json({ success: true, db: 'saved' });

  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
};
