export const config = { maxDuration: 60 };

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: sys + '\n\n' + userMsg }] }],
          generationConfig: { 
            maxOutputTokens: maxTok, 
            temperature: 0.8,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );
    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts;
    if (parts) {
      // thinking 모드에서 parts[0]이 thought(thinking 내용)이고 parts[1]이 실제 응답일 수 있음
      // thought:true 가 아닌 첫 번째 텍스트 파트를 찾아야 함
      const textPart = parts.find(p => p.text && !p.thought);
      if (textPart) {
        return res.status(200).json({ text: textPart.text });
      }
    }
    return res.status(500).json({ error: data.error?.message || 'Gemini 오류' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
