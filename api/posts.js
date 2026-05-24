// api/posts.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';
  const CATS   = ['codes','apps','fonts','effects','tutorial'];

  try {
    // ════ GET ════
    if (req.method === 'GET') {
      const category = req.query.category || 'codes';
      const fbRes  = await fetch(`${DB_URL}/posts/${category}.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(200).json({ success: true, posts: [] });
      const posts = Object.entries(fbData)
        .map(([id, post]) => ({ id, ...post }))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
      return res.status(200).json({ success: true, posts });
    }

    // ════ POST ════
    if (req.method === 'POST') {
      const { text, fileId, thumbId, mediaType, userId, username, userAvatar, category } = req.body;
      if (!text && !fileId) return res.status(400).json({ error: 'Post must have text or media' });
      const cat  = CATS.includes(category) ? category : 'codes';
      const post = {
        text, fileId: fileId||'', thumbId: thumbId||'',
        mediaType: mediaType||'none', userId: userId||'anon',
        username: username||'User', userAvatar: userAvatar||'',
        category: cat, timestamp: Date.now(), likes: 0, comments: 0,
      };
      const fbRes  = await fetch(`${DB_URL}/posts/${cat}.json`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
      });
      const fbData = await fbRes.json();
      const postId  = fbData.name;

      // ── ناردنی notification بۆ هەموو بەکارهێنەران ──────
      const postTitle = (username || 'بەکارهێنەرێک') + ' پۆستی نوێی کردووە 🔔';
      const postBody  = text ? (text.length > 80 ? text.slice(0, 80) + '...' : text)
                             : (mediaType === 'image' ? '🖼️ وێنەی نوێ' : '🎬 ڤیدیۆی نوێ');
      try {
        await fetch(`${process.env.VERCEL_URL
          ? 'https://' + process.env.VERCEL_URL
          : 'https://jack-storage.vercel.app'}/api/notify`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({
            title         : postTitle,
            body          : postBody,
            poster        : userAvatar || '',
            excludeUserId : userId || '',
          }),
        });
      } catch (notifyErr) {
        console.error('Notify failed:', notifyErr.message);
        // notification شکستی هێنا بەڵام پۆستەکە بە جوانی ذەخیرەکرا
      }

      return res.status(200).json({ success: true, id: postId, post });
    }

    // ════ PATCH — گۆڕینی ناو/وێنە لە هەموو پۆستەکان ════
    // body: { userId, username?, userAvatar? }
    if (req.method === 'PATCH') {
      const { userId, username, userAvatar } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId required' });

      let updated = 0;
      for (const cat of CATS) {
        const fbRes  = await fetch(`${DB_URL}/posts/${cat}.json`);
        const fbData = await fbRes.json();
        if (!fbData) continue;
        for (const [postId, post] of Object.entries(fbData)) {
          if (post.userId !== userId) continue;
          const patch = {};
          if (username   !== undefined) patch.username   = username;
          if (userAvatar !== undefined) patch.userAvatar = userAvatar;
          await fetch(`${DB_URL}/posts/${cat}/${postId}.json`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          updated++;
        }
      }
      return res.status(200).json({ success: true, updated });
    }

    // ════ DELETE ════
    if (req.method === 'DELETE') {
      const { postId, category } = req.body;
      if (!postId || !category) return res.status(400).json({ error: 'postId and category required' });
      await fetch(`${DB_URL}/posts/${category}/${postId}.json`, { method: 'DELETE' });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
