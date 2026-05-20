// api/views.js - ژمارەی بینەران
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';
  const CATS   = ['codes','apps','fonts','effects','tutorial'];

  try {
    const { postId, userId, category } = req.body;
    if (!postId) return res.status(400).json({ error: 'postId required' });

    const cat     = CATS.includes(category) ? category : 'codes';
    const uid     = userId || 'anon_' + Math.random().toString(36).substr(2,8);

    // Check if already viewed
    const viewRef  = `${DB_URL}/views/${postId}/${uid.replace(/[.#$/[\]]/g,'_')}.json`;
    const countRef = `${DB_URL}/posts/${cat}/${postId}/views.json`;

    const already = await fetch(viewRef);
    const val     = await already.json();
    if (val === true) {
      const cr  = await fetch(countRef);
      const cnt = await cr.json();
      return res.status(200).json({ success: true, views: cnt || 0, alreadyViewed: true });
    }

    // Add view
    const [cr] = await Promise.all([
      fetch(countRef),
    ]);
    const current = (await cr.json()) || 0;
    const newCount = current + 1;

    await Promise.all([
      fetch(viewRef, { method:'PUT', body:JSON.stringify(true), headers:{'Content-Type':'application/json'} }),
      fetch(countRef, { method:'PUT', body:JSON.stringify(newCount), headers:{'Content-Type':'application/json'} }),
    ]);

    return res.status(200).json({ success: true, views: newCount });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
