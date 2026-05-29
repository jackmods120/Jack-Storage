// api/users.js — بەڕێوەبردنی بەکارهێنەران + username support
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const DB_URL = process.env.FIREBASE_DB_URL
    || 'https://alight-motion-helper-default-rtdb.firebaseio.com';

  try {
    // ════ GET ════
    if (req.method === 'GET') {

      // GET /api/users?uid=xxx
      if (req.query.uid) {
        const r = await fetch(`${DB_URL}/users/${req.query.uid}.json`);
        const u = await r.json();
        if (!u) return res.status(404).json({ error: 'not found' });
        return res.status(200).json({ success: true, user: { ...u, id: req.query.uid } });
      }

      // GET /api/users?username=xxx
      if (req.query.username) {
        const uname = req.query.username.toLowerCase();
        const fbRes  = await fetch(`${DB_URL}/users.json`);
        const fbData = await fbRes.json();
        if (!fbData) return res.status(404).json({ error: 'not found' });
        for (const [key, value] of Object.entries(fbData)) {
          if ((value.username || '').toLowerCase() === uname) {
            return res.status(200).json({ success: true, user: { ...value, id: key } });
          }
        }
        return res.status(404).json({ error: 'not found' });
      }

      // GET /api/users?email=xxx
      if (req.query.email) {
        const email = req.query.email.toLowerCase();
        const fbRes  = await fetch(`${DB_URL}/users.json`);
        const fbData = await fbRes.json();
        if (!fbData) return res.status(404).json({ error: 'not found' });
        for (const [key, value] of Object.entries(fbData)) {
          if (value.email === email) {
            return res.status(200).json({ success: true, user: { ...value, id: key } });
          }
        }
        return res.status(404).json({ error: 'not found' });
      }

      // GET /api/users?check_username=xxx — چێکی بەردەستبوونی username
      if (req.query.check_username) {
        const uname = req.query.check_username.toLowerCase();
        const fbRes  = await fetch(`${DB_URL}/users.json`);
        const fbData = await fbRes.json();
        if (!fbData) return res.status(200).json({ available: true });
        for (const value of Object.values(fbData)) {
          if ((value.username || '').toLowerCase() === uname) {
            return res.status(200).json({ available: false });
          }
        }
        return res.status(200).json({ available: true });
      }

      // GET /api/users — هەموو بەکارهێنەران
      const fbRes  = await fetch(`${DB_URL}/users.json`);
      const fbData = await fbRes.json();
      if (!fbData) return res.status(200).json({ success: true, users: [] });
      const users = Object.entries(fbData).map(([id, u]) => ({ id, ...u }));
      return res.status(200).json({ success: true, users });
    }

    // ════ POST — دروستکردنی بەکارهێنەری نوێ ════
    if (req.method === 'POST') {
      const { uid, email, name, username, role } = req.body;
      if (!uid || !email) return res.status(400).json({ error: 'uid and email required' });

      const existing = await fetch(`${DB_URL}/users/${uid}.json`);
      const exData   = await existing.json();
      if (exData) {
        return res.status(200).json({ success: true, message: 'exists', id: uid, user: exData });
      }

      // چێکی یەکتابوونی username
      if (username) {
        const fbRes  = await fetch(`${DB_URL}/users.json`);
        const fbData = await fbRes.json();
        if (fbData) {
          for (const value of Object.values(fbData)) {
            if ((value.username || '').toLowerCase() === username.toLowerCase()) {
              return res.status(409).json({ error: 'USERNAME_EXISTS' });
            }
          }
        }
      }

      const user = {
        email,
        name     : name     || '',
        username : username || '',
        role     : role     || 'user',
        blocked  : false,
        createdAt: Date.now(),
      };
      await fetch(`${DB_URL}/users/${uid}.json`, {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(user),
      });
      return res.status(200).json({ success: true, id: uid, user });
    }

    // ════ PUT — نوێکردنەوەی پرۆفایل ════
    if (req.method === 'PUT') {
      const { uid, email, role, blocked, name, username, avatar } = req.body;
      if (!uid && !email) return res.status(400).json({ error: 'uid or email required' });

      let targetKey = uid;

      if (!targetKey && email) {
        const fbRes  = await fetch(`${DB_URL}/users.json`);
        const fbData = await fbRes.json();
        if (!fbData) return res.status(404).json({ error: 'User not found' });
        for (const [key, value] of Object.entries(fbData)) {
          if (value.email === email) { targetKey = key; break; }
        }
        if (!targetKey) return res.status(404).json({ error: 'User not found' });
      }

      const r  = await fetch(`${DB_URL}/users/${targetKey}.json`);
      const u  = await r.json();
      if (!u) return res.status(404).json({ error: 'User not found' });

      // ئەگەر username نوێ بوو، یەکتابوونی چێک بکە
      if (username && username !== u.username) {
        const fbRes  = await fetch(`${DB_URL}/users.json`);
        const fbData = await fbRes.json();
        if (fbData) {
          for (const [key, value] of Object.entries(fbData)) {
            if (key !== targetKey && (value.username || '').toLowerCase() === username.toLowerCase()) {
              return res.status(409).json({ error: 'USERNAME_EXISTS' });
            }
          }
        }
      }

      const updated = { ...u };
      if (name     !== undefined) updated.name     = name;
      if (username !== undefined) updated.username = username;
      if (avatar   !== undefined) updated.avatar   = avatar;
      if (role     !== undefined) updated.role     = role;
      if (blocked  !== undefined) updated.blocked  = blocked;

      await fetch(`${DB_URL}/users/${targetKey}.json`, {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify(updated),
      });
      return res.status(200).json({ success: true, message: 'User updated' });
    }

    // ════ DELETE ════
    if (req.method === 'DELETE') {
      const { uid, email } = req.body;
      if (!uid && !email) return res.status(400).json({ error: 'uid or email required' });

      if (uid) {
        await fetch(`${DB_URL}/users/${uid}.json`, { method: 'DELETE' });
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
