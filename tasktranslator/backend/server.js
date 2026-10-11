const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const Stripe = require('stripe');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const translatorFrontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const translatorIndexPath = path.join(translatorFrontendDist, 'index.html');
const localDevOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
const deployedFrontendOrigins = [
  'https://focus-step-frontend-main.onrender.com',
  'https://focusstep-bodydouble.onrender.com',
  'https://focusstepadhd.com',
  'https://www.focusstepadhd.com',
];
const allowedOrigins = new Set(
  [...localDevOrigins, ...deployedFrontendOrigins, process.env.FRONTEND_URL, ...(process.env.CORS_ORIGINS || '').split(',')]
    .map((origin) => origin?.trim())
    .filter(Boolean)
);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) return callback(null, true);
    console.warn(`[CORS blocked] ${origin}`);
    return callback(new Error('CORS blocked'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50kb' }));
app.use('/Translator', express.static(translatorFrontendDist));
app.use('/translator', express.static(translatorFrontendDist));

const USE_LOCAL_LM = process.env.USE_LOCAL_LM === 'true';
const AI_PROVIDER = (process.env.AI_PROVIDER || 'claude').toLowerCase();   // 'claude' (default) or 'gemini'
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const LM_STUDIO_BASE = process.env.LM_STUDIO_URL || 'http://localhost:1234';
const LM_STUDIO_URL = LM_STUDIO_BASE + '/v1/chat/completions';
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'local-model';
const USE_EMBEDDINGS = process.env.USE_EMBEDDINGS === 'true';
const LM_STUDIO_EMBED_URL = LM_STUDIO_BASE + '/v1/embeddings';
const LM_STUDIO_EMBED_MODEL = process.env.LM_STUDIO_EMBED_MODEL || 'nomic-ai/nomic-embed-text-v1.5-GGUF';
const SIMILARITY_THRESHOLD = parseFloat(process.env.SIMILARITY_THRESHOLD || '0.85');

const anthropic = (USE_LOCAL_LM || AI_PROVIDER === 'gemini') ? null : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CONFIG = {
  FREE_DAILY_LIMIT: 1,
  PLUS_DAILY_LIMIT: 3,
  PLANS: {
    FREE: 'free',
    PLUS: 'plus',
    UNLIMITED: 'unlimited',
  },
};
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

if (USE_LOCAL_LM) console.log(`[DEV] Using LM Studio at ${LM_STUDIO_URL} model="${LM_STUDIO_MODEL}"`);
else console.log(`[AI] provider=${AI_PROVIDER}` + (AI_PROVIDER === 'gemini' ? ` model=${GEMINI_MODEL}` : ''));
if (USE_EMBEDDINGS) console.log(`[EMBEDDINGS] Semantic search enabled — model="${LM_STUDIO_EMBED_MODEL}" threshold=${SIMILARITY_THRESHOLD}`);

function hashIp(ip) {
  const salt = process.env.IP_HASH_SALT || '';
  return crypto.createHash('sha256').update(`${salt}:${String(ip || 'unknown')}`).digest('hex').substring(0, 16);
}

function normalizeStoredCustomerPlan(plan) {
  if (!plan) return CONFIG.PLANS.FREE;
  if (plan === 'plus' || plan === 'monthly_3') return CONFIG.PLANS.PLUS;
  if (plan === 'unlimited' || plan === 'monthly_unlimited') return CONFIG.PLANS.UNLIMITED;
  if (plan === 'monthly' || plan === 'pro' || plan === 'lifetime') return CONFIG.PLANS.UNLIMITED;
  return CONFIG.PLANS.FREE;
}

function getDailyLimitForPlan(plan) {
  const normalized = normalizeStoredCustomerPlan(plan);
  if (normalized === CONFIG.PLANS.FREE) return CONFIG.FREE_DAILY_LIMIT;
  if (normalized === CONFIG.PLANS.PLUS) return CONFIG.PLUS_DAILY_LIMIT;
  return null;
}

// Google Gemini via the plain REST API (no extra package). Used when AI_PROVIDER=gemini.
async function callGemini(systemPrompt, userContent, maxTokens) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const generationConfig = { maxOutputTokens: maxTokens, temperature: 0.7 };
  // Flash models "think" first and that eats the output budget; turn it off so the JSON is not cut short.
  if (/flash/i.test(GEMINI_MODEL)) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig
    })
  });
  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const cand = json.candidates && json.candidates[0];
  const text = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts.map((p) => p.text || '').join('') : '';
  if (!text) {
    const why = (cand && cand.finishReason) || (json.promptFeedback && json.promptFeedback.blockReason) || 'no candidates';
    throw new Error(`Gemini returned no text (${why})`);
  }
  return text;
}

