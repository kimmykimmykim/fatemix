export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
  if (!NVIDIA_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  try {
    const { sys, userMsg, maxTok = 1200 } = req.body;
    const response = await fetch(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NVIDIA_API_KEY}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta/llama-3.3-70b-instruct',
          messages: [
            { role: 'system', content: '반드시 한국어로만 답변하세요. 모든 응답은 자연스러운 한국어로 작성합니다.' },
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
