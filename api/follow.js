// api/follow.js — فۆڵۆو/ئەنفۆڵۆو
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL
    || 'https://alight-motion-helper-default-rtdb.firebaseio.com';

  try {
    // GET /api/follow?uid=xxx&viewerId=yyy
    // گەڕاندنەوەی ژمارەی followers/following و ئایا viewer فۆڵۆوی کردووە
    if (req.method === 'GET') {
      const { uid, viewerId } = req.query;
      if (!uid) return res.status(400).json({ error: 'uid required' });

      const r = await fetch(`${DB_URL}/users/${uid}.json`);
      const u = await r.json();
      if (!u) return res.status(404).json({ error: 'user not found' });

      const followers  = u.followers  ? Object.keys(u.followers).length  : 0;
      const following  = u.following  ? Object.keys(u.following).length  : 0;
      const isFollowing = viewerId
        ? !!(u.followers && u.followers[viewerId])
        : false;

      return res.status(200).json({ success: true, followers, following, isFollowing });
    }

    // POST /api/follow
    // body: { followerId, followingId, follow: true/false }
    if (req.method === 'POST') {
      const { followerId, followingId, follow } = req.body;
      if (!followerId || !followingId) return res.status(400).json({ error: 'followerId and followingId required' });
      if (followerId === followingId)   return res.status(400).json({ error: 'cannot follow yourself' });

      if (follow) {
        // زیادکردنی فۆڵۆو
        await fetch(`${DB_URL}/users/${followingId}/followers/${followerId}.json`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(true),
        });
        await fetch(`${DB_URL}/users/${followerId}/following/${followingId}.json`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(true),
        });
      } else {
        // لابردنی فۆڵۆو
        await fetch(`${DB_URL}/users/${followingId}/followers/${followerId}.json`, { method: 'DELETE' });
        await fetch(`${DB_URL}/users/${followerId}/following/${followingId}.json`, { method: 'DELETE' });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Follow error:', err);
    return res.status(500).json({ error: err.message });
  }
};
