// api/forgot-password.js
// ناردنی ئیمێڵی ریسێتی پاسوۆرد لە ڕێگەی Firebase Auth-ـەوە

module.exports = async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { email } = req.body || {};

    if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "ئیمێڵ دروست نییە" });
    }

    const FIREBASE_KEY = process.env.FIREBASE_API_KEY;
    if (!FIREBASE_KEY) {
        return res.status(500).json({ error: "Firebase key نەدۆزرایەوە" });
    }

    try {
        const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    requestType: "PASSWORD_RESET",
                    email: email,
                }),
            }
        );

        const data = await response.json();

        if (data.error) {
            const code = data.error.message;
            // پەیامی کوردی بۆ هەڵەکان
            const msgs = {
                "EMAIL_NOT_FOUND":     "ئەم ئیمێڵە تۆمار نەکراوە",
                "INVALID_EMAIL":       "فۆرماتی ئیمێڵ هەڵەیە",
                "USER_DISABLED":       "ئەم ئەکاونتە بلۆک کراوە",
                "TOO_MANY_ATTEMPTS_TRY_LATER": "زۆر هەوڵی دایتەوە، کەمێک چاوەڕێ بکە",
            };
            return res.status(400).json({
                error: msgs[code] || "کێشەیەک ڕووی دا: " + code
            });
        }

        return res.status(200).json({
            success: true,
            message: "ئیمێڵی گۆڕینی پاسوۆرد نێردرا بۆ " + email
        });

    } catch (err) {
        return res.status(500).json({ error: "کێشە لە سێرڤەر: " + err.message });
    }
};
