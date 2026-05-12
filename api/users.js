// api/users.js — بەڕێوەبردنی بەکارهێنەران (GET, POST, PUT, DELETE)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL || 'https://alight-motion-helper-default-rtdb.firebaseio.com';

  try {
    // ════ GET — لیستی بەکارهێنەران ════
    if (req.method === 'GET') {
      const fbRes = await fetch(`${DB_URL}/users.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(200).json({ success: true, users: [] });
      const users = Object.entries(fbData).map(([id, u]) => ({ id, ...u }));
      return res.status(200).json({ success: true, users });
    }

    // ════ POST — زیادکردنی بەکارهێنەر (ئەگەر پێشتر نەبوو) ════
    if (req.method === 'POST') {
      const { email, name, role } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });

      // پشکنینی دووبارەبوونەوە
      const fbRes = await fetch(`${DB_URL}/users.json`);
      const fbData = await fbRes.json();
      if (fbData) {
        for (const [key, value] of Object.entries(fbData)) {
          if (value.email === email) {
            return res.status(200).json({ success: true, message: 'User already exists', id: key });
          }
        }
      }

      const user = { email, name: name || '', role: role || 'user', createdAt: Date.now() };
      const newRes = await fetch(`${DB_URL}/users.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      const newData = await newRes.json();
      return res.status(200).json({ success: true, id: newData.name, user });
    }

    // ════ PUT — گۆڕینی ڕۆڵ (body: { email, role }) ════
    if (req.method === 'PUT') {
      const { email, role } = req.body;
      if (!email || !role) return res.status(400).json({ error: 'email and role required' });
      const fbRes = await fetch(`${DB_URL}/users.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(404).json({ error: 'User not found' });
      let targetEntry = null;
      for (const [key, value] of Object.entries(fbData)) {
        if (value.email === email) {
          targetEntry = { key, ...value };
          break;
        }
      }
      if (!targetEntry) return res.status(404).json({ error: 'User not found' });
      await fetch(`${DB_URL}/users/${targetEntry.key}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...targetEntry, role }),
      });
      return res.status(200).json({ success: true, message: 'Role updated' });
    }

    // ════ DELETE — سڕینەوەی بەکارهێنەر (body: { email }) ════
    if (req.method === 'DELETE') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'email required' });
      const fbRes = await fetch(`${DB_URL}/users.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(404).json({ error: 'User not found' });
      for (const [key, value] of Object.entries(fbData)) {
        if (value.email === email) {
          await fetch(`${DB_URL}/users/${key}.json`, { method: 'DELETE' });
          return res.status(200).json({ success: true, message: 'User deleted' });
        }
      }
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
