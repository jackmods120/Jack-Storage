// api/like.js — Like/Unlike (native fetch, Node 24)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') {
    // چێک کردن: ئایا ئەم بەکارهێنەرە ئەم پۆستەی لایک کردووە؟
    const { postId, userId } = req.query;
    if (!postId || !userId) return res.status(400).json({ error: 'postId and userId required' });
    const likeRef = `${DB_URL}/likes/${postId}/${userId}.json`;
    const r = await fetch(likeRef);
    const val = await r.json();
    return res.status(200).json({ liked: val === true });
  }
  if (req.method !== 'POST') return res.status(405).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';

  try {
    const { postId, userId, action } = req.body;
    if (!postId || !userId) return res.status(400).json({ error: 'postId and userId required' });

    const cat       = req.query.category || "codes";
    const likeRef   = `${DB_URL}/likes/${postId}/${userId}.json`;
    const likesRef  = `${DB_URL}/posts/${cat}/${postId}/likes.json`;
    const likedByRef= `${DB_URL}/posts/${cat}/${postId}/likedBy.json`;

    const [currentRes, likedByRes] = await Promise.all([fetch(likesRef), fetch(likedByRef)]);
    const current = await currentRes.json();
    const likedBy = (await likedByRes.json()) || [];

    if (action === 'like') {
      await fetch(likeRef, {
        method: 'PUT', body: JSON.stringify(true),
        headers: { 'Content-Type': 'application/json' },
      });
      const newCount = (current || 0) + 1;
      const newLikedBy = Array.isArray(likedBy) ? [...new Set([...likedBy, userId])] : [userId];
      await Promise.all([
        fetch(likesRef, { method:'PUT', body: JSON.stringify(newCount), headers:{'Content-Type':'application/json'} }),
        fetch(likedByRef, { method:'PUT', body: JSON.stringify(newLikedBy), headers:{'Content-Type':'application/json'} }),
      ]);
      return res.status(200).json({ success: true, likes: newCount, liked: true });
    } else {
      await fetch(likeRef, { method: 'DELETE' });
      const newCount   = Math.max((current || 1) - 1, 0);
      const newLikedBy = Array.isArray(likedBy) ? likedBy.filter(u => u !== userId) : [];
      await Promise.all([
        fetch(likesRef, { method:'PUT', body: JSON.stringify(newCount), headers:{'Content-Type':'application/json'} }),
        fetch(likedByRef, { method:'PUT', body: JSON.stringify(newLikedBy), headers:{'Content-Type':'application/json'} }),
      ]);
      return res.status(200).json({ success: true, likes: newCount, liked: false });
    }

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
