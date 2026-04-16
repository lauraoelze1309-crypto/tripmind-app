export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "API key not configured" });
  }

  try {
    const body = req.body;
    const groqBody = {
      model: "llama-3.3-70b-versatile",
      max_tokens: body.max_tokens || 900,
      messages: body.messages || [],
    };

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(groqBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    // Groq response → Anthropic format (so frontend doesn't need changes)
    const anthropicResponse = {
      content: [{ type: "text", text: data.choices[0]?.message?.content || "" }],
      role: "assistant",
      model: groqBody.model,
      stop_reason: "end_turn",
    };

    return res.status(200).json(anthropicResponse);
  } catch (error) {
    return res.status(502).json({ error: error.message });
  }
}