async function callAI(systemPrompt, userContent, maxTokens) {
  if (!USE_LOCAL_LM && AI_PROVIDER === 'gemini') return callGemini(systemPrompt, userContent, maxTokens);
  if (USE_LOCAL_LM) {
    const res = await fetch(LM_STUDIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: LM_STUDIO_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }], max_tokens: maxTokens, temperature: 0.7 })
    });
    if (!res.ok) throw new Error(`LM Studio error: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return json.choices[0].message.content;
  }
  const message = await anthropic.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, system: systemPrompt, messages: [{ role: 'user', content: userContent }] });
  return message.content[0].text;
}

const usageMap = new Map();

setInterval(() => {
  const today = new Date().toDateString();
  for (const key of usageMap.keys()) {
    if (!key.endsWith(today)) usageMap.delete(key);
  }
}, 60 * 60 * 1000);

function getRateLimitKey(ip) { return `${ip}:${new Date().toDateString()}`; }
function checkRateLimit(ip) { return usageMap.get(getRateLimitKey(ip)) || 0; }
function incrementUsage(ip) { const key = getRateLimitKey(ip); usageMap.set(key, (usageMap.get(key) || 0) + 1); }

async function getProStatus(email) {
  if (!email) return { isPro: false, plan: CONFIG.PLANS.FREE, limit: CONFIG.FREE_DAILY_LIMIT };

  const { data: customer } = await supabase
    .from('customers')
    .select('plan, is_pro')
    .eq('email', email)
    .maybeSingle();

  if (customer?.plan || customer?.is_pro != null) {
    const plan = customer?.is_pro === false ? CONFIG.PLANS.FREE : normalizeStoredCustomerPlan(customer?.plan);
    return { isPro: plan !== CONFIG.PLANS.FREE, plan, limit: getDailyLimitForPlan(plan) };
  }

  const { data } = await supabase.from('users').select('plan').eq('email', email).maybeSingle();
  const plan = normalizeStoredCustomerPlan(data?.plan);
  return { isPro: plan !== CONFIG.PLANS.FREE, plan, limit: getDailyLimitForPlan(plan) };
}

// Trust the plan forwarded by the bodydouble Next.js proxy (verified via shared Supabase service role key)
function getProStatusFromProxy(req) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || req.headers['x-proxy-secret'] !== secret) return null;
  const plan = normalizeStoredCustomerPlan(req.headers['x-user-plan'] || CONFIG.PLANS.FREE);
  return { isPro: plan !== CONFIG.PLANS.FREE, plan, limit: getDailyLimitForPlan(plan) };
}

async function upsertCustomer(email, fields) {
  const mapped = {};
  if ('plan' in fields) {
    mapped.plan = normalizeStoredCustomerPlan(fields.plan);
    mapped.is_pro = mapped.plan !== CONFIG.PLANS.FREE;
  }
  if ('is_pro' in fields && !('plan' in fields)) {
    mapped.is_pro = !!fields.is_pro;
  }
  if (fields.stripe_customer_id !== undefined) mapped.stripe_customer_id = fields.stripe_customer_id;
  if (fields.stripe_session_id !== undefined) mapped.stripe_session_id = fields.stripe_session_id;
  if (fields.pro_expires_at !== undefined) mapped.pro_expires_at = fields.pro_expires_at;
  if (fields.referral_code !== undefined) mapped.referral_code = fields.referral_code;
  if (fields.referred_by !== undefined) mapped.referred_by = fields.referred_by;
  if (fields.full_name !== undefined) mapped.full_name = fields.full_name;

  const { error } = await supabase.from('customers').upsert(
    { email, ...mapped },
    { onConflict: 'email' }
  );
  if (error) console.error('Supabase upsert error:', error.message);
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

async function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Invalid session' });

  req.authUser = data.user;
  next();
}

async function optionalAuth(req, res, next) {
  const token = getBearerToken(req);
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) req.authUser = data.user;
  }
  next();
}

// Words stripped before hashing so slight rephrasing hits the same cache entry
const FILLER_WORDS = /\b(please|can you|could you|help me|i need to|i want to|i have to|i've got to|how (do i|to)|let's|let me|gonna|going to|need to|want to|the|a|an|my|some|just|really|quickly|now|today)\b/gi;

function normalizeTask(text) {
  return text.toLowerCase().replace(FILLER_WORDS, '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

// lookup_key is the normalized plaintext stored directly in the DB.
// No hashing means normalization changes never invalidate old rows.
function makeLookupKey(type, data) {
  const cleaned = { type };
  for (const [k, v] of Object.entries(data)) {
    cleaned[k] = typeof v === 'string' ? normalizeTask(v) : v;
  }
  return JSON.stringify(cleaned).replace(/\s+/g, ' ').toLowerCase();
}

async function getEmbedding(text) {
  const res = await fetch(LM_STUDIO_EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LM_STUDIO_EMBED_MODEL, input: normalizeTask(text) })
  });
  if (!res.ok) throw new Error(`Embedding error: ${res.status}`);
  const json = await res.json();
  return json.data[0].embedding;
}

async function getCached(lookupKey, queryText) {
  // 1. Exact key match
  const { data } = await supabase.from('translations_cache').select('response, hit_count, cache_key').eq('cache_key', lookupKey).single();
  if (data) {
    await supabase.from('translations_cache').update({ hit_count: (data.hit_count || 1) + 1, last_used_at: new Date().toISOString() }).eq('cache_key', lookupKey);
    return data.response;
  }

  // 2. Semantic similarity search
  if (USE_EMBEDDINGS && queryText) {
    try {
      const embedding = await getEmbedding(queryText);
      const { data: matches } = await supabase.rpc('match_cache', { query_embedding: embedding, similarity_threshold: SIMILARITY_THRESHOLD, match_count: 1 });
      if (matches?.length > 0) {
        console.log(`🧠 Semantic HIT (${(matches[0].similarity * 100).toFixed(1)}% match) for: "${queryText}"`);
        await supabase.from('translations_cache').update({ hit_count: 1, last_used_at: new Date().toISOString() }).eq('cache_key', matches[0].cache_key);
        return matches[0].response;
      }
    } catch { /* embedding model not available — fall through to AI */ }
  }

  return null;
}

async function storeCache(lookupKey, type, inputData, response) {
  let embedding = null;
  if (USE_EMBEDDINGS && inputData.task) {
    try { embedding = await getEmbedding(inputData.task); } catch { /* skip if model not loaded */ }
  }
  const row = { cache_key: lookupKey, input_type: type, input_data: inputData, response, created_at: new Date().toISOString(), last_used_at: new Date().toISOString(), hit_count: 1 };
  if (embedding) row.embedding = embedding;
  const { error } = await supabase.from('translations_cache').upsert(row, { onConflict: 'cache_key' });
  if (error) {
    console.error('❌ Cache write FAILED:', error.message, '| code:', error.code);
  } else {
    console.log('✓ Cached to DB:', type, '-', JSON.stringify(inputData).slice(0, 60));
  }
}

// ── Pre-warm queue ────────────────────────────────────────────────
// Processes one task at a time so LM Studio is never flooded
const prewarmQueue = new Set(); // Set deduplicates automatically
let prewarmRunning = false;

async function processQueue() {
  if (prewarmRunning || prewarmQueue.size === 0) return;
  prewarmRunning = true;
  for (const task of prewarmQueue) {
    prewarmQueue.delete(task);
    const key = makeLookupKey('translate', { task });
    const { data } = await supabase.from('translations_cache').select('cache_key').eq('cache_key', key).maybeSingle();
    if (data) continue; // already cached — skip without incrementing hit_count
    try {
      const raw = await callAI(SYSTEM_PROMPT, 'Task: ' + task, 900);
      const p = parseJSON(raw);
      if (p?.steps) {
        if (p.steps.length > 5) p.steps = p.steps.slice(0, 5);
        await storeCache(key, 'translate', { task }, p);
        console.log('🔥 Pre-warmed:', task);
      }
    } catch { /* skip silently */ }
  }
  prewarmRunning = false;
}

async function prewarmRelated(task) {
  try {
    const raw = await callAI(
      'Return 4 closely related ADHD tasks as a JSON array of short strings (3-6 words each). Return ONLY the array. Example: ["clean the fridge","tidy the counters","wipe the stovetop","empty the trash"]',
      'Task: ' + task, 200
    );
    const arr = JSON.parse(raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim().match(/\[[\s\S]*\]/)?.[0] || '[]');
    arr.slice(0, 4).filter(t => typeof t === 'string').forEach(t => prewarmQueue.add(t.trim()));
    processQueue(); // fire and forget
  } catch { /* skip silently */ }
}

// ── Shared cache+AI handler ───────────────────────────────────────
const TEST_MODE = process.env.TEST_MODE === 'true';
if (TEST_MODE) console.log('[TEST MODE] AI disabled — database lookups only');

async function runCached(type, inputData, prompt, userContent, maxTokens, postProcess) {
  const key = makeLookupKey(type, inputData);
  const cached = await getCached(key, inputData.task || null);
  if (cached) {
    console.log('✅ Cache HIT:', key.slice(0, 80));
    return { result: cached, key, fromCache: true };
  }
  console.log('❌ Cache MISS:', key.slice(0, 80));
  if (TEST_MODE) return { result: null, key, fromCache: false, notCached: true };
  const raw = await callAI(prompt, userContent, maxTokens);
  const parsed = parseJSON(raw);
  if (parsed === null) return { result: null, key, fromCache: false, parseError: true };
  if (postProcess) postProcess(parsed);
  await storeCache(key, type, inputData, parsed);
  return { result: parsed, key, fromCache: false };
}

function parseJSON(raw) {
  // strip Qwen3 / deepseek thinking blocks
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // strip markdown code fences
  cleaned = cleaned.replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
  // extract first {...} block in case there's surrounding text
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];
  if (process.env.USE_LOCAL_LM === 'true') console.log('[LM raw]', raw.slice(0, 300));
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are a calm, supportive task translator for people with ADHD. Break down tasks into clear, specific steps that feel doable — not overwhelming.

STRICT RULES:
- Return 3 to 5 steps maximum. Never more than 5.
- Each step = ONE single visible action only. Never combine multiple actions.
- Every step should feel doable in under 30 seconds.
- Use direct concrete verbs like open, click, pick up, type, put, walk, find.
- The action field must be 2 to 7 words. No punctuation unless required.
- The detail field should usually be empty.
- Only use detail when the action would be confusing without one extra concrete clue.
- If detail is needed, it must be ONE short clause. Max 8 words.
- No future habits, no follow-up tasks, no going forward advice.
- No planning language.
- No abstract verbs like organize, plan, review, handle, figure out, prepare.
- No step may contain "and", "then", "after", "before", or "if needed".
- Use calm, plain language. Active verbs only.
- Never use should, must, need to, have to.
- The startHere is the single smallest physical action to begin. One sentence. Very specific.
- Also generate ONE follow-up question that would make the steps more specific if answered.

BAD step: "Organize your inbox and answer important emails."
GOOD step: "Open your inbox"

BAD step: "Get your cleaning supplies ready."
GOOD step: "Pick up the spray bottle"

Respond ONLY with valid JSON:
{"simplified":"One clear sentence","startHere":"Smallest first action","startTime":"5 min","followUpQuestion":"One short question","steps":[{"action":"Short action","detail":""}]}`;

const REFINE_PROMPT = `You are a calm task translator for ADHD brains. The user answered a follow-up question. Return updated steps that are more targeted.

STRICT RULES:
- Return 3 to 5 steps maximum.
- Each step = one single visible action.
- Every step should feel doable in under 30 seconds.
- Action field: 2 to 7 words.
- Detail should usually be empty.
- If detail is needed, use one short clause. Max 8 words.
- No planning language. No abstract verbs.
- No "and", "then", "after", "before", or "if needed".
- Calm, plain language. Active verbs. No shame.

Respond ONLY with valid JSON:
{"simplified":"Refined task sentence","startHere":"Smallest first action","startTime":"5 min","steps":[{"action":"Short action","detail":""}]}`;

const HELP_STEP_PROMPT = `You are a calm assistant for ADHD brains stuck on one step of a task.

Break the step into 3 even smaller actions. Be brutally short.

STRICT RULES:
- helpText: ONE sentence only. Max 6 words. Calm and direct.
- subSteps: exactly 3 items. Each item = ONE action. Max 6 words each. No explanations.
- The first subStep must be the smallest immediate move.
- suggestedQuestions: exactly 3 items. Max 6 words each.
- NO long sentences. NO paragraphs. NO extra context.
- No "and", "then", or planning words.
- If you write more than 6 words in a subStep, you have failed.

BAD subStep: "Stand in front of a mirror in your full outfit and raise both arms up to shoulder height, then down at your sides."
GOOD subStep: "Raise both arms to shoulder height."

Respond ONLY with valid JSON:
{"helpText":"One calm sentence here.","subSteps":["Action one.","Action two.","Action three."],"suggestedQuestions":["Question one?","Question two?","Question three?"]}`;

const MODERATION_PROMPT = `You are a strict safety gate for FocusStep, an ADHD task breakdown app.

Your task is to decide whether a user's input must be blocked before any step-by-step help is generated.

Use a safety-first standard. If there is meaningful risk that the user is requesting help with abuse, hate, harassment, violence, exploitation, intimidation, or illegal harm, block it.

BLOCK if the input includes or requests:
- racist slurs, hate speech, or degrading language about protected groups
- harassment, bullying, humiliation, revenge, intimidation, or manipulation
- threats of violence, fantasies of harming someone, or instructions to hurt someone
- domestic abuse, coercive control, stalking, doxxing, blackmail, or extortion
- sexual exploitation, grooming, coercion, assault, or abuse
- illegal harmful acts, evasion, vandalism, theft, fraud, or sabotage
- self-harm or suicide instructions
- abusive “how do I make someone…” tasks intended to scare, control, shame, punish, or exploit

ALLOW ONLY if the user is clearly:
- asking for help staying safe
- de-escalating conflict
- leaving abuse
- reporting harm
- processing or describing a harmful event without asking to carry it out
- discussing harmful language in a clearly educational, condemnatory, or reporting context

STRICT RULES:
- When uncertain, block.
- Do not give the benefit of the doubt to hostile or ambiguous phrasing.
- Profanity alone is not enough to block, but profanity combined with threats, slurs, demeaning intent, revenge, or coercion should be blocked.
- If the input appears targeted at a person or group in a degrading or controlling way, block it.
- If the task could plausibly cause emotional, physical, sexual, legal, or reputational harm, block it.
- Ignore whether the request sounds casual, joking, sarcastic, or exaggerated. Judge the underlying harmful intent.

Return ONLY valid JSON in this format:
{"allow":true,"severity":"none","category":"none","reason":"short explanation"}

If it should be blocked, return ONLY:
{"allow":false,"severity":"high","category":"hate|harassment|violence|sexual_abuse|illegal_harm|self_harm|doxxing|abuse","reason":"short explanation"}`;

const HARD_BLOCK_PATTERNS = [
  { category: 'hate', pattern: /\b(nigger|nigga|faggot|kike|chink|spic|wetback|raghead|tranny)\b/i },
  { category: 'self_harm', pattern: /\b(how to kill myself|kill myself|commit suicide|how to self harm|cut myself)\b/i },
  { category: 'violence', pattern: /\b(kill him|kill her|kill them|beat him up|beat her up|shoot him|shoot her|stab him|stab her)\b/i },
];

function localModerationCheck(text) {
  const normalized = String(text || '').trim();
  for (const entry of HARD_BLOCK_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return { allow: false, severity: 'high', category: entry.category, reason: 'Matched blocked phrase pattern.' };
    }
  }
  return { allow: true, severity: 'none', category: 'none', reason: 'No hard-block phrase matched.' };
}

async function moderateTaskInput(text) {
  const localCheck = localModerationCheck(text);
  if (!localCheck.allow) return localCheck;
  try {
    const raw = await callAI(MODERATION_PROMPT, `User input:\n${String(text || '').trim()}`, 220);
    const parsed = parseJSON(raw);
    if (typeof parsed?.allow === 'boolean') return parsed;
  } catch (err) {
    console.warn('Moderation unavailable:', err.message);
    return { allow: false, severity: 'low', category: 'unavailable', reason: 'Moderation unavailable.' };
  }
  return { allow: true, severity: 'none', category: 'none', reason: 'Moderation fallback allow.' };
}

function stringifyShareContent(task, result) {
  const parts = [task, result?.simplified, result?.startHere];
  if (Array.isArray(result?.steps)) {
    result.steps.forEach((step) => {
      if (!step) return;
      if (typeof step === 'string') parts.push(step);
      else parts.push(step.action, step.detail);
    });
  }
  return parts.filter(Boolean).join('\n');
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  return (forwarded ? forwarded.split(',')[0].trim() : null)
    || req.ip
    || req.socket?.remoteAddress
    || 'unknown';
}

function rateLimitCheck(ip, limit, res) {
  if (limit == null) return true;
  if (checkRateLimit(ip) >= limit) {
    res.status(429).json({ error: 'Daily limit reached', limitReached: true, usage: checkRateLimit(ip), limit });
    return false;
  }
  return true;
}

function usagePayload(ip, limit) {
  return { usage: limit == null ? null : checkRateLimit(ip), limit };
}

// Translate
app.post('/translate', optionalAuth, async (req, res) => {
  const ip = getClientIp(req);
  const { task, email: bodyEmail } = req.body;
  const email = req.authUser?.email ?? bodyEmail;
  if (!task || typeof task !== 'string' || task.trim().length < 3) return res.status(400).json({ error: 'Please enter a task to translate.' });
  const status = getProStatusFromProxy(req) ?? await getProStatus(email);
  try {
    const moderation = await moderateTaskInput(task.trim());
    if (!moderation.allow) {
      return res.status(400).json({
        error: "I can't help break down harmful or abusive tasks. If you want, I can help rewrite it into something safe and respectful.",
        blocked: true,
        moderation,
      });
    }
    const { result, fromCache, notCached, parseError } = await runCached('translate', { task: task.trim() }, SYSTEM_PROMPT, 'Task: ' + task.trim(), 900, p => { if (p.steps?.length > 5) p.steps = p.steps.slice(0, 5); });
    if (notCached) return res.status(404).json({ error: 'Not in database yet. Start LM Studio to generate and cache this task.' });
    if (parseError || result === null) return res.status(503).json({ error: 'Could not understand the AI response — please try again.' });
    if (!rateLimitCheck(ip, status.limit, res)) return;
    if (status.limit != null) incrementUsage(ip);
    res.json({ ...result, isPro: status.isPro, plan: status.plan, fromCache, ...usagePayload(ip, status.limit) });
    if (!fromCache) prewarmRelated(task.trim());
  } catch (err) { console.error('Translate error:', err.message); res.status(500).json({ error: 'Translation failed. Please try again.' }); }
});

