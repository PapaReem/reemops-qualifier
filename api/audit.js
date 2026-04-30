export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = req.headers["x-api-key"] || process.env.ANTHROPIC_API_KEY;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(attempt * 8000); // 8s, 16s, 24s between retries

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    if (response.status === 429) {
      lastError = 429;
      continue; // retry after delay
    }

    const data = await response.json();
    return res.status(response.status).json(data);
  }

  return res.status(429).json({ error: "Rate limited after 4 attempts. Try again in a minute." });
}
