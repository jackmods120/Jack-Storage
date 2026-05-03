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
        // ئەگەر پێشتر ھەبوو، ھیچ ناکەین
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