// Refine
app.post('/refine', optionalAuth, async (req, res) => {
  const ip = getClientIp(req);
  const { task, question, answer, email: bodyEmail } = req.body;
  const email = req.authUser?.email ?? bodyEmail;
  if (!task || !answer) return res.status(400).json({ error: 'Task and answer required.' });
  const status = getProStatusFromProxy(req) ?? await getProStatus(email);
  try {
    const content = `Original task: ${task.trim()}\nFollow-up question: ${question}\nUser answer: ${answer.trim()}`;
    const { result, fromCache, parseError } = await runCached('refine', { task: task.trim(), question, answer: answer.trim() }, REFINE_PROMPT, content, 900, p => { if (p.steps?.length > 5) p.steps = p.steps.slice(0, 5); });
    if (parseError || result === null) return res.status(503).json({ error: 'Could not understand the AI response — please try again.' });
    if (!rateLimitCheck(ip, status.limit, res)) return;
    if (status.limit != null) incrementUsage(ip);
    res.json({ ...result, isPro: status.isPro, plan: status.plan, fromCache, ...usagePayload(ip, status.limit) });
  } catch (err) { console.error('Refine error:', err.message); res.status(500).json({ error: 'Refinement failed.' }); }
});

// Help with a specific step
app.post('/help-step', optionalAuth, async (req, res) => {
  const ip = getClientIp(req);
  const { task, stepAction, stepDetail, question, email: bodyEmail } = req.body;
  const email = req.authUser?.email ?? bodyEmail;
  if (!task || !stepAction) return res.status(400).json({ error: 'Task and step required.' });
  const status = getProStatusFromProxy(req) ?? await getProStatus(email);
  try {
    const parts = ['Overall task: ' + task, 'Step: ' + stepAction];
    if (stepDetail) parts.push('Step detail: ' + stepDetail);
    parts.push(question ? 'Stuck on: ' + question : 'User needs more help with this step.');
    const { result, fromCache, parseError } = await runCached('help-step', { task, stepAction, stepDetail: stepDetail || '', question: question || '' }, HELP_STEP_PROMPT, parts.join('\n'), 600, p => {
      if (p.subSteps?.length > 3) p.subSteps = p.subSteps.slice(0, 3);
      // Hard-truncate overly long sub-steps to keep UI clean
      if (p.subSteps) p.subSteps = p.subSteps.map(s => {
        const words = s.split(' ');
        return words.length > 15 ? words.slice(0, 15).join(' ') + '.' : s;
      });
      if (p.helpText) {
        const words = p.helpText.split(' ');
        if (words.length > 20) p.helpText = words.slice(0, 20).join(' ') + '.';
      }
    });
    if (parseError || result === null) return res.status(503).json({ error: 'Could not understand the AI response — please try again.' });
    if (!fromCache && !rateLimitCheck(ip, status.limit, res)) return;
    if (!fromCache && status.limit != null) incrementUsage(ip);
    res.json({ ...result, isPro: status.isPro, plan: status.plan, fromCache, ...usagePayload(ip, status.limit) });
  } catch (err) { console.error('Help step error:', err.message); res.status(500).json({ error: 'Could not get help. Please try again.' }); }
});

