// /api/auth/signup-verify.js
// Verifies that the code the user entered matches the signed token.
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "tripmind-dev-secret-change-me";

function verifyToken(token, enteredCode) {
  try {
    const [enc, sig] = token.split(".");
    if (!enc || !sig) return { valid: false, error: "Malformed token" };

    // Verify signature
    const expected = crypto.createHmac("sha256", SECRET).update(enc).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")))
      return { valid: false, error: "Invalid token" };

    const { email, code, expiry } = JSON.parse(Buffer.from(enc, "base64url").toString());
    if (Date.now() > expiry) return { valid: false, error: "Code expired" };
    if (String(code) !== String(enteredCode)) return { valid: false, error: "Wrong code" };

    return { valid: true, email };
  } catch {
    return { valid: false, error: "Token error" };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, code } = req.body || {};
  if (!token || !code) return res.status(400).json({ valid: false, error: "Missing fields" });

  const result = verifyToken(token, code);
  res.status(result.valid ? 200 : 400).json(result);
}
