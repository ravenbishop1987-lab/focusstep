const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const USE_LOCAL_LM = process.env.USE_LOCAL_LM === 'true';
const LM_STUDIO_URL = (process.env.LM_STUDIO_URL || 'http://localhost:1234') + '/v1/chat/completions';
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'local-model';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const FILLER_WORDS = /\b(please|can you|could you|help me|i need to|i want to|i have to|i've got to|how (do i|to)|let's|let me|gonna|going to|need to|want to|the|a|an|my|some|just|really|quickly|now|today)\b/gi;

function normalizeTask(text) {
  return text.toLowerCase().replace(FILLER_WORDS, '').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function makeCacheKey(type, data) {
  const cleaned = { type, ...data };
  if (cleaned.task) cleaned.task = normalizeTask(cleaned.task);
  if (cleaned.answer) cleaned.answer = cleaned.answer.toLowerCase().trim();
  const normalized = JSON.stringify(cleaned).replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Calls LM Studio (or throws if USE_LOCAL_LM is false — hardcoded responses used instead)
async function callLM(systemPrompt, userContent, maxTokens) {
  if (!USE_LOCAL_LM) throw new Error('USE_LOCAL_LM not enabled');
  const res = await fetch(LM_STUDIO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LM_STUDIO_MODEL, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }], max_tokens: maxTokens, temperature: 0.7 })
  });
  if (!res.ok) throw new Error(`LM Studio ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.choices[0].message.content;
}

function parseJSON(raw) {
  const cleaned = raw.trim().replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}

// ─────────────────────────────────────────────
// PROMPTS (must match server.js)
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a calm, supportive task translator for people with ADHD. Break down tasks into clear, specific steps that feel doable — not overwhelming.

STRICT RULES:
- Return 3 to 5 steps maximum. Never more than 5.
- Each step = ONE single action only. Never combine multiple actions.
- The detail field = 1 to 2 sentences. Be VERY specific — include exact tools, amounts, locations, durations, and what it feels or looks like when done correctly.
- No future habits, no follow-up tasks, no going forward advice.
- For cooking: include exact temperature, time, tool, and visual cue for doneness.
- For cleaning: include exact product name, tool, motion, and how long.
- For admin: include exact app, menu, button name, and what to type or select.
- For personal care: include exact body position, motion, duration, and sensory cue.
- Use calm, plain language. Active verbs only. Paint a clear picture.
- Never use should, must, need to, have to.
- Never write vague details like "get comfortable" or "do it naturally" — always be specific.
- The startHere is the single smallest physical action to begin. One sentence. Very specific.
- Also generate ONE follow-up question that would make the steps more specific if answered.

Respond ONLY with valid JSON:
{"simplified":"One clear sentence","startHere":"Smallest first action","startTime":"5 min","followUpQuestion":"One short question","steps":[{"action":"Short title","detail":"1-2 very specific sentences"}]}`;

const HELP_STEP_PROMPT = `You are a calm assistant for ADHD brains stuck on one step of a task.

Give 2-3 very specific sub-instructions for ONLY that step.
Also return exactly 3 short suggested questions the user might ask about this specific step.

STRICT RULES:
- Return exactly 2 to 3 sub-steps.
- Each sub-step = one single physical action. Max 2 sentences.
- Extremely specific: tools, amounts, locations, times.
- Stay focused on the ONE step only. Calm language. No shame. Active verbs.
- Suggested questions must be short, specific, and relevant to this exact step.

Respond ONLY with valid JSON:
{"helpText":"One calming sentence.","subSteps":["First sub-action.","Second sub-action.","Third sub-action."],"suggestedQuestions":["Question one?","Question two?","Question three?"]}`;

// ─────────────────────────────────────────────
// AUTO-GENERATE TASKS (used when USE_LOCAL_LM=true and no hardcoded response)
// Add task strings here — LM Studio will generate their responses automatically
// ─────────────────────────────────────────────
const autoGenerateTasks = [
  'wash the dishes',
  'clean my room',
  'do my laundry',
  'brush my teeth',
  'reply to emails',
  'take a shower',
  'make my bed',
  'wash my hair',
  'cook pasta',
  'go grocery shopping',
  'pay a bill online',
  'empty the bins',
  'vacuum the living room',
  'pack a bag for tomorrow',
  'charge my phone and laptop'
];

// ─────────────────────────────────────────────
// HARDCODED STARTER QUESTIONS (always inserted regardless of USE_LOCAL_LM)
// Use these when you want exact control over the response
// ─────────────────────────────────────────────
const starterTranslations = [
  {
    task: 'wash the dishes',
    response: {
      simplified: 'Wash all the dirty dishes in the sink.',
      startHere: 'Turn on the hot water tap until it runs warm.',
      startTime: '10 min',
      followUpQuestion: 'Do you have a dishwasher or are you washing by hand?',
      steps: [
        { action: 'Clear the sink', detail: 'Move any food scraps into the bin and stack dishes to the side of the sink so the drain is clear.' },
        { action: 'Fill with hot soapy water', detail: 'Plug the drain, turn the hot tap to medium, and squeeze a 2cm line of dish soap in. Fill until there is about 10cm of water.' },
        { action: 'Wash glasses first', detail: 'Use the sponge to scrub inside and outside each glass, then place upside down on the drying rack.' },
        { action: 'Wash plates and bowls', detail: 'Scrub both sides of each plate with the sponge using circular motions, rinse under the running tap until no suds remain.' },
        { action: 'Wash pots and cutlery last', detail: 'Scrub pots with the rough side of the sponge, then drop all cutlery into the rack handle-down to air dry.' }
      ]
    }
  },
  {
    task: 'clean my room',
    response: {
      simplified: 'Tidy your bedroom floor, surfaces, and bed.',
      startHere: 'Pick up one item of clothing from the floor and put it in the laundry basket.',
      startTime: '15 min',
      followUpQuestion: 'Is the main problem clothes on the floor, stuff on surfaces, or both?',
      steps: [
        { action: 'Clear the floor', detail: 'Pick up every item off the floor — clothes go in the laundry basket, everything else goes on the bed to sort later.' },
        { action: 'Make the bed', detail: 'Pull the fitted sheet tight at all four corners, lay the duvet flat and centred, then place pillows at the head.' },
        { action: 'Clear surfaces', detail: 'Take everything off your desk and bedside table and put it in one pile. Throw away rubbish, put drinks in the kitchen, and return items to their drawer or shelf.' },
        { action: 'Vacuum or sweep the floor', detail: 'Run the vacuum in straight overlapping lines from the far corner toward the door. Empty the dustbin if it is more than half full.' }
      ]
    }
  },
  {
    task: 'do my laundry',
    response: {
      simplified: 'Wash, dry, and put away a load of laundry.',
      startHere: 'Grab your laundry basket and carry it to the washing machine.',
      startTime: '5 min active, 1 hr total',
      followUpQuestion: 'Is this clothes, bedding, or towels?',
      steps: [
        { action: 'Sort and load the machine', detail: 'Separate darks from lights. Load dark items into the drum — do not fill past the rubber seal line.' },
        { action: 'Add detergent', detail: 'Pour one cap of liquid detergent into the drawer marked II (main wash). If powder, pour 35g into the same drawer.' },
        { action: 'Select the cycle and start', detail: 'Turn the dial to 40°C cotton or a quick wash. Press Start and set a phone timer for when it finishes.' },
        { action: 'Move to dryer or hang up', detail: 'Shake each item once before placing in the dryer or hanging on the airer — this reduces wrinkles. Do not bunch items together.' }
      ]
    }
  },
  {
    task: 'brush my teeth',
    response: {
      simplified: 'Brush all surfaces of your teeth for two minutes.',
      startHere: 'Pick up your toothbrush and hold it under the cold tap for 2 seconds.',
      startTime: '3 min',
      followUpQuestion: 'Do you use an electric or manual toothbrush?',
      steps: [
        { action: 'Apply toothpaste', detail: 'Squeeze a pea-sized amount of toothpaste onto the bristles — about the size of a small blueberry.' },
        { action: 'Brush the outer surfaces', detail: 'Hold the brush at a 45-degree angle to your gum line and move in small circles along the outer face of each tooth. Spend 30 seconds on the top row, 30 seconds on the bottom.' },
        { action: 'Brush the inner and chewing surfaces', detail: 'Tilt the brush vertically for the inner surfaces behind your front teeth, then scrub the flat chewing surfaces of your back teeth with a back-and-forth motion.' },
        { action: 'Rinse and spit', detail: 'Take one small sip of water, swish it around your mouth for 5 seconds, then spit into the sink. Rinse the brush under the tap and stand it upright.' }
      ]
    }
  },
  {
    task: 'reply to emails',
    response: {
      simplified: 'Work through your inbox and reply to emails that need a response.',
      startHere: 'Open your email app and click on the oldest unread message.',
      startTime: '20 min',
      followUpQuestion: 'Are these work emails, personal emails, or a mix?',
      steps: [
        { action: 'Open the oldest unread email', detail: 'Click the top email in your unread folder. Read it fully before doing anything else.' },
        { action: 'Decide: reply, delete, or archive', detail: 'If it needs a reply, keep it open. If it is junk or already handled, press Delete or Archive now — do not skip this decision.' },
        { action: 'Write a short reply', detail: 'Start with the person\'s name, write one to three sentences answering their question or confirming your action, then sign off with your name. Do not overthink it.' },
        { action: 'Hit Send, then move to the next email', detail: 'Press Send immediately after writing — do not re-read more than once. Close the email and open the next unread one.' }
      ]
    }
  }
];

const starterHelpSteps = [
  {
    input: { task: 'wash the dishes', stepAction: 'Fill with hot soapy water', stepDetail: '', question: 'How much soap do I use?' },
    response: {
      helpText: 'Just a small squeeze is all you need.',
      subSteps: [
        'Hold the dish soap bottle over the running water and squeeze for about 1 second — a 2cm line of soap.',
        'Swirl the water with your hand until you see bubbles forming on the surface.',
        'If bubbles disappear quickly while washing, add one more short squeeze.'
      ],
      suggestedQuestions: ['What if the water gets cold?', 'How often should I change the water?', 'What if I run out of dish soap?']
    }
  }
];

// ─────────────────────────────────────────────

async function insertEntry(key, type, inputData, response) {
  const { error } = await supabase.from('translations_cache').insert({
    cache_key: key, input_type: type, input_data: inputData,
    response, hit_count: 0, created_at: new Date().toISOString(), last_used_at: new Date().toISOString()
  });
  return error;
}

async function seed() {
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  if (USE_LOCAL_LM) console.log(`[LM Studio] Auto-generating ${autoGenerateTasks.length} tasks from ${LM_STUDIO_URL}...\n`);

  // ── Hardcoded translations ──
  for (const item of starterTranslations) {
    const key = makeCacheKey('translate', { task: item.task });
    const { data: existing } = await supabase.from('translations_cache').select('cache_key').eq('cache_key', key).single();
    if (existing) { console.log(`SKIP (exists): "${item.task}"`); skipped++; continue; }
    const err = await insertEntry(key, 'translate', { task: item.task }, item.response);
    if (err) { console.error(`ERROR: "${item.task}":`, err.message); failed++; }
    else { console.log(`OK (hardcoded): "${item.task}"`); inserted++; }
  }

  // ── Hardcoded help-steps ──
  for (const item of starterHelpSteps) {
    const key = makeCacheKey('help-step', item.input);
    const { data: existing } = await supabase.from('translations_cache').select('cache_key').eq('cache_key', key).single();
    if (existing) { console.log(`SKIP (exists): help-step "${item.input.stepAction}"`); skipped++; continue; }
    const err = await insertEntry(key, 'help-step', item.input, item.response);
    if (err) { console.error(`ERROR: help-step "${item.input.stepAction}":`, err.message); failed++; }
    else { console.log(`OK (hardcoded): help-step "${item.input.stepAction}"`); inserted++; }
  }

  // ── LM Studio auto-generated translations ──
  if (USE_LOCAL_LM) {
    for (const task of autoGenerateTasks) {
      const key = makeCacheKey('translate', { task });
      const { data: existing } = await supabase.from('translations_cache').select('cache_key').eq('cache_key', key).single();
      if (existing) { console.log(`SKIP (exists): "${task}"`); skipped++; continue; }
      process.stdout.write(`GENERATING: "${task}"... `);
      try {
        const raw = await callLM(SYSTEM_PROMPT, 'Task: ' + task, 900);
        const parsed = parseJSON(raw);
        if (parsed.steps && parsed.steps.length > 5) parsed.steps = parsed.steps.slice(0, 5);
        const err = await insertEntry(key, 'translate', { task }, parsed);
        if (err) { console.log(`ERROR: ${err.message}`); failed++; }
        else { console.log('OK'); inserted++; }
      } catch (e) { console.log(`FAILED: ${e.message}`); failed++; }
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}, Failed: ${failed}`);
  if (!USE_LOCAL_LM && autoGenerateTasks.length > 0) {
    console.log(`\nTip: run with USE_LOCAL_LM=true to auto-generate ${autoGenerateTasks.length} tasks via LM Studio.`);
  }
  process.exit(0);
}

seed();
