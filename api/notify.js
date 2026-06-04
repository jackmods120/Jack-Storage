// api/notify.js — FCM V1 API + Service Account + Firebase DB Save

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  const DB_URL    = process.env.FIREBASE_DB_URL || 'https://alight-helper-default-rtdb.firebaseio.com';
  const PROJECT   = 'alight-helper';
  const FCM_URL   = `https://fcm.googleapis.com/v1/projects/${PROJECT}/messages:send`;

  // Service Account لە environment variable یان خۆی
  const SA_JSON = process.env.FCM_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FCM_SERVICE_ACCOUNT_KEY)
    : {
        "type": "service_account",
        "project_id": "alight-helper",
        "private_key_id": "c18291573cd56fab07e4945b1bac3347773b9143",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDBUqH3nUxK65J/\naoyD3hlBqK+z8XoR+N4XVORF6MQ9+bng6hNDoLBnDlhe1NNbPf3c3P632RaQwtry\ntTqzwmh5a8KisrMv2YWvJ3txMIsGEBwmQSbt4kzOPHKhQ/yLVS2dQM2aPVc8jM+Z\n2VvYweCQpsRmTmXgL4iWnSzFQ1SCQHPwCSDoUEV+98ARwXUhQupXMWbU9zCTAXWQ\nzi7pgXJpyyD2BG7mUPxvvIsLaX+phRUygJaZn+I51Cabl1XHEsHKHr7LIuqwgJO3\nRoY8/AOGsNvaazlBjK5C6K3EewZ/iTWDzsAM4NyM4IEtaGRIIm7+iflvmQ73BI+n\nTCPYC3gHAgMBAAECggEAPjvlMyq6mDW8y/LXeE4D0GzG30Uh2G5GxLkJ4W182zys\nt3hzKiatEwf9r82QmsNamYK1JycmCgUIafCojJzNeCUWG70uTP2X+RpbNUV8w79k\n6HW53AOpWQ0Bk+OohYwuqnxlk70ie7YS0MK1vBIxwi9Fc2/SgPicXmwLsRcrOeCJ\njRDkoa+V36KVacI6X2OkFcGkgZQHcz6nyR7x/qrVoTFb7uUzwQXlxn6vcx1nMgAc\nNpuo+0uh+z3mZXjxWPpwpD0Nu5mvg/zoBh9UbLylDUxTE4E7ooq2EN0oF0Aa48O2\n7YvqvzzTIJ0zPTiDbItLriO7qlAXcSMvLtryOa0LHQKBgQDjk1exmcx+uNPQhLIE\na8iIVpUlfGqKtqYFxTvKMPkQEapqIXpGjkCvDrn0h8eTd8oLD5UQblrnVF7JX6rj\n3Swry5NNMEns5uMVPZAnrwxbGHkbpG988qn39G0z5tSbb5EeWJtzti1f2hXIWJxF\nwIgDsGtQ18Yp1uPPviHpB1zoRQKBgQDZeBGCsKWfuUEizrqDB6/KouVJlp8ExUuC\noU5LlWaCEx7+5EzfT9vyJlRzm1Bm11ugUvXqeGktzPFfmIDDQwv4QSDgRC/Eak1w\nXPM+6fLQvBos5f9WdPhv34Az7P9UVKWmGYRKPmCbQ9n+nZomLGsl3L1KYIHZF3sX\nKrrvN86B2wKBgQDW7OKXIo9U5q10cr3FGx4KVOsKuhPM6W6maH1tGQ8/s89j6DYY\nyGQicCAC5vD/PtSb2Z2IJRDJBI94U1eLV+hNfDejYIWQrQWtm7S3JcTfi59lEckR\nEgSf3kH8EHaeTaGaLUiy4Uy9B7QmwDjmT0ylX0oa0Y2fGgmQuxo/f+qomQKBgD9x\n+CnYv3lJ4ub0yRVROMg1ng9KEjqiFNWXmfATNkTcrz5N/N9pvRF4fUr9FQfr7J9p\nlLVDS+xAzmrFY0uUU/mphp3nRshW+yC8/XptZpnfRwOyVjwzBAgffJepnRRNXcaH\ny0Cd0jF6Ki9Oa5qXeusg61i3rypW32Jy5PbFoUnhAoGAB+KCRKwXIjRd+0uMtH4q\nzCBuO2Z3681GMW2nozCAZ0hy53JtyDZcxlvFdxwFF+uLnoPsxs6NrpZ5nLikVrnx\njTYBLNpd4XNdsIfFok2s0z2pmk5saQCXRhY9xsxOxAicXktfvrsoCfiOK67NwWqt\nxfgNWp0DvaRAebWOUIwa+iM=\n-----END PRIVATE KEY-----\n",
        "client_email": "firebase-adminsdk-fbsvc@alight-helper.iam.gserviceaccount.com",
        "client_id": "106881217623533774110",
        "token_uri": "https://oauth2.googleapis.com/token"
      };

  try {
    const { title, body, poster, excludeUserId, targetUserId } = req.body;
    const notifType   = req.body.type       || 'new_post';
    const category    = req.body.category   || '';
    const postId      = req.body.postId     || '';
    const commentId   = req.body.commentId  || '';
    const fromName    = req.body.fromName   || '';
    const fromAvatar  = req.body.fromAvatar || '';

    // ── Access Token وەرگرتن ──────────────────────────────
    const accessToken = await getAccessToken(SA_JSON);

    // ── FCM Tokenەکان لە Firebase DB ─────────────────────
    const fbRes  = await fetch(`${DB_URL}/fcm_tokens.json`);
    const fbData = await fbRes.json();
    if (!fbData) return res.status(200).json({ success: true, sent: 0 });

    // ── کۆکردنەوەی userId یەکانی پێویست ────────────────────
    const targetUserIds = new Set();
    const tokens = [];

    for (const [userId, userTokens] of Object.entries(fbData)) {
      if (excludeUserId && userId === excludeUserId) continue;
      if (targetUserId && userId !== targetUserId) continue;
      if (typeof userTokens === 'object') {
        for (const [, val] of Object.entries(userTokens)) {
          if (val && val.token) {
            tokens.push({ userId, token: val.token });
            targetUserIds.add(userId);
          }
        }
      }
    }

    if (tokens.length === 0)
      return res.status(200).json({ success: true, sent: 0 });

    // ══════════════════════════════════════════════════════
    //  ذەخیرەکردنی ئاگادارکردنەوە بۆ Firebase Realtime DB
    //  بۆ هەر userId ی پێویست
    // ══════════════════════════════════════════════════════
    const timestamp = Date.now();
    const notifRecord = {
      type       : notifType,
      title      : title      || '',
      body       : body       || '',
      category   : category,
      postId     : postId,
      commentId  : commentId,
      fromName   : fromName,
      fromAvatar : fromAvatar,
      timestamp  : timestamp,
      read       : false,
    };

    // هەر userId تەنیا یەک جار تۆمار دەکرێت
    for (const uid of targetUserIds) {
      try {
        // کلیلی یەکتا: timestamp + random
        const notifKey = `${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
        await fetch(`${DB_URL}/notifications/${uid}/${notifKey}.json`, {
          method : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify(notifRecord),
        });
      } catch (dbErr) {
        console.error('DB save error for uid', uid, dbErr);
      }
    }

    // ── ناردن بۆ هەموو tokenەکان ─────────────────────────
    let sent = 0, failed = 0;
    for (const { token } of tokens) {
      try {
        const r = await fetch(FCM_URL, {
          method : 'POST',
          headers: {
            'Content-Type' : 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: title || 'پۆستی نوێ 🔔', body: body || '' },
              data: {
                title     : title       || '',
                body      : body        || '',
                poster    : poster      || '',
                type      : notifType,
                category  : category,
                postId    : postId,
                commentId : commentId,
                fromName  : fromName,
                fromAvatar: fromAvatar,
              },
              android: {
                priority: 'high',
                notification: {
                  channel_id: 'alight_helper_posts',
                  sound: 'default',
                  default_sound: true,
                  default_vibrate_timings: true,
                }
              }
            }
          }),
        });
        if (r.ok) { sent++; }
        else {
          failed++;
          const err = await r.json().catch(()=>({}));
          console.error('FCM error:', JSON.stringify(err));
        }
      } catch (e) { failed++; }
    }

    return res.status(200).json({ success: true, sent, failed, total: tokens.length });

  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// ══════════════════════════════════════════════════════
//  JWT Access Token دروستکردن بۆ FCM V1
// ══════════════════════════════════════════════════════
async function getAccessToken(sa) {
  const now    = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim  = {
    iss  : sa.client_email,
    sub  : sa.client_email,
    aud  : sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat  : now,
    exp  : now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
  };

  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64(header)}.${b64(claim)}`;

  // ── RSA-SHA256 署名 ───────────────────────────────────
  const crypto  = require('crypto');
  const sign    = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  sign.end();
  const signature = sign.sign(sa.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  // ── Token وەرگرتن ─────────────────────────────────────
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method : 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body   : new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion : jwt,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) throw new Error('Token failed: ' + JSON.stringify(tokenData));
  return tokenData.access_token;
}
