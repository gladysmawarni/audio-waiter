// /api/session.ts (in a Vercel project)
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-realtime", // or gpt-realtime-preview
        },
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).send(err);
    }

    const data = await r.json();
    res.status(200).json(data);
  } catch (err) {
    console.error("Error creating ephemeral key:", err);
    res.status(500).json({ error: "Failed to create ephemeral key" });
  }
}