// Pro status
// Cache stats — dev only
app.get('/cache-stats', async (_req, res) => {
  const { data, error } = await supabase
    .from('translations_cache')
    .select('input_type, input_data, hit_count, created_at, last_used_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ total: data.length, entries: data });
});

app.get('/pro-status', requireAuth, async (req, res) => {
  const email = req.authUser.email;
  const { isPro, plan, limit } = await getProStatus(email);
  res.json({ isPro, plan, limit });
});

// Usage
app.get('/usage', optionalAuth, async (req, res) => {
  const ip = getClientIp(req);
  const status = req.authUser?.email ? await getProStatus(req.authUser.email) : { limit: CONFIG.FREE_DAILY_LIMIT };
  res.json({ usage: status.limit == null ? null : checkRateLimit(ip), limit: status.limit });
});

app.post('/analytics/page-view', async (req, res) => {
  const {
    pageKey,
    path,
    sessionId,
    userId,
    userEmail,
    referrer,
    utmSource,
    utmMedium,
    utmCampaign,
  } = req.body || {};

  if (!pageKey || !sessionId) return res.status(400).json({ error: 'pageKey and sessionId required' });

  let referrerDomain = null;
  try {
    if (referrer) referrerDomain = new URL(referrer).hostname || null;
  } catch {}

  try {
    await supabase.from('page_analytics_events').insert({
      page_key: pageKey,
      path: path || '/',
      session_id: sessionId,
      user_id: userId || null,
      user_email: userEmail || null,
      ip_hash: hashIp(getClientIp(req)),
      referrer_domain: referrerDomain,
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      user_agent: req.headers['user-agent'] || null,
    });
  } catch (err) {
    console.warn('Analytics page-view skipped:', err.message);
  }

  res.json({ ok: true });
});

// ── Systeme.io lead capture ───────────────────────────────────────────────────
app.post('/capture-lead', async (req, res) => {
  const { firstName, email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'email required' });

  const apiKey = process.env.SYSTEME_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Lead capture not configured' });

  try {
    const tagIds = process.env.SYSTEME_TAG_IDS
      ? process.env.SYSTEME_TAG_IDS.split(',').map(t => parseInt(t.trim(), 10)).filter(Boolean)
      : [];

    const inferredFirstName = String(firstName || '')
      .trim()
      || String(email).split('@')[0].replace(/[._-]+/g, ' ').trim().slice(0, 40)
      || 'FocusStep friend';

    const body = { email, fields: [{ slug: 'first_name', value: inferredFirstName }] };
    if (tagIds.length) body.tagIds = tagIds;

    const response = await fetch('https://api.systeme.io/api/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Systeme.io error:', response.status, err);
      // 422 = contact already exists — treat as success so UX is clean
      if (response.status !== 422) return res.status(502).json({ error: 'Lead capture failed' });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('capture-lead error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Billing portal
app.post('/billing-portal', requireAuth, async (req, res) => {
  const email = req.authUser.email;
  if (!email) return res.status(400).json({ error: 'Email required.' });
  try {
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (!customers.data.length) return res.status(404).json({ error: 'No billing account found.' });
    const session = await stripe.billingPortal.sessions.create({ customer: customers.data[0].id, return_url: process.env.FRONTEND_URL || 'http://localhost:5173' });
    res.json({ url: session.url });
  } catch (err) { console.error('Billing portal error:', err.message); res.status(500).json({ error: 'Could not open billing portal.' }); }
});

// Create checkout
app.post('/create-checkout', async (req, res) => {
  const { plan, email } = req.body;
  if (!plan || ![CONFIG.PLANS.PLUS, CONFIG.PLANS.UNLIMITED].includes(plan)) return res.status(400).json({ error: 'Invalid plan.' });
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    let sessionConfig = { customer_email: email || undefined, metadata: { plan }, success_url: baseUrl + '/success?session_id={CHECKOUT_SESSION_ID}', cancel_url: baseUrl + '/pricing' };
    if (plan === CONFIG.PLANS.PLUS) {
      sessionConfig.mode = 'subscription';
      sessionConfig.line_items = [{ price_data: { currency: 'usd', product_data: { name: 'FocusStep Plus', description: 'Three ADHD-friendly translations per day' }, unit_amount: 900, recurring: { interval: 'month' } }, quantity: 1 }];
    } else {
      sessionConfig.mode = 'subscription';
      sessionConfig.line_items = [{ price_data: { currency: 'usd', product_data: { name: 'FocusStep Unlimited', description: 'Unlimited ADHD-friendly translations per day' }, unit_amount: 1900, recurring: { interval: 'month' } }, quantity: 1 }];
    }
    const session = await stripe.checkout.sessions.create(sessionConfig);
    res.json({ url: session.url });
  } catch (err) { console.error('Stripe error:', err.message); res.status(500).json({ error: 'Could not create checkout session.' }); }
});

// ── Referral helpers ──────────────────────────────────────

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function ensureReferralCode(email) {
  const { data } = await supabase.from('users').select('referral_code').eq('email', email).single();
  if (data?.referral_code) return data.referral_code;
  let code, attempts = 0;
  do {
    code = generateReferralCode();
    const { data: existing } = await supabase.from('users').select('email').eq('referral_code', code).maybeSingle();
    if (!existing) break;
  } while (++attempts < 10);
  await supabase.from('users').upsert({ email, referral_code: code }, { onConflict: 'email' });
  return code;
}

function calcProExpiry(currentExpiry, daysToAdd) {
  const base = currentExpiry && new Date(currentExpiry) > new Date() ? new Date(currentExpiry) : new Date();
  return new Date(base.getTime() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
}

const DEFAULT_REFERRAL_PROGRAM_SETTINGS = {
  programEnabled: true,
  maxRewardDays: 90,
};

async function getReferralProgramSettings() {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'referral_program')
    .maybeSingle();

  const value = data?.value && typeof data.value === 'object' ? data.value : {};
  const parsedCap = Number.parseInt(value.maxRewardDays, 10);

  return {
    programEnabled: value.programEnabled !== false,
    maxRewardDays: Number.isFinite(parsedCap) ? Math.max(0, parsedCap) : DEFAULT_REFERRAL_PROGRAM_SETTINGS.maxRewardDays,
  };
}

async function saveReferralProgramSettings(nextSettings) {
  const settings = {
    programEnabled: nextSettings.programEnabled !== false,
    maxRewardDays: Math.max(0, Number.parseInt(nextSettings.maxRewardDays, 10) || 0),
  };

  await supabase.from('app_settings').upsert({
    key: 'referral_program',
    value: settings,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'key' });

  return settings;
}

async function getIssuedReferralDays(recipientEmail) {
  const { data: rewards } = await supabase
    .from('referral_rewards')
    .select('reward_value')
    .eq('reward_recipient_email', recipientEmail)
    .eq('reward_type', 'pro_days')
    .eq('status', 'issued');

  return (rewards || []).reduce((sum, reward) => sum + (reward.reward_value || 0), 0);
}

// Find the best matching reward rule for a referrer type + purchased plan
async function matchRewardRule(referrerPlan, purchasedPlan) {
  const { data: rules } = await supabase.from('referral_reward_rules')
    .select('*').eq('enabled', true).order('created_at', { ascending: true });
  if (!rules?.length) return null;
  // Exact match first, then 'any' fallbacks
  return rules.find(r => r.referrer_plan === referrerPlan && r.trigger_plan === purchasedPlan)
    || rules.find(r => r.referrer_plan === referrerPlan && r.trigger_plan === 'any')
    || rules.find(r => r.referrer_plan === 'any' && r.trigger_plan === purchasedPlan)
    || rules.find(r => r.referrer_plan === 'any' && r.trigger_plan === 'any')
    || null;
}

async function issueProDays(recipientEmail, daysToAdd, adminEmail = null) {
  const { data: customer } = await supabase.from('users').select('pro_expires_at').eq('email', recipientEmail).maybeSingle();
  const newExpiry = calcProExpiry(customer?.pro_expires_at, daysToAdd);
  // Don't downgrade lifetime users; always promote free → pro
  await supabase.from('users').update({ plan: 'pro', pro_expires_at: newExpiry })
    .eq('email', recipientEmail).neq('plan', 'lifetime');
  return newExpiry;
}

async function processReferralReward(email, plan, amount, externalPaymentId) {
  const normalizedPlan = normalizeStoredCustomerPlan(plan);
  if (!externalPaymentId || ![CONFIG.PLANS.PLUS, CONFIG.PLANS.UNLIMITED].includes(normalizedPlan) || !Number.isFinite(amount) || amount <= 0) {
    return;
  }
  plan = normalizedPlan;

  // Idempotency — skip if payment already processed
  const { data: existingPayment } = await supabase.from('payments').select('id').eq('external_payment_id', externalPaymentId).maybeSingle();
  if (existingPayment) return;

  // Record payment
  await supabase.from('payments').insert({ email, plan_type: plan, amount, billing_type: 'subscription', payment_status: 'succeeded', external_payment_id: externalPaymentId });

  // Check if referred
  const { data: customer } = await supabase.from('users').select('referred_by, plan').eq('email', email).maybeSingle();
  if (!customer?.referred_by) return;

  // Find open referral
  const { data: referral } = await supabase.from('referrals').select('*').eq('referred_email', email).eq('referrer_email', customer.referred_by).not('status', 'in', '("rewarded","rejected")').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!referral) return;

  const settings = await getReferralProgramSettings();
  const { data: referrer } = await supabase.from('users').select('plan, pro_expires_at, stripe_customer_id').eq('email', customer.referred_by).maybeSingle();
  if (!referrer) return;
  if ((customer.referred_by || '').toLowerCase() === email.toLowerCase()) {
    await supabase.from('referrals').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', referral.id);
    await supabase.from('referral_events').insert({ referral_code: referral.referral_code, referrer_email: customer.referred_by, referred_email: email, event_type: 'self_referral_blocked', metadata: { reason: 'same_email' } });
    return;
  }

  const { data: referredCustomer } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('email', email)
    .maybeSingle();

  if (
    referredCustomer?.stripe_customer_id &&
    referrer.stripe_customer_id &&
    referredCustomer.stripe_customer_id === referrer.stripe_customer_id
  ) {
    await supabase.from('referrals').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', referral.id);
    await supabase.from('referral_events').insert({ referral_code: referral.referral_code, referrer_email: customer.referred_by, referred_email: email, event_type: 'self_referral_blocked', metadata: { reason: 'same_stripe_customer' } });
    return;
  }

  // Map unified plan ('pro') to legacy reward rule key ('monthly')
  const referrerPlan = referrer.plan === 'lifetime' ? 'lifetime' : (referrer.plan === 'monthly' || referrer.plan === 'pro') ? 'monthly' : 'free';
  const now = new Date().toISOString();
  const rule = await matchRewardRule(referrerPlan, 'monthly');

  // Update referral to converted
  await supabase.from('referrals').update({ status: 'converted', converted_at: now, purchased_plan: plan, purchase_amount: amount, updated_at: now }).eq('id', referral.id);

  if (!rule || rule.reward_type === 'none' || rule.reward_value === 0) {
    // No reward — create a 'none' reward record for audit trail
    await supabase.from('referral_rewards').insert({ referral_id: referral.id, rule_id: rule?.id || null, reward_recipient_email: customer.referred_by, reward_recipient_type: 'referrer', reward_type: 'none', reward_value: 0, status: 'none' });
    await supabase.from('referral_events').insert({ referral_code: referral.referral_code, referrer_email: customer.referred_by, referred_email: email, event_type: 'converted_no_reward', metadata: { plan, amount } });
    return;
  }

  const recipientEmail = rule.recipient === 'referred' ? email : customer.referred_by;
  const currentIssuedDays = await getIssuedReferralDays(recipientEmail);
  const remainingDays = Math.max(0, settings.maxRewardDays - currentIssuedDays);
  const rewardValue = rule.reward_type === 'pro_days'
    ? Math.min(rule.reward_value, remainingDays)
    : rule.reward_value;

  if (!settings.programEnabled) {
    await supabase.from('referral_rewards').insert({
      referral_id: referral.id,
      rule_id: rule.id,
      reward_recipient_email: recipientEmail,
      reward_recipient_type: rule.recipient === 'referred' ? 'referred' : 'referrer',
      reward_type: 'none',
      reward_value: 0,
      status: 'none',
      notes: 'Referral program disabled by admin kill switch.',
    });
    await supabase.from('referral_events').insert({ referral_code: referral.referral_code, referrer_email: customer.referred_by, referred_email: email, event_type: 'reward_skipped_program_disabled', metadata: { plan, amount } });
    return;
  }

  if (rule.reward_type === 'pro_days' && rewardValue <= 0) {
    await supabase.from('referral_rewards').insert({
      referral_id: referral.id,
      rule_id: rule.id,
      reward_recipient_email: recipientEmail,
      reward_recipient_type: rule.recipient === 'referred' ? 'referred' : 'referrer',
      reward_type: 'none',
      reward_value: 0,
      status: 'none',
      notes: `Reward cap reached at ${settings.maxRewardDays} Pro days.`,
    });
    await supabase.from('referral_events').insert({ referral_code: referral.referral_code, referrer_email: customer.referred_by, referred_email: email, event_type: 'reward_skipped_cap_reached', metadata: { cap_days: settings.maxRewardDays, plan, amount } });
    return;
  }

  const rewardStatus = rule.auto_issue ? 'issued' : 'ready_to_issue';

  const { data: rewardRow } = await supabase.from('referral_rewards').insert({
    referral_id: referral.id, rule_id: rule.id,
    reward_recipient_email: recipientEmail, reward_recipient_type: rule.recipient === 'referred' ? 'referred' : 'referrer',
    reward_type: rule.reward_type, reward_value: rewardValue,
    status: rewardStatus, issued_at: rule.auto_issue ? now : null,
  }).select().single();

  if (rule.auto_issue && rule.reward_type === 'pro_days') {
    const newExpiry = await issueProDays(recipientEmail, rewardValue);
    await supabase.from('referrals').update({ status: 'rewarded', reward_type: rule.reward_type, reward_value: rewardValue, reward_issued_at: now, updated_at: now }).eq('id', referral.id);
    await supabase.from('referral_events').insert({ referral_code: referral.referral_code, referrer_email: customer.referred_by, referred_email: email, event_type: 'rewarded', metadata: { days: rewardValue, plan, amount, new_expiry: newExpiry, auto: true, cap_days: settings.maxRewardDays } });
    console.log(`🎁 Auto-reward: ${recipientEmail} +${rewardValue} Pro days (referred ${email})`);
  } else {
    await supabase.from('referral_events').insert({ referral_code: referral.referral_code, referrer_email: customer.referred_by, referred_email: email, event_type: 'reward_queued', metadata: { plan, amount, rule_id: rule.id } });
    console.log(`🔔 Reward queued for admin: ${recipientEmail} (referral ${referral.id})`);
  }
}

// ── Referral routes ───────────────────────────────────────

// Get referral code + stats for logged-in user
app.get('/referral/me', requireAuth, async (req, res) => {
  const email = req.authUser.email;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const code = await ensureReferralCode(email);
  const settings = await getReferralProgramSettings();
  const { data: refs } = await supabase.from('referrals')
    .select('id, referred_email, status, reward_value, clicked_at, signed_up_at, converted_at, reward_issued_at, purchased_plan')
    .eq('referrer_email', email)
    .order('clicked_at', { ascending: false });
  const { data: customer } = await supabase.from('users').select('pro_expires_at').eq('email', email).maybeSingle();
  const total = refs?.length || 0;
  const converted = refs?.filter(r => ['converted', 'rewarded'].includes(r.status)).length || 0;
  const rewarded = refs?.filter(r => r.status === 'rewarded').length || 0;
  const totalDays = refs?.filter(r => r.status === 'rewarded').reduce((s, r) => s + (r.reward_value || 0), 0) || 0;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.json({
    code,
    link: `${frontendUrl}?ref=${code}`,
    total, converted, rewarded, totalDays,
    programEnabled: settings.programEnabled,
    maxRewardDays: settings.maxRewardDays,
    daysRemainingToCap: Math.max(0, settings.maxRewardDays - totalDays),
    proExpiresAt: customer?.pro_expires_at || null,
    referrals: refs || [],
  });
});

// Track referral click (called when someone visits /?ref=CODE)
app.post('/referral/click', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.json({ ok: true });
  const settings = await getReferralProgramSettings();
  if (!settings.programEnabled) return res.json({ ok: true, valid: false, disabled: true });
  const { data: referrer } = await supabase.from('users').select('email').eq('referral_code', code).maybeSingle();
  if (!referrer) return res.json({ ok: true, valid: false });
  await supabase.from('referral_events').insert({ referral_code: code, referrer_email: referrer.email, event_type: 'clicked', metadata: {} });
  // Create or update referral record
  const { data: existing } = await supabase.from('referrals').select('id').eq('referral_code', code).eq('status', 'clicked').is('referred_email', null).maybeSingle();
  if (!existing) await supabase.from('referrals').insert({ referrer_email: referrer.email, referral_code: code, status: 'clicked', clicked_at: new Date().toISOString() });
  res.json({ ok: true, valid: true });
});

// Attach referrer to newly signed-in user
app.post('/referral/attach', requireAuth, async (req, res) => {
  const email = req.authUser.email;
  const code = req.body?.code || req.body?.referralCode;
  if (!email || !code) return res.json({ ok: true });
  const settings = await getReferralProgramSettings();
  if (!settings.programEnabled) {
    return res.status(403).json({ error: 'Referral program is paused right now.' });
  }

  // Resolve referrer from code
  const { data: referrer } = await supabase.from('users').select('email').eq('referral_code', code).maybeSingle();
  if (!referrer) return res.json({ ok: true, skipped: 'invalid_code' });
  if (referrer.email?.toLowerCase() === email.toLowerCase()) {
    return res.status(400).json({ error: 'You cannot use your own referral link.' });
  }

  // Check if user already has a referrer
  const { data: existing } = await supabase.from('users').select('referred_by').eq('email', email).maybeSingle();
  if (existing?.referred_by) return res.json({ ok: true, skipped: 'already_referred' });

  // Attach referrer
  await supabase.from('users').upsert({ email, referred_by: referrer.email }, { onConflict: 'email' });

  // Update referral record
  const now = new Date().toISOString();
  const { data: openRef } = await supabase.from('referrals').select('id').eq('referral_code', code).is('referred_email', null).maybeSingle();
  if (openRef) {
    await supabase.from('referrals').update({ referred_email: email, status: 'signed_up', signed_up_at: now, updated_at: now }).eq('id', openRef.id);
  } else {
    await supabase.from('referrals').insert({ referrer_email: referrer.email, referred_email: email, referral_code: code, status: 'signed_up', clicked_at: now, signed_up_at: now });
  }
  await supabase.from('referral_events').insert({ referral_code: code, referrer_email: referrer.email, referred_email: email, event_type: 'signed_up' });

  res.json({ ok: true, referrer: referrer.email });
});

// Webhook
app.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return res.status(400).send('Webhook Error: ' + err.message); }
  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const email = session.customer_email || session.customer_details?.email;
      const plan = normalizeStoredCustomerPlan(session.metadata?.plan || CONFIG.PLANS.PLUS);
      const amount = (session.amount_total || 0) / 100;
      if (email) {
        await upsertCustomer(email, { plan, stripe_customer_id: session.customer, stripe_session_id: session.id });
        await processReferralReward(email, plan, amount, session.id);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const customer = await stripe.customers.retrieve(event.data.object.customer);
      if (customer.email) await upsertCustomer(customer.email, { plan: CONFIG.PLANS.FREE });
    } else if (event.type === 'invoice.payment_failed') {
      const customer = await stripe.customers.retrieve(event.data.object.customer);
      if (customer.email) await upsertCustomer(customer.email, { is_pro: false });
    } else if (event.type === 'invoice.payment_succeeded' && event.data.object.billing_reason === 'subscription_cycle') {
      const customer = await stripe.customers.retrieve(event.data.object.customer);
      if (customer.email) await upsertCustomer(customer.email, { is_pro: true });
    }
  } catch (err) { console.error('Webhook handler error:', err.message); }
  res.json({ received: true });
});

