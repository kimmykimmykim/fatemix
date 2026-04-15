export const config = { maxDuration: 60 };

// ── Rate limit: IP당 24시간 20회 ──
//   주의: 서버리스 인스턴스 메모리에 저장 → 인스턴스 재시작 시 초기화.
//   완벽한 차단 X, 일반 남용 방지 수준. 강제력 필요시 Vercel KV/Upstash 권장.
const RATE_LIMIT_MAX = 20;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const ipBuckets = new Map();

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  // 메모리 누수 방지: 1000개 초과 시 만료된 버킷 청소
  if (ipBuckets.size > 1000) {
    for (const [k, v] of ipBuckets) if (now > v.resetAt) ipBuckets.delete(k);
  }
  let bucket = ipBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    ipBuckets.set(ip, bucket);
  }
  bucket.count++;
  return {
    allowed: bucket.count <= RATE_LIMIT_MAX,
    remaining: Math.max(0, RATE_LIMIT_MAX - bucket.count),
    resetAt: bucket.resetAt,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  // ── Rate limit ──
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.floor(rl.resetAt / 1000)));
  if (!rl.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: '하루 사용 한도(20회)를 초과했습니다. 24시간 후 다시 시도해주세요.',
      resetAt: rl.resetAt
    });
  }

  try {
    const { sys, userMsg, maxTok = 1200 } = req.body;
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
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
