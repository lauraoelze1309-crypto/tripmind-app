// /api/auth/login.js
// Verifies password hash server-side (client sends email + passwordHash).
// Users are stored client-side in localStorage; this just validates the hash format.
// For a real multi-device app, swap localStorage for a DB here.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  // Login is fully client-side (localStorage lookup) for this MVP.
  // This endpoint is reserved for future server-side user store upgrade.
  res.status(200).json({ ok: true });
}
