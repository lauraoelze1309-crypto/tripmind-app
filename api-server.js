#!/usr/bin/env node
/**
 * Local API server for development.
 * Serves /api/messages and /api/chat using the GROQ_API_KEY from .env.local
 * Replaces the old Python server dependency.
 */
import { readFileSync } from "fs";
import { createServer } from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local
function loadEnv() {
  try {
    const raw = readFileSync(join(__dirname, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=["']?(.+?)["']?\s*$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch (_) {}
}
loadEnv();

const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const PORT = 5174;
const AUTH_SECRET = process.env.AUTH_SECRET || "tripmind-dev-secret-change-me";

// ── Auth helpers ─────────────────────────────────────────────────────────────
function makeAuthToken(email, code) {
  const expiry = Date.now() + 15 * 60 * 1000;
  const enc = Buffer.from(JSON.stringify({ email, code, expiry })).toString("base64url");
  const sig = crypto.createHmac("sha256", AUTH_SECRET).update(enc).digest("hex");
  return `${enc}.${sig}`;
}
function verifyAuthToken(token, enteredCode) {
  try {
    const [enc, sig] = token.split(".");
    const expected = crypto.createHmac("sha256", AUTH_SECRET).update(enc).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig,"hex"), Buffer.from(expected,"hex")))
      return { valid:false, error:"Invalid token" };
    const { email, code, expiry } = JSON.parse(Buffer.from(enc,"base64url").toString());
    if (Date.now() > expiry) return { valid:false, error:"Code expired" };
    if (String(code) !== String(enteredCode)) return { valid:false, error:"Wrong code" };
    return { valid:true, email };
  } catch { return { valid:false, error:"Token error" }; }
}
async function sendVerificationEmail(to, code) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log(`\n📧  VERIFICATION CODE for ${to}: ${code}\n`); return true; }
  const from = process.env.EMAIL_FROM || "TripMind <onboarding@resend.dev>";
  const r = await fetch("https://api.resend.com/emails", {
    method:"POST",
    headers:{ Authorization:`Bearer ${key}`, "Content-Type":"application/json" },
    body: JSON.stringify({
      from, to,
      subject:"Your TripMind verification code",
      html:`<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#2F4156">Welcome to TripMind ✈️</h2>
        <p style="color:#567C8D;margin-bottom:24px">Use the code below to verify your email.</p>
        <div style="background:#F5EFEB;border-radius:14px;padding:28px;text-align:center">
          <span style="font-size:42px;font-weight:900;letter-spacing:10px;color:#2F4156">${code}</span>
        </div>
        <p style="color:#8A9CAA;font-size:13px;margin-top:20px">Expires in 15 minutes.</p></div>`
    })
  });
  return r.ok;
}

async function proxyGroq(incoming, maxTok) {
  const body = JSON.stringify({
    model: GROQ_MODEL,
    max_tokens: maxTok || 900,
    messages: incoming.messages || [],
    temperature: 0.7,
  });
  const resp = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_KEY}`,
      "Content-Type": "application/json",
    },
    body,
  });
  const data = await resp.json();
  if (!resp.ok) throw Object.assign(new Error(data?.error?.message || "Groq error"), { status: resp.status });
  const text = data.choices?.[0]?.message?.content || "";
  return {
    content: [{ type: "text", text }],
    role: "assistant",
    model: GROQ_MODEL,
    stop_reason: "end_turn",
  };
}

const server = createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  if (req.url === "/api/status" && req.method === "GET") {
    res.writeHead(200);
    res.end(JSON.stringify({ configured: !!GROQ_KEY }));
    return;
  }

  // ── Auth: signup start ────────────────────────────────────────────────────
  if (req.url === "/api/auth/signup-start" && req.method === "POST") {
    let body = ""; req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const { email } = JSON.parse(body);
        if (!email || !email.includes("@")) { res.writeHead(400); res.end(JSON.stringify({error:"Invalid email"})); return; }
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const token = makeAuthToken(email.trim().toLowerCase(), code);
        await sendVerificationEmail(email.trim(), code);
        const isDev = !process.env.RESEND_API_KEY;
        res.writeHead(200); res.end(JSON.stringify({ token, ...(isDev?{_devCode:code}:{}) }));
      } catch(e) { res.writeHead(500); res.end(JSON.stringify({error:e.message})); }
    }); return;
  }

  // ── Auth: signup verify ────────────────────────────────────────────────────
  if (req.url === "/api/auth/signup-verify" && req.method === "POST") {
    let body = ""; req.on("data", c => body += c);
    req.on("end", () => {
      try {
        const { token, code } = JSON.parse(body);
        const result = verifyAuthToken(token, code);
        res.writeHead(result.valid ? 200 : 400); res.end(JSON.stringify(result));
      } catch(e) { res.writeHead(500); res.end(JSON.stringify({error:e.message})); }
    }); return;
  }

  if ((req.url === "/api/messages" || req.url === "/api/chat") && req.method === "POST") {
    if (!GROQ_KEY) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: { type: "setup_required", message: "GROQ_API_KEY not configured" } }));
      return;
    }
    let body = "";
    req.on("data", c => body += c);
    req.on("end", async () => {
      try {
        const incoming = JSON.parse(body);
        const result = await proxyGroq(incoming, incoming.max_tokens);
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(err.status || 502);
        res.end(JSON.stringify({ error: { message: err.message } }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`\n  ✈️  TripMind API  →  http://localhost:${PORT}`);
  console.log(`  🔑 Groq key  →  ${GROQ_KEY ? "✓ ready" : "✗ not set (check .env.local)"}`);
  console.log();
});
