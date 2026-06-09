// api/comments.js — کۆمێنت + ڕیپلە (TikTok style)
// دەستکاریکرا: زیادکردنی ئاگادارکردنەوەی ئۆتۆماتیک بۆ ڕیپلە و کۆمێنت

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL  = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';
  const API_URL = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://jack-storage.vercel.app';

  try {
    // ════ GET ════════════════════════════════════════════════
    if (req.method === 'GET') {
      const postId = req.query.postId;
      if (!postId) return res.status(400).json({ error: 'postId required' });

      const fbRes  = await fetch(`${DB_URL}/comments/${postId}.json`);
      const fbData = await fbRes.json();

      if (!fbData) return res.status(200).json({ success: true, comments: [] });

      const comments = Object.entries(fbData)
        .map(([id, c]) => ({ id, ...c }))
        .sort((a, b) => a.timestamp - b.timestamp);

      return res.status(200).json({ success: true, comments });
    }

    // ════ POST ═══════════════════════════════════════════════
    if (req.method === 'POST') {
      const {
        postId, text, userId, username, userAvatar, category,
        replyTo, replyToUser,
        // ── زیادکرا: بۆ ئاگادارکردنەوە ──
        replyToUserId,  // ID ی ئەو کەسەی ڕیپلەی کرا (لە CommentActivity دەنێرێت)
        postOwnerId,    // ID ی خاوەنی پۆستەکە — ئەگەر نەنێرا خۆی لە Firebase دەردەکات
      } = req.body;

      if (!postId || !text)
        return res.status(400).json({ error: 'postId and text required' });

      const comment = {
        text      : text,
        userId    : userId     || 'anon',
        username  : username   || 'User',
        userAvatar: userAvatar || '',
        timestamp : Date.now(),
        replyTo    : replyTo     || '',
        replyToUser: replyToUser || '',
      };

      const fbRes  = await fetch(`${DB_URL}/comments/${postId}.json`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(comment),
      });
      const fbData = await fbRes.json();

      // نوێکردنەوەی ژمارەی کۆمێنت — تەنیا کۆمێنتی دایک
      let resolvedOwner = postOwnerId || '';
      if (!replyTo) {
        const cats     = ['codes','apps','fonts','effects','tutorial'];
        const cat      = cats.includes(category) ? category : 'codes';
        const countRef = `${DB_URL}/posts/${cat}/${postId}/comments.json`;
        const countRes = await fetch(countRef);
        const count    = await countRes.json();
        await fetch(countRef, {
          method : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify((count || 0) + 1),
        });

        // ئەگەر owner نەنێرا — لە Firebase پۆستەکە بدۆزینەوە
        if (!resolvedOwner) {
          try {
            const postRes  = await fetch(`${DB_URL}/posts/${cat}/${postId}/userId.json`);
            const postData = await postRes.json();
            if (postData && typeof postData === 'string') resolvedOwner = postData;
          } catch (_) {}
        }
      }

      // ════ ئاگادارکردنەوە ════════════════════════════════
      sendNotificationAsync({
        apiUrl        : API_URL,
        senderUserId  : userId || '',
        senderUsername: username || 'User',
        senderAvatar  : userAvatar || '',
        postId        : postId,
        commentId     : fbData.name || '',
        category      : category || 'codes',
        replyTo,
        replyToUser,
        replyToUserId,
        postOwnerId   : resolvedOwner,
      });
      // ══════════════════════════════════════════════════════

      return res.status(200).json({ success: true, id: fbData.name, comment });
    }

    // ════ DELETE ══════════════════════════════════════════════
    if (req.method === 'DELETE') {
      const { postId, commentId, category, userId, replyTo } = req.query;
      if (!postId || !commentId) return res.status(400).json({ error: 'postId and commentId required' });

      const cats = ['codes','apps','fonts','effects','tutorial'];
      const cat  = cats.includes(category) ? category : 'codes';

      // بڕیاردان: ئایا خاوەنی کۆمێنتەکەیە؟
      const cmtRes  = await fetch(`${DB_URL}/comments/${postId}/${commentId}.json`);
      const cmtData = await cmtRes.json();
      if (!cmtData) return res.status(404).json({ error: 'Comment not found' });

      // بڕیاردان: خاوەنی کۆمێنت یان خاوەنی پۆست
      let postOwner = '';
      try {
        const ownerRes = await fetch(`${DB_URL}/posts/${cat}/${postId}/userId.json`);
        postOwner = await ownerRes.json() || '';
      } catch (_) {}

      if (cmtData.userId !== userId && postOwner !== userId) {
        return res.status(403).json({ error: 'Not allowed' });
      }

      const isReply = replyTo && replyTo.length > 0;

      if (isReply) {
        // سڕینەوەی تەنیا ئەو ڕیپلەیە
        await fetch(`${DB_URL}/comments/${postId}/${commentId}.json`, { method: 'DELETE' });
        // سڕینەوەی ئاگادارکردنەوەی ئەو ڕیپلەیە (بۆ خاوەنی کۆمێنتی ئەصلی)
        if (cmtData.replyTo) {
          try {
            const parentRes  = await fetch(`${DB_URL}/comments/${postId}/${cmtData.replyTo}.json`);
            const parentData = await parentRes.json();
            if (parentData && parentData.userId) {
              await fetch(`${API_URL}/api/notify?targetUserId=${parentData.userId}&postId=${postId}&commentId=${commentId}`, { method: 'DELETE' });
            }
          } catch (_) {}
        }
      } else {
        // سڕینەوەی کۆمێنتی دایک
        await fetch(`${DB_URL}/comments/${postId}/${commentId}.json`, { method: 'DELETE' });
        // سڕینەوەی ئاگادارکردنەوەی پەیوەندیدار بەو کۆمێنتە (بۆ خاوەنی پۆستەکە)
        try {
          await fetch(`${API_URL}/api/notify?targetUserId=${postOwner}&postId=${postId}&commentId=${commentId}`, { method: 'DELETE' });
        } catch (_) {}
        // سڕینەوەی هەموو ڕیپلەکانی
        try {
          const allRes  = await fetch(`${DB_URL}/comments/${postId}.json`);
          const allData = await allRes.json();
          if (allData) {
            const delJobs = Object.entries(allData)
              .filter(([, c]) => c.replyTo === commentId)
              .map(([id]) =>
                fetch(`${DB_URL}/comments/${postId}/${id}.json`, { method: 'DELETE' })
              );
            await Promise.all(delJobs);
          }
        } catch (_) {}
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Comments error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ══════════════════════════════════════════════════════
//  ناردنی ئاگادارکردنەوە (هیچ دواخستنێک ناکات)
// ══════════════════════════════════════════════════════
async function sendNotificationAsync({
  apiUrl, senderUserId, senderUsername, senderAvatar,
  postId, commentId, category,
  replyTo, replyToUser, replyToUserId,
  postOwnerId,
}) {
  try {
    // ── ڕیپلە کرا ──────────────────────────────────────
    if (replyTo && replyToUserId && replyToUserId !== senderUserId) {
      await fetch(`${apiUrl}/api/notify`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          type        : 'new_comment',
          targetUserId: replyToUserId,
          fromName    : senderUsername,
          fromAvatar  : senderAvatar || '',
          postId      : postId,
          commentId   : commentId,
          category    : category,
          title       : `${senderUsername} ڕیپلەیت کرد 💬`,
          body        : `${senderUsername} وەڵامی کۆمێنتەکەت دایەوە`,
          poster      : '',
        }),
      });
    }
    // ── کۆمێنتی سادە (نە ڕیپلە) ──────────────────────
    else if (!replyTo && postOwnerId && postOwnerId !== senderUserId) {
      await fetch(`${apiUrl}/api/notify`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          type        : 'new_comment',
          targetUserId: postOwnerId,
          fromName    : senderUsername,
          fromAvatar  : senderAvatar || '',
          postId      : postId,
          commentId   : commentId,
          category    : category,
          title       : `${senderUsername} کۆمێنتی کرد 💬`,
          body        : `${senderUsername} کۆمێنتی لە پۆستەکەت کرد`,
          poster      : '',
        }),
      });
    }
  } catch (e) {
    console.error('Notification send error:', e);
  }
}
