// api/view.js
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://jack-9a034-default-rtdb.firebaseio.com';
  const { postId, userId, category } = req.body;
  
  if (!postId || !userId || !category) return res.status(400).json({ error: 'Missing data' });

  try {
    const viewsRef = `${DB_URL}/posts/${category}/${postId}/views.json`;
    const viewedByRef = `${DB_URL}/posts/${category}/${postId}/viewedBy.json`;

    const [vRes, vbRes] = await Promise.all([fetch(viewsRef), fetch(viewedByRef)]);
    const currentViews = (await vRes.json()) || 0;
    const viewedBy = (await vbRes.json()) || [];

    // ئەگەر پێشتر ئەم کەسە سەیری نەکردبێت، بینەرێک زیاد بکە
    if (!Array.isArray(viewedBy) || !viewedBy.includes(userId)) {
      const newViewsCount = currentViews + 1;
      const newViewedBy = Array.isArray(viewedBy) ? [...viewedBy, userId] : [userId];

      await Promise.all([
        fetch(viewsRef, { method:'PUT', body:JSON.stringify(newViewsCount), headers:{'Content-Type':'application/json'} }),
        fetch(viewedByRef, { method:'PUT', body:JSON.stringify(newViewedBy), headers:{'Content-Type':'application/json'} })
      ]);

      return res.status(200).json({ success: true, views: newViewsCount });
    }

    // ئەگەر پێشتر سەیری کردبێت، هیچ زیاد مەکە
    return res.status(200).json({ success: true, views: currentViews });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
};
