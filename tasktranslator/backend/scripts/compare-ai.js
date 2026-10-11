// Compare Claude and Gemini on the same tasks using the app's real system prompt.
//   cd backend && node scripts/compare-ai.js            (needs ANTHROPIC_API_KEY and GEMINI_API_KEY in .env)
// It prints each answer and whether it parses as JSON, so you can judge quality and format side by side.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const m = src.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
if (!m) { console.error('Could not find SYSTEM_PROMPT in server.js'); process.exit(1); }
const SYSTEM_PROMPT = m[1];
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const TASKS = (process.argv.slice(2).length ? process.argv.slice(2) : [
  'clean my kitchen', 'write the email to my landlord', 'start my taxes', 'do laundry', 'call the doctor and book an appointment',
  'study for my exam tomorrow', 'reply to 40 unread messages', 'organize my closet', 'pay my bills', 'make dinner for the week'
]);

async function claude(task) {
  const a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const r = await a.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 900, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: 'Task: ' + task }] });
  return r.content[0].text;
}
async function gemini(task) {
  const cfg = { maxOutputTokens: 900, temperature: 0.7 };
  if (/flash/i.test(GEMINI_MODEL)) cfg.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents: [{ role: 'user', parts: [{ text: 'Task: ' + task }] }], generationConfig: cfg })
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
}
function parses(raw) {
  try { JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()); return 'JSON ok'; } catch { return 'NOT valid JSON'; }
}
(async () => {
  let ok = { claude: 0, gemini: 0 };
  for (const task of TASKS) {
    console.log('\n==== ' + task);
    for (const [name, fn] of [['claude', claude], ['gemini', gemini]]) {
      try { const raw = await fn(task); const p = parses(raw); if (p === 'JSON ok') ok[name]++; console.log(`--- ${name} (${p})\n${raw.trim()}`); }
      catch (e) { console.log(`--- ${name} FAILED: ${e.message}`); }
    }
  }
  console.log(`\nValid JSON: claude ${ok.claude}/${TASKS.length}, gemini ${ok.gemini}/${TASKS.length}`);
})();
