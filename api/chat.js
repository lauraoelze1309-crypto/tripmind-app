// /api/chat.js  — Secure backend proxy for the AI Travel Concierge
// The GROQ_API_KEY lives ONLY here (server-side env variable).
// The browser never sees it — it is not in any response, header, or bundle.

export default async function handler(req, res) {
  // Only POST is allowed
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Read key from server-side environment — NEVER from the request body
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Concierge not configured — GROQ_API_KEY missing on server" });
  }

  try {
    const body = req.body;

    // Forward to Groq API with the server-side key
    const groqBody = {
      model: "llama-3.3-70b-versatile",
      max_tokens: body.max_tokens || 1200,
      messages: body.messages || [],
      temperature: 0.7,
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,   // Key stays on the server
        "Content-Type": "application/json",
      },
      body: JSON.stringify(groqBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Upstream error" });
    }

    // Return in Anthropic-compatible format so the frontend doesn't need changes
    return res.status(200).json({
      content: [{ type: "text", text: data.choices[0]?.message?.content || "" }],
      role: "assistant",
      model: groqBody.model,
      stop_reason: "end_turn",
    });
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}
