// api/like.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';
  const CATS   = ['codes','apps','fonts','effects','tutorial'];

  try {
    // ── GET: check if user liked post ──
    if (req.method === 'GET') {
      const { postId, userId } = req.query;
      if (!postId || !userId) return res.status(400).json({ liked: false });
      const r   = await fetch(`${DB_URL}/likes/${postId}/${userId}.json`);
      const val = await r.json();
      return res.status(200).json({ liked: val === true });
    }

    if (req.method !== 'POST') return res.status(405).end();

    // لێرەدا like مان زیاد کردووە بۆ ئەوەی لەگەڵ جاڤاکە بگونجێت
    const { postId, userId, action, category, like } = req.body;
    if (!postId || !userId) return res.status(400).json({ error: 'postId and userId required' });

    const cat      = CATS.includes(category) ? category : 'codes';
    const likeRef  = `${DB_URL}/likes/${postId}/${userId}.json`;
    const likesRef = `${DB_URL}/posts/${cat}/${postId}/likes.json`;
    const lbRef    = `${DB_URL}/posts/${cat}/${postId}/likedBy.json`;

    const [cRes, lbRes] = await Promise.all([fetch(likesRef), fetch(lbRef)]);
    const current = (await cRes.json()) || 0;
    const likedBy = (await lbRes.json()) || [];

    // پشکنین دەکات بزانێت ئایا لایکە یان ئەنلایک (بەهەردوو شێوازەکە کار دەکات)
    const isLiking = action === 'like' || like === true || like === 'true';

    if (isLiking) {
      const newCount   = current + 1;
      const newLikedBy = Array.isArray(likedBy)
        ? [...new Set([...likedBy, userId])] : [userId];
      await Promise.all([
        fetch(likeRef, { method:'PUT', body:JSON.stringify(true), headers:{'Content-Type':'application/json'} }),
        fetch(likesRef, { method:'PUT', body:JSON.stringify(newCount), headers:{'Content-Type':'application/json'} }),
        fetch(lbRef,   { method:'PUT', body:JSON.stringify(newLikedBy), headers:{'Content-Type':'application/json'} }),
      ]);
      return res.status(200).json({ success:true, likes:newCount, liked:true });
    } else {
      const newCount   = Math.max(current - 1, 0);
      const newLikedBy = Array.isArray(likedBy)
        ? likedBy.filter(u => u !== userId) : [];
      await Promise.all([
        fetch(likeRef, { method:'DELETE' }),
        fetch(likesRef, { method:'PUT', body:JSON.stringify(newCount), headers:{'Content-Type':'application/json'} }),
        fetch(lbRef,   { method:'PUT', body:JSON.stringify(newLikedBy), headers:{'Content-Type':'application/json'} }),
      ]);
      return res.status(200).json({ success:true, likes:newCount, liked:false });
    }
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
