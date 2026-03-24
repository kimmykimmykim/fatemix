export const config = {
  maxDuration: 60
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { sys, userMsg, maxTok = 1200 } = req.body;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: sys + '\n\n' + userMsg }] }],
          generationConfig: { maxOutputTokens: maxTok, temperature: 0.8 }
        })
      }
    );
    const data = await response.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return res.status(200).json({ text: data.candidates[0].content.parts[0].text });
    }
    return res.status(500).json({ error: data.error?.message || 'Gemini 오류' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
