export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
  if (!OPENROUTER_KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { sys, userMsg, maxTok = 1200 } = req.body;
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': 'https://fatemix.vercel.app',
          'X-Title': 'Fatemix'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout:free',
          messages: [
            { role: 'system', content: sys },
            { role: 'user', content: userMsg }
          ],
          max_tokens: maxTok,
          temperature: 0.8
        })
      }
    );
    const data = await response.json();
    if (data.choices?.[0]?.message?.content) {
      return res.status(200).json({ text: data.choices[0].message.content });
    }
    return res.status(500).json({ error: data.error?.message || JSON.stringify(data) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