// ── Admin middleware ──────────────────────────────────────
async function adminAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (error || !data?.user || !email) return res.status(401).json({ error: 'Invalid session' });
  if (ADMIN_EMAILS.size === 0 || !ADMIN_EMAILS.has(email)) return res.status(403).json({ error: 'Admin access required' });

  req.authUser = data.user;
  next();
}

let adminAuditTableAvailable = true;
function getAdminActor(req) {
  return req.authUser?.email || req.headers['x-admin-email'] || req.headers['x-admin-user'] || 'admin';
}

async function recordAdminAudit({ action, entityType, entityId, adminEmail, targetEmail = null, summary, metadata = null }) {
  if (!adminAuditTableAvailable) return;
  const { error } = await supabase.from('admin_audit_logs').insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    admin_email: adminEmail || 'admin',
    target_email: targetEmail,
    summary,
    metadata,
  });
  if (error) {
    if (/admin_audit_logs/i.test(error.message || '')) adminAuditTableAvailable = false;
    console.warn('Admin audit log skipped:', error.message);
  }
}

// ── Admin: metrics ────────────────────────────────────────
app.get('/admin/metrics', adminAuth, async (_req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayISO = today.toISOString();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const [
      { count: totalUsers },
      { count: totalPro },
      { count: tasksToday },
      { count: lifetimeCount },
      { data: topTask },
      { data: helpSteps },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).neq('plan', 'free'),
      supabase.from('user_tasks').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('plan', 'lifetime'),
      supabase.from('translations_cache').select('input_data, hit_count').eq('input_type', 'translate').order('hit_count', { ascending: false }).limit(1),
      supabase.from('translations_cache').select('input_data, hit_count').eq('input_type', 'help-step').order('hit_count', { ascending: false }).limit(1),
    ]);

    // Stripe revenue
    let monthlyRevenue = 0, totalRevenue = 0;
    try {
      const [charges, subs] = await Promise.all([
        stripe.charges.list({ limit: 100, created: { gte: Math.floor(new Date(monthStart).getTime() / 1000) } }),
        stripe.charges.list({ limit: 100 }),
      ]);
      monthlyRevenue = charges.data.filter(c => c.status === 'succeeded').reduce((s, c) => s + c.amount, 0) / 100;
      totalRevenue = subs.data.filter(c => c.status === 'succeeded').reduce((s, c) => s + c.amount, 0) / 100;
    } catch { /* Stripe not configured */ }

    const lifetimeRevenue = (lifetimeCount || 0) * 49;

    res.json({
      totalUsers: totalUsers || 0,
      totalProMembers: totalPro || 0,
      tasksCompletedToday: tasksToday || 0,
      totalLifetimePurchases: lifetimeCount || 0,
      lifetimeRevenue,
      monthlyRevenue,
      totalRevenue,
      mostUsedTask: topTask?.[0]?.input_data?.task || '—',
      topStuckStep: helpSteps?.[0]?.input_data?.stepAction || '—',
    });
  } catch (err) { console.error('Admin metrics error:', err.message); res.status(500).json({ error: err.message }); }
});

// ── Admin: users ──────────────────────────────────────────
app.get('/admin/users', adminAuth, async (_req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/admin/users/:email', adminAuth, async (req, res) => {
  const { email } = req.params;
  const fields = req.body;
  const { error } = await supabase.from('users').update({ ...fields }).eq('email', email);
  if (error) return res.status(500).json({ error: error.message });
  await recordAdminAudit({
    action: 'user_updated',
    entityType: 'customer',
    entityId: email,
    adminEmail: getAdminActor(req),
    targetEmail: email,
    summary: `Updated customer ${email}`,
    metadata: fields,
  });
  res.json({ ok: true });
});

app.delete('/admin/users/:email', adminAuth, async (req, res) => {
  const { email } = req.params;
  const { error } = await supabase.from('users').delete().eq('email', email);
  if (error) return res.status(500).json({ error: error.message });
  await recordAdminAudit({
    action: 'user_deleted',
    entityType: 'customer',
    entityId: email,
    adminEmail: getAdminActor(req),
    targetEmail: email,
    summary: `Deleted customer ${email}`,
  });
  res.json({ ok: true });
});

