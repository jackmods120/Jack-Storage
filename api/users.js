// api/users.js — بەڕێوەبردنی بەکارهێنەران
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL
    || 'https://alight-motion-helper-default-rtdb.firebaseio.com';

  try {
    // ════ GET — لیستی بەکارهێنەران ════
    if (req.method === 'GET') {
      const fbRes  = await fetch(`${DB_URL}/users.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(200).json({ success: true, users: [] });
      const users = Object.entries(fbData).map(([id, u]) => ({ id, ...u }));
      return res.status(200).json({ success: true, users });
    }

    // ════ POST — زیادکردنی بەکارهێنەر ════
    // ── GET single user by email for login ──
    if (req.method === 'GET' && req.query.email) {
      const email = req.query.email.toLowerCase();
      const key   = email.replace(/[.#$[\]]/g, '_');
      const r     = await fetch(`${DB_URL}/users/${key}.json`);
      const u     = await r.json();
      if (!u) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ success: true, user: { ...u, id: key } });
    }

    if (req.method === 'POST') {
      const { email, name, role, password } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });

      const fbRes  = await fetch(`${DB_URL}/users.json`);
      const fbData = await fbRes.json();
      if (fbData) {
        for (const [key, value] of Object.entries(fbData)) {
          if (value.email === email) {
            return res.status(200).json({ success: true, message: 'exists', id: key });
          }
        }
      }
      const user   = { email, name: name || '', role: role || 'user', blocked: false, createdAt: Date.now(), password: password || '' };
      const newRes = await fetch(`${DB_URL}/users.json`, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(user),
      });
      const newData = await newRes.json();
      return res.status(200).json({ success: true, id: newData.name, user });
    }

    // ════ PUT — گۆڕینی ڕۆڵ یان بلۆک ════
    // body: { userId?, email?, role?, blocked? }
    if (req.method === 'PUT') {
      const { email, userId, role, blocked } = req.body;
      if (!email && !userId) {
        return res.status(400).json({ error: 'userId or email required' });
      }
      if (role === undefined && blocked === undefined) {
        return res.status(400).json({ error: 'role or blocked required' });
      }

      const fbRes  = await fetch(`${DB_URL}/users.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(404).json({ error: 'User not found' });

      let targetKey   = null;
      let targetValue = null;

      if (userId && fbData[userId]) {
        // ✅ پشتگیری userId (Firebase key)
        targetKey   = userId;
        targetValue = fbData[userId];
      } else if (email) {
        for (const [key, value] of Object.entries(fbData)) {
          if (value.email === email) {
            targetKey   = key;
            targetValue = value;
            break;
          }
        }
      }

      if (!targetKey || !targetValue) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updated = { ...targetValue };
      if (role    !== undefined) updated.role    = role;
      if (blocked !== undefined) updated.blocked = blocked;

      await fetch(`${DB_URL}/users/${targetKey}.json`, {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(updated),
      });
      return res.status(200).json({ success: true, message: 'User updated' });
    }

    // ════ DELETE ════
    if (req.method === 'DELETE') {
      const { email, userId } = req.body;
      if (!email && !userId) return res.status(400).json({ error: 'userId or email required' });

      if (userId) {
        await fetch(`${DB_URL}/users/${userId}.json`, { method: 'DELETE' });
        return res.status(200).json({ success: true });
      }

      const fbRes  = await fetch(`${DB_URL}/users.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(404).json({ error: 'Not found' });
      for (const [key, value] of Object.entries(fbData)) {
        if (value.email === email) {
          await fetch(`${DB_URL}/users/${key}.json`, { method: 'DELETE' });
          return res.status(200).json({ success: true });
        }
      }
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Users error:', err);
    return res.status(500).json({ error: err.message });
  }
};
