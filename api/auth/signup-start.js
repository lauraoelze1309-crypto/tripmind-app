// /api/auth/signup-start.js
// Generates a 6-digit code, signs it into a stateless token, sends email.
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "tripmind-dev-secret-change-me";

function makeToken(email, code) {
  const expiry = Date.now() + 15 * 60 * 1000; // 15 min
  const payload = JSON.stringify({ email, code, expiry });
  const enc = Buffer.from(payload).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(enc).digest("hex");
  return `${enc}.${sig}`;
}

async function sendEmail(to, code) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Dev mode: print to server console
    console.log(`\n📧  VERIFICATION CODE for ${to}: ${code}\n`);
    return true;
  }
  const from = process.env.EMAIL_FROM || "TripMind <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject: "Your TripMind verification code",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#2F4156;margin-bottom:8px">Welcome to TripMind ✈️</h2>
          <p style="color:#567C8D;margin-bottom:28px">Use the code below to verify your email address.</p>
          <div style="background:#F5EFEB;border-radius:14px;padding:28px;text-align:center;margin-bottom:24px">
            <span style="font-size:42px;font-weight:900;letter-spacing:10px;color:#2F4156">${code}</span>
          </div>
          <p style="color:#8A9CAA;font-size:13px">This code expires in 15 minutes.<br/>If you didn't request this, you can ignore this email.</p>
        </div>`,
    }),
  });
  return r.ok;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { email } = req.body || {};
  if (!email || !email.includes("@"))
    return res.status(400).json({ error: "Invalid email address" });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const token = makeToken(email.trim().toLowerCase(), code);

  const sent = await sendEmail(email.trim(), code);
  if (!sent) return res.status(502).json({ error: "Failed to send email" });

  // Return token (signed — contains code, but only verifiable server-side)
  // In dev without RESEND_API_KEY we also return the code for easy testing
  const isDev = !process.env.RESEND_API_KEY;
  res.status(200).json({ token, ...(isDev ? { _devCode: code } : {}) });
}