app.get('/admin/users/:email/detail', adminAuth, async (req, res) => {
  const email = decodeURIComponent(req.params.email);
  try {
    const [
      { data: customer, error: customerError },
      { data: referralsSent },
      { data: referralsReceived },
      { data: rewards },
      { data: payments },
      { data: referralEvents },
    ] = await Promise.all([
      supabase.from('users').select('*').eq('email', email).maybeSingle(),
      supabase.from('referrals').select('*').eq('referrer_email', email).order('created_at', { ascending: false }).limit(10),
      supabase.from('referrals').select('*').eq('referred_email', email).order('created_at', { ascending: false }).limit(10),
      supabase.from('referral_rewards').select('*, referrals(referrer_email, referred_email, purchased_plan, referral_code)').eq('reward_recipient_email', email).order('created_at', { ascending: false }).limit(10),
      supabase.from('payments').select('*').eq('email', email).order('created_at', { ascending: false }).limit(10),
      supabase.from('referral_events').select('*').or(`referrer_email.eq.${email},referred_email.eq.${email}`).order('created_at', { ascending: false }).limit(12),
    ]);

    if (customerError) return res.status(500).json({ error: customerError.message });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const summary = {
      totalPayments: (payments || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
      totalReferralRevenue: (referralsSent || []).reduce((sum, r) => sum + (parseFloat(r.purchase_amount) || 0), 0),
      totalRewardsIssued: (rewards || []).filter((r) => r.status === 'issued').length,
      referralsSent: (referralsSent || []).length,
      referralsReceived: (referralsReceived || []).length,
    };

    res.json({
      customer,
      summary,
      referralsSent: referralsSent || [],
      referralsReceived: referralsReceived || [],
      rewards: rewards || [],
      payments: payments || [],
      referralEvents: referralEvents || [],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: referrals ─────────────────────────────────────
app.get('/admin/referrals', adminAuth, async (_req, res) => {
  const { data, error } = await supabase.from('referrals').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/admin/referrals/stats', adminAuth, async (_req, res) => {
  try {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { data: refs } = await supabase.from('referrals').select('status, reward_value, purchase_amount, converted_at');
    const all = refs || [];
    const clicks = all.length;
    const signups = all.filter(r => ['signed_up','converted','rewarded'].includes(r.status)).length;
    const conversions = all.filter(r => ['converted','rewarded'].includes(r.status)).length;
    const rewards = all.filter(r => r.status === 'rewarded').length;
    const totalDays = all.filter(r => r.status === 'rewarded').reduce((s, r) => s + (r.reward_value || 0), 0);
    const totalRevenue = all.filter(r => r.purchase_amount).reduce((s, r) => s + (r.purchase_amount || 0), 0);
    const monthRevenue = all.filter(r => r.purchase_amount && r.converted_at >= monthStart).reduce((s, r) => s + (r.purchase_amount || 0), 0);
    res.json({ clicks, signups, conversions, rewards, totalDays, totalRevenue, monthRevenue, conversionRate: clicks > 0 ? ((conversions / clicks) * 100).toFixed(1) : 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/admin/referrals/:id/approve', adminAuth, async (req, res) => {
  const now = new Date().toISOString();
  const { error } = await supabase.from('referrals').update({ status: 'converted', updated_at: now }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await recordAdminAudit({
    action: 'referral_approved',
    entityType: 'referral',
    entityId: req.params.id,
    adminEmail: getAdminActor(req),
    summary: `Approved referral ${req.params.id}`,
  });
  res.json({ ok: true });
});

app.post('/admin/referrals/:id/reject', adminAuth, async (req, res) => {
  const now = new Date().toISOString();
  await supabase.from('referrals').update({ status: 'rejected', updated_at: now }).eq('id', req.params.id);
  await supabase.from('referral_rewards').update({ status: 'rejected', updated_at: now }).eq('referral_id', req.params.id).in('status', ['pending','ready_to_issue']);
  await recordAdminAudit({
    action: 'referral_rejected',
    entityType: 'referral',
    entityId: req.params.id,
    adminEmail: getAdminActor(req),
    summary: `Rejected referral ${req.params.id}`,
  });
  res.json({ ok: true });
});

app.post('/admin/referrals/:id/reward', adminAuth, async (req, res) => {
  const adminEmail = getAdminActor(req);
  const { data: reward } = await supabase.from('referral_rewards').select('*').eq('referral_id', req.params.id).in('status', ['pending','ready_to_issue']).maybeSingle();
  if (!reward) return res.status(404).json({ error: 'No issuable reward found for this referral' });
  if (reward.status === 'issued') return res.status(400).json({ error: 'Already issued' });
  if (reward.reward_type === 'none') return res.status(400).json({ error: 'No reward to issue' });

  const settings = await getReferralProgramSettings();
  if (!settings.programEnabled) return res.status(400).json({ error: 'Referral program is paused. Re-enable it before issuing rewards.' });

  const now = new Date().toISOString();
  let newExpiry = null;

  if (reward.reward_type === 'pro_days') {
    const currentIssuedDays = await getIssuedReferralDays(reward.reward_recipient_email);
    const remainingDays = Math.max(0, settings.maxRewardDays - currentIssuedDays);
    if (remainingDays <= 0) return res.status(400).json({ error: `This user has already reached the ${settings.maxRewardDays}-day referral cap.` });
    if (reward.reward_value > remainingDays) {
      await supabase.from('referral_rewards').update({ reward_value: remainingDays, notes: `Auto-trimmed to respect ${settings.maxRewardDays}-day cap.`, updated_at: now }).eq('id', reward.id);
      reward.reward_value = remainingDays;
    }
    newExpiry = await issueProDays(reward.reward_recipient_email, reward.reward_value, adminEmail);
  }

  await supabase.from('referral_rewards').update({ status: 'issued', issued_at: now, issued_by_admin_email: adminEmail, updated_at: now }).eq('id', reward.id);
  await supabase.from('referrals').update({ status: 'rewarded', reward_type: reward.reward_type, reward_value: reward.reward_value, reward_issued_at: now, updated_at: now }).eq('id', reward.referral_id);
  await recordAdminAudit({ action: 'reward_issued', entityType: 'referral_reward', entityId: reward.id, adminEmail, targetEmail: reward.reward_recipient_email, summary: `Issued ${reward.reward_value} ${reward.reward_type} to ${reward.reward_recipient_email}`, metadata: { referral_id: reward.referral_id, reward_type: reward.reward_type, reward_value: reward.reward_value } });
  res.json({ ok: true, newExpiry });
});

app.post('/admin/referrals/:id/reverse', adminAuth, async (req, res) => {
  const adminEmail = getAdminActor(req);
  const { data: reward } = await supabase.from('referral_rewards').select('*').eq('referral_id', req.params.id).eq('status', 'issued').maybeSingle();
  if (!reward) return res.status(404).json({ error: 'No issued reward found to reverse for this referral' });

  const now = new Date().toISOString();
  await supabase.from('referral_rewards').update({ status: 'reversed', reversed_at: now, reversed_by_admin_email: adminEmail, updated_at: now }).eq('id', reward.id);
  await supabase.from('referrals').update({ status: 'rejected', reward_reversed_at: now, updated_at: now }).eq('id', reward.referral_id);

  if (reward.reward_type === 'pro_days' && reward.reward_value > 0) {
    const { data: customer } = await supabase.from('users').select('pro_expires_at, plan').eq('email', reward.reward_recipient_email).maybeSingle();
    if (customer?.pro_expires_at) {
      const reduced = new Date(new Date(customer.pro_expires_at).getTime() - reward.reward_value * 24 * 60 * 60 * 1000);
      const newExpiry = reduced > new Date() ? reduced.toISOString() : null;
      if (customer.plan !== 'lifetime') {
        await supabase.from('users').update({ plan: newExpiry ? 'pro' : 'free', pro_expires_at: newExpiry }).eq('email', reward.reward_recipient_email);
      }
    }
  }

  await recordAdminAudit({ action: 'reward_reversed', entityType: 'referral_reward', entityId: reward.id, adminEmail, targetEmail: reward.reward_recipient_email, summary: `Reversed reward for ${reward.reward_recipient_email}`, metadata: { referral_id: reward.referral_id, reward_type: reward.reward_type, reward_value: reward.reward_value } });
  res.json({ ok: true });
});

// ── Admin: reward rules ───────────────────────────────────
app.get('/admin/referral-program-settings', adminAuth, async (_req, res) => {
  const settings = await getReferralProgramSettings();
  res.json(settings);
});

app.put('/admin/referral-program-settings', adminAuth, async (req, res) => {
  const current = await getReferralProgramSettings();
  const next = await saveReferralProgramSettings({
    programEnabled: req.body?.programEnabled ?? current.programEnabled,
    maxRewardDays: req.body?.maxRewardDays ?? current.maxRewardDays,
  });

  await recordAdminAudit({
    action: 'referral_program_settings_updated',
    entityType: 'referral_program_settings',
    entityId: 'referral_program',
    adminEmail: getAdminActor(req),
    summary: 'Updated referral program settings',
    metadata: next,
  });

  res.json(next);
});

app.get('/admin/referral-rules', adminAuth, async (_req, res) => {
  const { data, error } = await supabase.from('referral_reward_rules').select('*').order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/admin/referral-rules', adminAuth, async (req, res) => {
  const { name, referrer_plan, trigger_plan, recipient, reward_type, reward_value, auto_issue, enabled } = req.body;
  const { data, error } = await supabase.from('referral_reward_rules').insert({ name, referrer_plan, trigger_plan, recipient: recipient || 'referrer', reward_type, reward_value: reward_value || 0, auto_issue: !!auto_issue, enabled: enabled !== false }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await recordAdminAudit({
    action: 'reward_rule_created',
    entityType: 'reward_rule',
    entityId: data.id,
    adminEmail: getAdminActor(req),
    summary: `Created reward rule ${data.name}`,
    metadata: data,
  });
  res.json(data);
});

app.put('/admin/referral-rules/:id', adminAuth, async (req, res) => {
  const fields = ['name','referrer_plan','trigger_plan','recipient','reward_type','reward_value','auto_issue','enabled'];
  const update = Object.fromEntries(fields.filter(f => req.body[f] !== undefined).map(f => [f, req.body[f]]));
  update.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('referral_reward_rules').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await recordAdminAudit({
    action: 'reward_rule_updated',
    entityType: 'reward_rule',
    entityId: data.id,
    adminEmail: getAdminActor(req),
    summary: `Updated reward rule ${data.name}`,
    metadata: update,
  });
  res.json(data);
});

app.delete('/admin/referral-rules/:id', adminAuth, async (req, res) => {
  const { error } = await supabase.from('referral_reward_rules').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await recordAdminAudit({
    action: 'reward_rule_deleted',
    entityType: 'reward_rule',
    entityId: req.params.id,
    adminEmail: getAdminActor(req),
    summary: `Deleted reward rule ${req.params.id}`,
  });
  res.json({ ok: true });
});

// ── Admin: referral rewards ───────────────────────────────
app.get('/admin/referral-rewards', adminAuth, async (_req, res) => {
  const { data, error } = await supabase.from('referral_rewards')
    .select('*, referrals(referrer_email, referred_email, purchased_plan, referral_code, status)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.put('/admin/referral-rewards/:id', adminAuth, async (req, res) => {
  const { reward_type, reward_value, notes, status } = req.body;
  const update = { updated_at: new Date().toISOString() };
  if (reward_type !== undefined) update.reward_type = reward_type;
  if (reward_value !== undefined) update.reward_value = reward_value;
  if (notes !== undefined) update.notes = notes;
  if (status !== undefined) update.status = status;
  const { data, error } = await supabase.from('referral_rewards').update(update).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/admin/referral-rewards/:id/issue', adminAuth, async (req, res) => {
  const adminEmail = req.headers['x-admin-email'] || 'admin';
  const { data: reward } = await supabase.from('referral_rewards').select('*').eq('id', req.params.id).single();
  if (!reward) return res.status(404).json({ error: 'Reward not found' });
  if (reward.status === 'issued') return res.status(400).json({ error: 'Already issued' });
  if (reward.reward_type === 'none') return res.status(400).json({ error: 'No reward to issue' });

  const now = new Date().toISOString();
  let newExpiry = null;
  const settings = await getReferralProgramSettings();

  if (!settings.programEnabled) {
    return res.status(400).json({ error: 'Referral program is paused. Re-enable it before issuing rewards.' });
  }

  if (reward.reward_type === 'pro_days') {
    const currentIssuedDays = await getIssuedReferralDays(reward.reward_recipient_email);
    const remainingDays = Math.max(0, settings.maxRewardDays - currentIssuedDays);
    if (remainingDays <= 0) {
      return res.status(400).json({ error: `This user has already reached the ${settings.maxRewardDays}-day referral cap.` });
    }

    if (reward.reward_value > remainingDays) {
      await supabase
        .from('referral_rewards')
        .update({ reward_value: remainingDays, notes: `Auto-trimmed to respect ${settings.maxRewardDays}-day cap.`, updated_at: now })
        .eq('id', req.params.id);
      reward.reward_value = remainingDays;
    }

    newExpiry = await issueProDays(reward.reward_recipient_email, reward.reward_value, adminEmail);
  }

  await supabase.from('referral_rewards').update({ status: 'issued', issued_at: now, issued_by_admin_email: adminEmail, updated_at: now }).eq('id', req.params.id);
  await supabase.from('referrals').update({ status: 'rewarded', reward_type: reward.reward_type, reward_value: reward.reward_value, reward_issued_at: now, updated_at: now }).eq('id', reward.referral_id);
  await recordAdminAudit({
    action: 'reward_issued',
    entityType: 'referral_reward',
    entityId: reward.id,
    adminEmail,
    targetEmail: reward.reward_recipient_email,
    summary: `Issued ${reward.reward_value} ${reward.reward_type} to ${reward.reward_recipient_email}`,
    metadata: { referral_id: reward.referral_id, reward_type: reward.reward_type, reward_value: reward.reward_value },
  });

  res.json({ ok: true, newExpiry });
});

app.post('/admin/referral-rewards/:id/reverse', adminAuth, async (req, res) => {
  const adminEmail = req.headers['x-admin-email'] || 'admin';
  const { data: reward } = await supabase.from('referral_rewards').select('*').eq('id', req.params.id).single();
  if (!reward) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();
  await supabase.from('referral_rewards').update({ status: 'reversed', reversed_at: now, reversed_by_admin_email: adminEmail, updated_at: now }).eq('id', req.params.id);
  await supabase.from('referrals').update({ status: 'rejected', reward_reversed_at: now, updated_at: now }).eq('id', reward.referral_id);

  // If pro_days: attempt to reduce pro expiry or flag for review
  if (reward.reward_type === 'pro_days' && reward.reward_value > 0) {
    const { data: customer } = await supabase.from('users').select('pro_expires_at, plan').eq('email', reward.reward_recipient_email).maybeSingle();
    if (customer?.pro_expires_at) {
      const reduced = new Date(new Date(customer.pro_expires_at).getTime() - reward.reward_value * 24 * 60 * 60 * 1000);
      const newExpiry = reduced > new Date() ? reduced.toISOString() : null;
      // Don't touch lifetime plan users when reversing referral pro_days rewards
      if (customer.plan !== 'lifetime') {
        await supabase.from('users').update({ plan: newExpiry ? 'pro' : 'free', pro_expires_at: newExpiry }).eq('email', reward.reward_recipient_email);
      }
    }
  }

  await recordAdminAudit({
    action: 'reward_reversed',
    entityType: 'referral_reward',
    entityId: reward.id,
    adminEmail,
    targetEmail: reward.reward_recipient_email,
    summary: `Reversed reward for ${reward.reward_recipient_email}`,
    metadata: { referral_id: reward.referral_id, reward_type: reward.reward_type, reward_value: reward.reward_value },
  });

  res.json({ ok: true });
});

// ── Admin: revenue by month ───────────────────────────────
app.get('/admin/revenue', adminAuth, async (_req, res) => {
  try {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: d.toLocaleString('en-US', { month: 'short' }), start: Math.floor(d.getTime() / 1000), end: Math.floor(new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime() / 1000) });
    }
    const results = await Promise.all(months.map(async ({ month, start, end }) => {
      try {
        const { data } = await stripe.charges.list({ limit: 100, created: { gte: start, lte: end } });
        const amount = data.filter(c => c.status === 'succeeded').reduce((s, c) => s + c.amount, 0) / 100;
        return { month, amount };
      } catch { return { month, amount: 0 }; }
    }));
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/admin/translator-analytics', adminAuth, async (_req, res) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 29);
    since.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('page_analytics_events')
      .select('created_at, page_key, session_id, ip_hash, user_id, user_email, referrer_domain, utm_source')
      .in('page_key', ['translator_home', 'translate_submit'])
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      if (/page_analytics_events/i.test(error.message || '')) {
        return res.json({
          viewsToday: 0,
          uniqueVisitorsToday: 0,
          uniqueSessionsToday: 0,
          signedInViewsToday: 0,
          anonymousViewsToday: 0,
          last30DaysViews: 0,
          daily: [],
          topReferrers: [],
          topUtmSources: [],
        });
      }
      return res.status(500).json({ error: error.message });
    }

    const rows = data || [];
    const homeRows = rows.filter((row) => row.page_key === 'translator_home');
    const submitRows = rows.filter((row) => row.page_key === 'translate_submit');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayHomeRows = homeRows.filter((row) => new Date(row.created_at) >= today);
    const todaySubmitRows = submitRows.filter((row) => new Date(row.created_at) >= today);
    const viewsToday = todayHomeRows.length;
    const uniqueVisitorsToday = new Set(todayHomeRows.map((row) => row.ip_hash).filter(Boolean)).size;
    const uniqueSessionsToday = new Set(todayHomeRows.map((row) => row.session_id).filter(Boolean)).size;
    const translateSessionsToday = new Set(todaySubmitRows.map((row) => row.session_id).filter(Boolean)).size;
    const signedInViewsToday = todayHomeRows.filter((row) => row.user_id || row.user_email).length;
    const anonymousViewsToday = viewsToday - signedInViewsToday;
    const conversionRateToday = uniqueSessionsToday > 0 ? Math.round((translateSessionsToday / uniqueSessionsToday) * 100) : 0;
    const last30DayViewSessions = new Set(homeRows.map((row) => row.session_id).filter(Boolean)).size;
    const last30DayTranslateSessions = new Set(submitRows.map((row) => row.session_id).filter(Boolean)).size;
    const last30DayConversionRate = last30DayViewSessions > 0 ? Math.round((last30DayTranslateSessions / last30DayViewSessions) * 100) : 0;

    const dailyMap = new Map();
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString().slice(0, 10);
      dailyMap.set(key, { date: key, views: 0, visitors: new Set(), sessions: new Set(), submits: new Set() });
    }

    rows.forEach((row) => {
      const key = new Date(row.created_at).toISOString().slice(0, 10);
      const bucket = dailyMap.get(key);
      if (!bucket) return;
      if (row.page_key === 'translator_home') {
        bucket.views += 1;
        if (row.ip_hash) bucket.visitors.add(row.ip_hash);
        if (row.session_id) bucket.sessions.add(row.session_id);
      }
      if (row.page_key === 'translate_submit' && row.session_id) {
        bucket.submits.add(row.session_id);
      }
    });

    const daily = Array.from(dailyMap.values()).map((bucket) => ({
      date: bucket.date,
      views: bucket.views,
      uniqueVisitors: bucket.visitors.size,
      uniqueSessions: bucket.sessions.size,
      translateSessions: bucket.submits.size,
      conversionRate: bucket.sessions.size > 0 ? Math.round((bucket.submits.size / bucket.sessions.size) * 100) : 0,
    }));

    const referrerCounts = {};
    const utmCounts = {};
    homeRows.forEach((row) => {
      const ref = row.referrer_domain || 'direct';
      referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
      const source = row.utm_source || 'none';
      utmCounts[source] = (utmCounts[source] || 0) + 1;
    });

    const topReferrers = Object.entries(referrerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, views]) => ({ label, views }));

    const topUtmSources = Object.entries(utmCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, views]) => ({ label, views }));

    res.json({
      viewsToday,
      uniqueVisitorsToday,
      uniqueSessionsToday,
      translateSessionsToday,
      conversionRateToday,
      signedInViewsToday,
      anonymousViewsToday,
      last30DaysViews: homeRows.length,
      last30DayViewSessions,
      last30DayTranslateSessions,
      last30DayConversionRate,
      daily,
      topReferrers,
      topUtmSources,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/admin/task-shares', adminAuth, async (_req, res) => {
  try {
    const { data: canonicalShares, error } = await supabase
      .from('task_shares')
      .select('id, task_id, owner_user_id, share_code, status, created_at')
      .is('shared_with_user_id', null)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    if (!canonicalShares?.length) return res.json([]);

    const shareCodes = canonicalShares.map((s) => s.share_code);
    const taskIds = [...new Set(canonicalShares.map((s) => s.task_id))];

    const [{ data: recipientRows }, { data: clickRows }, { data: tasks }] = await Promise.all([
      supabase.from('task_shares').select('share_code, status, shared_with_user_id').in('share_code', shareCodes).not('shared_with_user_id', 'is', null),
      supabase.from('task_share_clicks').select('share_code').in('share_code', shareCodes),
      supabase.from('user_tasks').select('id, task').in('id', taskIds),
    ]);

    const taskMap = Object.fromEntries((tasks || []).map((task) => [task.id, task.task]));
    const clicksByCode = {};
    (clickRows || []).forEach((row) => { clicksByCode[row.share_code] = (clicksByCode[row.share_code] || 0) + 1; });
    const recipientsByCode = {};
    (recipientRows || []).forEach((row) => {
      if (!recipientsByCode[row.share_code]) recipientsByCode[row.share_code] = [];
      recipientsByCode[row.share_code].push(row);
    });

    res.json(canonicalShares.map((share) => {
      const recipients = recipientsByCode[share.share_code] || [];
      return {
        ...share,
        taskText: taskMap[share.task_id] || 'Unknown task',
        clickCount: clicksByCode[share.share_code] || 0,
        recipientCount: recipients.length,
        acceptedCount: recipients.filter((r) => ['accepted', 'completed'].includes(r.status)).length,
        completedCount: recipients.filter((r) => r.status === 'completed').length,
      };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/admin/task-shares/:shareCode/block', adminAuth, async (req, res) => {
  const shareCode = req.params.shareCode;
  const { data, error } = await supabase
    .from('task_shares')
    .update({ status: 'declined' })
    .eq('share_code', shareCode)
    .is('shared_with_user_id', null)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Share not found' });
  await recordAdminAudit({
    action: 'share_blocked',
    entityType: 'task_share',
    entityId: shareCode,
    adminEmail: getAdminActor(req),
    summary: `Blocked shared task link ${shareCode}`,
  });
  res.json({ ok: true, share: data });
});

app.post('/admin/task-shares/:shareCode/unblock', adminAuth, async (req, res) => {
  const shareCode = req.params.shareCode;
  const { data, error } = await supabase
    .from('task_shares')
    .update({ status: 'pending' })
    .eq('share_code', shareCode)
    .is('shared_with_user_id', null)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Share not found' });
  await recordAdminAudit({
    action: 'share_unblocked',
    entityType: 'task_share',
    entityId: shareCode,
    adminEmail: getAdminActor(req),
    summary: `Restored shared task link ${shareCode}`,
  });
  res.json({ ok: true, share: data });
});

app.get('/admin/audit-log', adminAuth, async (_req, res) => {
  try {
    const entries = [];

    if (adminAuditTableAvailable) {
      const { data, error } = await supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) {
        if (/admin_audit_logs/i.test(error.message || '')) adminAuditTableAvailable = false;
      } else {
        (data || []).forEach((row) => {
          entries.push({
            id: `audit-${row.id}`,
            created_at: row.created_at,
            admin_email: row.admin_email,
            action: row.action,
            entity_type: row.entity_type,
            entity_id: row.entity_id,
            target_email: row.target_email,
            summary: row.summary,
            metadata: row.metadata,
          });
        });
      }
    }

    const { data: rewardRows } = await supabase
      .from('referral_rewards')
      .select('id, reward_recipient_email, reward_type, reward_value, issued_at, issued_by_admin_email, reversed_at, reversed_by_admin_email')
      .or('issued_at.not.is.null,reversed_at.not.is.null')
      .order('updated_at', { ascending: false })
      .limit(100);

    (rewardRows || []).forEach((row) => {
      if (row.issued_at) {
        entries.push({
          id: `reward-issued-${row.id}`,
          created_at: row.issued_at,
          admin_email: row.issued_by_admin_email || 'admin',
          action: 'reward_issued',
          entity_type: 'referral_reward',
          entity_id: row.id,
          target_email: row.reward_recipient_email,
          summary: `Issued ${row.reward_value} ${row.reward_type} to ${row.reward_recipient_email}`,
          metadata: { reward_type: row.reward_type, reward_value: row.reward_value },
        });
      }
      if (row.reversed_at) {
        entries.push({
          id: `reward-reversed-${row.id}`,
          created_at: row.reversed_at,
          admin_email: row.reversed_by_admin_email || 'admin',
          action: 'reward_reversed',
          entity_type: 'referral_reward',
          entity_id: row.id,
          target_email: row.reward_recipient_email,
          summary: `Reversed reward for ${row.reward_recipient_email}`,
          metadata: { reward_type: row.reward_type, reward_value: row.reward_value },
        });
      }
    });

    res.json(entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 200));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User progress ────────────────────────────────────────────────────────────

// Mark a task complete and record step counts
app.post('/user/task-complete', requireAuth, async (req, res) => {
  const { taskId, stepsCompleted, totalSteps } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  const { error } = await supabase.from('user_tasks').update({
    completed_at: new Date().toISOString(),
    steps_completed: stepsCompleted || 0,
    total_steps: totalSteps || 0,
  }).eq('id', taskId).eq('user_id', req.authUser.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Record partial step progress (without full completion)
app.post('/user/step-progress', requireAuth, async (req, res) => {
  const { taskId, stepsCompleted, totalSteps } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  const { error } = await supabase.from('user_tasks').update({
    steps_completed: stepsCompleted || 0,
    total_steps: totalSteps || 0,
  }).eq('id', taskId).eq('user_id', req.authUser.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Get user progress stats
app.get('/user/progress', requireAuth, async (req, res) => {
  const userId = req.authUser.id;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: allTasks } = await supabase
    .from('user_tasks')
    .select('id, completed_at, steps_completed, total_steps, created_at')
    .eq('user_id', userId);

  if (!allTasks) return res.json({ tasksThisWeek: 0, tasksToday: 0, stepsToday: 0, completionRate: 0, streak: 0 });

  const completedTasks = allTasks.filter(t => t.completed_at);
  const tasksThisWeek = completedTasks.filter(t => t.completed_at >= weekStart).length;
  const tasksToday = completedTasks.filter(t => t.completed_at >= todayStart).length;

  // Steps completed today — sum from tasks completed today + in-progress updated today
  const stepsToday = allTasks
    .filter(t => (t.completed_at >= todayStart) || (!t.completed_at && t.created_at >= todayStart))
    .reduce((sum, t) => sum + (t.steps_completed || 0), 0);

  // Completion rate: completed / started (tasks with at least 1 step done)
  const started = allTasks.filter(t => (t.steps_completed || 0) > 0).length;
  const completionRate = started > 0 ? Math.round((completedTasks.length / started) * 100) : 0;

  // Streak: consecutive days with at least one completed task (working backwards from today)
  const completionDays = new Set(
    completedTasks.map(t => new Date(t.completed_at).toDateString())
  );
  let streak = 0;
  const check = new Date();
  while (completionDays.has(check.toDateString())) {
    streak++;
    check.setDate(check.getDate() - 1);
  }

  res.json({ tasksThisWeek, tasksToday, stepsToday, completionRate, streak });
});

async function checkCacheTable() {
  const { error } = await supabase.from('translations_cache').select('cache_key').limit(1);
  if (error) {
    console.error('\n⚠️  translations_cache table missing or inaccessible:', error.message);
    console.error('Run backend/translations-cache-schema.sql in your Supabase SQL editor, or use this SQL:\n');
    console.error(`CREATE TABLE translations_cache (
  cache_key     TEXT PRIMARY KEY,
  input_type    TEXT NOT NULL,
  input_data    JSONB,
  response      JSONB NOT NULL,
  hit_count     INTEGER DEFAULT 1,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_used_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS translations_cache_input_type_idx
  ON translations_cache (input_type);

CREATE INDEX IF NOT EXISTS translations_cache_last_used_idx
  ON translations_cache (last_used_at DESC);\n`);
  } else {
    console.log('✓ translations_cache table OK');
  }
}

async function migrateToPlaintextKeys() {
  const { data, error } = await supabase.from('translations_cache').select('*');
  if (error || !data?.length) return;
  let migrated = 0;
  for (const row of data) {
    const newKey = makeLookupKey(row.input_type, row.input_data || {});
    if (newKey === row.cache_key) continue;
    const { error: insertErr } = await supabase.from('translations_cache').upsert({ ...row, cache_key: newKey }, { onConflict: 'cache_key' });
    if (!insertErr) {
      await supabase.from('translations_cache').delete().eq('cache_key', row.cache_key);
      migrated++;
    }
  }
  if (migrated > 0) console.log(`✓ Auto-migrated ${migrated} cache keys to plaintext`);
}

// ── Task Sharing ─────────────────────────────────────────────────────────────

function generateShareCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function ensureShareCode(taskId, ownerUserId) {
  // Return existing canonical row (no recipient attached yet) if one exists
  const { data: existing } = await supabase
    .from('task_shares')
    .select('share_code')
    .eq('task_id', taskId)
    .eq('owner_user_id', ownerUserId)
    .is('shared_with_user_id', null)
    .maybeSingle();
  if (existing?.share_code) return existing.share_code;

  let code, attempts = 0;
  do {
    code = generateShareCode();
    const { data: clash } = await supabase
      .from('task_shares')
      .select('id')
      .eq('share_code', code)
      .is('shared_with_user_id', null)
      .maybeSingle();
    if (!clash) break;
  } while (++attempts < 10);

  await supabase.from('task_shares').insert({
    task_id: taskId,
    owner_user_id: ownerUserId,
    share_code: code,
    status: 'pending',
  });
  return code;
}

// GET /api/task-share/create?taskId=...&userId=...
// Returns or creates a share code for the task. Requires the task to belong to the user.
app.get('/api/task-share/create', requireAuth, async (req, res) => {
  const { taskId } = req.query;
  const userId = req.authUser.id;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });

  // Verify ownership
  const { data: task } = await supabase
    .from('user_tasks')
    .select('id, task, result')
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!task) return res.status(404).json({ error: 'Task not found or not yours' });

  const moderation = await moderateTaskInput(stringifyShareContent(task.task, task.result));
  if (!moderation.allow) {
    return res.status(400).json({
      error: 'This task cannot be shared publicly because it contains unsafe or abusive content.',
      blocked: true,
      moderation,
    });
  }

  // Self-share guard: share_code is tied to the task, not a specific person —
  // the self-share check happens at the attach step instead.

  try {
    const code = await ensureShareCode(taskId, userId);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.json({ shareCode: code, shareUrl: `${baseUrl}/task-share/${code}`, taskText: task.task });
  } catch (err) {
    console.error('task-share create error:', err.message);
    res.status(500).json({ error: 'Could not create share link' });
  }
});

// POST /api/task-share/track
// Called when someone lands on a shared task link. Logs the click (hashed IP only).
// Returns the task data so the public page can render it.
app.post('/api/task-share/track', async (req, res) => {
  const { shareCode } = req.body;
  if (!shareCode) return res.status(400).json({ error: 'shareCode required' });
  const ip = getClientIp(req);

  // Log click
  await supabase.from('task_share_clicks').insert({
    share_code: shareCode,
    ip_hash: hashIp(ip),
  });

  // Fetch share + task data
  const { data: share } = await supabase
    .from('task_shares')
    .select('task_id, owner_user_id, status')
    .eq('share_code', shareCode)
    .is('shared_with_user_id', null)
    .maybeSingle();

  if (!share) return res.status(404).json({ error: 'Share not found' });
  if (share.status === 'declined') return res.status(410).json({ error: 'Share unavailable' });

  const { data: task } = await supabase
    .from('user_tasks')
    .select('task, result')
    .eq('id', share.task_id)
    .maybeSingle();

  const moderation = await moderateTaskInput(stringifyShareContent(task?.task, task?.result));
  if (!moderation.allow) return res.status(410).json({ error: 'Share unavailable' });

  res.json({ ok: true, task: task?.task || null, result: task?.result || null });
});

// GET /api/task-share/stats?userId=...
// Returns stats and share list for the current user's outgoing shares.
// MUST be declared before /:shareCode to prevent "stats" matching the param.
app.get('/api/task-share/stats', requireAuth, async (req, res) => {
  const userId = req.authUser.id;

  const { data: canonicalShares } = await supabase
    .from('task_shares')
    .select('share_code, task_id, created_at')
    .eq('owner_user_id', userId)
    .is('shared_with_user_id', null)
    .order('created_at', { ascending: false });

  if (!canonicalShares?.length) return res.json({ totalShares: 0, totalClicks: 0, totalAccepted: 0, totalCompleted: 0, completionRate: 0, shares: [] });

  const codes = canonicalShares.map(s => s.share_code);
  const taskIds = [...new Set(canonicalShares.map(s => s.task_id))];

  const { data: recipientRows } = await supabase
    .from('task_shares')
    .select('share_code, task_id, status, shared_with_user_id')
    .eq('owner_user_id', userId)
    .not('shared_with_user_id', 'is', null);

  const { data: clickRows } = await supabase
    .from('task_share_clicks')
    .select('share_code')
    .in('share_code', codes);

  const clicksByCod = {};
  (clickRows || []).forEach(r => { clicksByCod[r.share_code] = (clicksByCod[r.share_code] || 0) + 1; });

  const { data: tasks } = await supabase
    .from('user_tasks')
    .select('id, task')
    .in('id', taskIds);
  const taskMap = Object.fromEntries((tasks || []).map(t => [t.id, t.task]));

  const recipientsByTask = {};
  (recipientRows || []).forEach(r => {
    if (!recipientsByTask[r.task_id]) recipientsByTask[r.task_id] = [];
    recipientsByTask[r.task_id].push({ status: r.status, userId: r.shared_with_user_id });
  });

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const shares = canonicalShares.map(s => ({
    taskId: s.task_id,
    taskText: taskMap[s.task_id] || 'Unknown task',
    shareCode: s.share_code,
    shareUrl: `${baseUrl}/task-share/${s.share_code}`,
    clickCount: clicksByCod[s.share_code] || 0,
    recipients: recipientsByTask[s.task_id] || [],
    acceptedCount: (recipientsByTask[s.task_id] || []).filter(r => ['accepted', 'completed'].includes(r.status)).length,
    completedCount: (recipientsByTask[s.task_id] || []).filter(r => r.status === 'completed').length,
    createdAt: s.created_at,
  }));

  const totalAccepted = shares.reduce((s, r) => s + r.acceptedCount, 0);
  const totalCompleted = shares.reduce((s, r) => s + r.completedCount, 0);
  const totalClicks = shares.reduce((s, r) => s + r.clickCount, 0);
  const completionRate = totalAccepted > 0 ? Math.round((totalCompleted / totalAccepted) * 100) : 0;

  res.json({ totalShares: shares.length, totalClicks, totalAccepted, totalCompleted, completionRate, shares });
});

// DELETE /api/task-share/:shareCode
// Removes a share link owned by the current user along with recipient rows and click logs.
app.delete('/api/task-share/:shareCode', requireAuth, async (req, res) => {
  const { shareCode } = req.params;
  const userId = req.authUser.id;

  if (!shareCode) return res.status(400).json({ error: 'shareCode required' });

  const { data: canonicalShare } = await supabase
    .from('task_shares')
    .select('id')
    .eq('share_code', shareCode)
    .eq('owner_user_id', userId)
    .is('shared_with_user_id', null)
    .maybeSingle();

  if (!canonicalShare) {
    return res.status(404).json({ error: 'Share not found or not yours' });
  }

  const { error: clicksError } = await supabase
    .from('task_share_clicks')
    .delete()
    .eq('share_code', shareCode);

  if (clicksError) {
    console.error('task-share delete clicks error:', clicksError.message);
    return res.status(500).json({ error: 'Could not delete share' });
  }

  const { error: sharesError } = await supabase
    .from('task_shares')
    .delete()
    .eq('share_code', shareCode)
    .eq('owner_user_id', userId);

  if (sharesError) {
    console.error('task-share delete rows error:', sharesError.message);
    return res.status(500).json({ error: 'Could not delete share' });
  }

  res.json({ ok: true });
});

// GET /api/task-share/:shareCode
// Public: fetch share data for the public share page.
app.get('/api/task-share/:shareCode', async (req, res) => {
  const { shareCode } = req.params;

  const { data: share } = await supabase
    .from('task_shares')
    .select('id, task_id, owner_user_id, status, shared_with_user_id, created_at')
    .eq('share_code', shareCode)
    .is('shared_with_user_id', null)
    .maybeSingle();

  if (!share) return res.status(404).json({ error: 'Share not found' });
  if (share.status === 'declined') return res.status(410).json({ error: 'Share unavailable' });

  const { data: task } = await supabase
    .from('user_tasks')
    .select('task, result')
    .eq('id', share.task_id)
    .maybeSingle();

  const moderation = await moderateTaskInput(stringifyShareContent(task?.task, task?.result));
  if (!moderation.allow) return res.status(410).json({ error: 'Share unavailable' });

  const { count: clickCount } = await supabase
    .from('task_share_clicks')
    .select('*', { count: 'exact', head: true })
    .eq('share_code', shareCode);

  res.json({
    shareCode,
    status: share.status,
    task: task?.task || null,
    result: task?.result || null,
    clickCount: clickCount || 0,
    createdAt: share.created_at,
  });
});

// POST /api/task-share/attach
// Called after sign-in when a pendingTaskShare code is stored in localStorage.
// Associates the signed-in user with the share record.
app.post('/api/task-share/attach', requireAuth, async (req, res) => {
  const { shareCode } = req.body;
  const userId = req.authUser.id;
  if (!shareCode || !userId) return res.json({ ok: true });

  // Find the canonical share row
  const { data: share } = await supabase
    .from('task_shares')
    .select('id, task_id, owner_user_id, status')
    .eq('share_code', shareCode)
    .is('shared_with_user_id', null)
    .maybeSingle();

  if (!share) return res.json({ ok: true, skipped: 'not_found' });
  if (share.status === 'declined') return res.json({ ok: true, skipped: 'blocked' });
  if (share.owner_user_id === userId) return res.json({ ok: true, skipped: 'self_share' });

  // Check if this user is already attached to this task
  const { data: dupe } = await supabase
    .from('task_shares')
    .select('id')
    .eq('task_id', share.task_id)
    .eq('shared_with_user_id', userId)
    .maybeSingle();
  if (dupe) return res.json({ ok: true, skipped: 'already_attached' });

  // Update the canonical row to attach this recipient, then create a fresh canonical row
  await supabase
    .from('task_shares')
    .update({ shared_with_user_id: userId })
    .eq('id', share.id);

  // Create a new canonical row so the link stays shareable with additional people
  await supabase.from('task_shares').insert({
    task_id: share.task_id,
    owner_user_id: share.owner_user_id,
    share_code: shareCode,
    status: 'pending',
  }).select();

  res.json({ ok: true });
});

// POST /api/task-share/respond
// Recipient accepts, declines, or marks the shared task completed.
app.post('/api/task-share/respond', requireAuth, async (req, res) => {
  const { shareCode, status } = req.body;
  const userId = req.authUser.id;
  if (!shareCode || !userId || !status) return res.status(400).json({ error: 'shareCode, userId, status required' });
  if (!['accepted', 'declined', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const { data: share, error } = await supabase
    .from('task_shares')
    .update({ status })
    .eq('share_code', shareCode)
    .eq('shared_with_user_id', userId)
    .select()
    .maybeSingle();

  if (error || !share) return res.status(404).json({ error: 'Share record not found for this user' });
  res.json({ ok: true, status });
});

app.get([
  '/Translator',
  '/Translator/*',
  '/translator',
  '/translator/*',
  '/admin',
  '/admin/',
  '/admin/*',
  '/Translator/admin',
  '/Translator/admin/*',
  '/translator/admin',
  '/translator/admin/*',
], (req, res) => {
  res.sendFile(translatorIndexPath);
});

const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, async () => {
  console.log(`FocusStep API running on ${HOST}:${PORT}`);
  await checkCacheTable();
  await migrateToPlaintextKeys();
});
