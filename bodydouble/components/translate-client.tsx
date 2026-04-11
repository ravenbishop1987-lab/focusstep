'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import styles from './translate-client.module.css'

const LOADING_MESSAGES = [
  'Breaking it down…',
  'Finding the details…',
  'Making this easier…',
]
const REFINE_MESSAGES = ['Making this more specific…', 'Tailoring the steps…']
const CTA_OPTIONS = ['Just tell me what to do', 'Give me the first step', 'Start me']

type Step = { action: string; detail?: string } | string
type TranslateResult = {
  startHere: string
  startTime?: string
  steps: Step[]
  followUpQuestion?: string
  usage?: number
  limit?: number
}
type HelpResult = { helpText: string; subSteps: string[] }

function parseStep(s: Step) {
  return {
    action: typeof s === 'string' ? s : s.action,
    detail: typeof s === 'object' ? s.detail : undefined,
  }
}

function speakText(text: string) {
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.9
  window.speechSynthesis.speak(u)
}

// ── Inline step item (for list view below result card) ─────────────────────────
function StepItem({
  index,
  step,
  task,
  userEmail,
  onLimitReached,
}: {
  index: number
  step: Step
  task: string
  userEmail: string
  onLimitReached: () => void
}) {
  const [showHelp, setShowHelp] = useState(false)
  const [helpQuestion, setHelpQuestion] = useState('')
  const [helpResult, setHelpResult] = useState<HelpResult | null>(null)
  const [loadingHelp, setLoadingHelp] = useState(false)
  const [helpError, setHelpError] = useState<string | null>(null)
  const { action, detail } = parseStep(step)

  const handleGetHelp = async (preset?: string) => {
    const question = preset !== undefined ? preset : helpQuestion
    setLoadingHelp(true)
    setHelpError(null)
    try {
      const res = await fetch('/api/translate/help-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, stepAction: action, stepDetail: detail, question, email: userEmail }),
      })
      const data = await res.json()
      if (res.status === 429) { onLimitReached(); return }
      if (!res.ok) { setHelpError(data.error ?? 'Something went wrong.'); return }
      setHelpResult(data)
      setShowHelp(false)
      setHelpQuestion('')
    } catch {
      setHelpError("Couldn't connect to the server.")
    } finally {
      setLoadingHelp(false)
    }
  }

  return (
    <li className={styles.stepItem}>
      <div className={styles.stepNum}>{index + 1}</div>
      <div className={styles.stepContent}>
        <div className={styles.stepActionRow}>
          <span className={styles.stepAction}>{action}</span>
          <button
            className={styles.audioBtn}
            title="Read aloud"
            onClick={() => speakText(action + (detail ? '. ' + detail : ''))}
          >🔊</button>
        </div>
        {detail && <div className={styles.stepDetail}>{detail}</div>}

        {helpResult && (
          <div className={styles.stepHelpResult}>
            <div className={styles.stepHelpText}>{helpResult.helpText}</div>
            <ul className={styles.stepSubsteps}>
              {helpResult.subSteps.map((sub, i) => (
                <li key={i} className={styles.stepSubstep}>
                  <span className={styles.substepDot}>→</span>
                  <span>{sub}</span>
                </li>
              ))}
            </ul>
            <div className={styles.helpResultActions}>
              <button className={styles.helpDismiss} onClick={() => setHelpResult(null)}>Got it ✓</button>
              <button
                className={styles.audioBtn}
                onClick={() => speakText(helpResult.helpText + '. ' + helpResult.subSteps.join('. '))}
              >🔊</button>
            </div>
          </div>
        )}

        {!helpResult && showHelp && (
          <div className={styles.stepHelpInputArea}>
            <p className={styles.stepHelpPrompt}>
              What part are you stuck on? <span>(optional)</span>
            </p>
            <div className={styles.suggestedBtns}>
              {['Give me more detail', 'What do I need for this?', 'What if I get stuck here?'].map((q) => (
                <button
                  key={q}
                  className={styles.suggestedBtn}
                  onClick={() => handleGetHelp(q)}
                  disabled={loadingHelp}
                >
                  {q}
                </button>
              ))}
            </div>
            <textarea
              className={styles.stepHelpTextarea}
              placeholder="Or type your own question here…"
              value={helpQuestion}
              onChange={(e) => setHelpQuestion(e.target.value)}
              rows={2}
              disabled={loadingHelp}
            />
            {helpError && <p className={styles.helpError}>{helpError}</p>}
            <div className={styles.stepHelpActions}>
              <button
                className={styles.followupCancel}
                onClick={() => { setShowHelp(false); setHelpQuestion(''); setHelpError(null) }}
              >
                Cancel
              </button>
              <button
                className={styles.translateBtn}
                style={{ padding: '9px 16px', fontSize: '0.85rem' }}
                onClick={() => handleGetHelp()}
                disabled={loadingHelp}
              >
                {loadingHelp ? 'Getting help…' : 'Get Help →'}
              </button>
            </div>
          </div>
        )}

        {!helpResult && !showHelp && (
          <button className={styles.stepHelpTrigger} onClick={() => setShowHelp(true)}>
            + I need help with this step
          </button>
        )}
      </div>
    </li>
  )
}

// ═══════════════════════════════════════════════════════════════
// STEP EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════

function StepCard({
  stepNum,
  totalSteps,
  action,
  detail,
  isIntro,
  animState,
  onDone,
  task,
  userEmail,
}: {
  stepNum: number
  totalSteps: number
  action: string
  detail?: string
  isIntro: boolean
  animState: string
  onDone: () => void
  task: string
  userEmail: string
}) {
  const [stuckOpen, setStuckOpen] = useState(false)
  const [stuckLoading, setStuckLoading] = useState(false)
  const [stuckResult, setStuckResult] = useState<HelpResult | null>(null)

  useEffect(() => {
    setStuckOpen(false)
    setStuckResult(null)
  }, [stepNum])

  const QUICK = ['Give me more detail', 'What do I need for this?', 'What if I get stuck here?']

  const handleHelp = async (q: string) => {
    setStuckLoading(true)
    try {
      const res = await fetch('/api/translate/help-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, stepAction: action, stepDetail: detail, question: q, email: userEmail }),
      })
      const data = await res.json()
      if (!res.ok) return
      setStuckResult(data)
      setStuckOpen(false)
    } catch { /* non-critical */ }
    finally { setStuckLoading(false) }
  }

  const cardClass = {
    visible: styles.execCardVisible,
    'exit-left': styles.execCardExitLeft,
    'exit-right': styles.execCardExitRight,
    'enter-right': styles.execCardEnterRight,
    'enter-left': styles.execCardEnterLeft,
  }[animState] ?? styles.execCardVisible

  return (
    <div className={`${styles.execCard} ${cardClass}`}>
      <div className={styles.execStepLabel}>
        {isIntro ? 'Before you begin' : `Step ${stepNum} of ${totalSteps}`}
      </div>

      <div className={styles.execAction}>{action}</div>
      {detail && <div className={styles.execDetail}>{detail}</div>}

      {stuckResult && (
        <div className={styles.execHelpResult}>
          <p className={styles.execHelpIntro}>{stuckResult.helpText}</p>
          {stuckResult.subSteps?.length > 0 && (
            <ul className={styles.execHelpList}>
              {stuckResult.subSteps.map((s, i) => (
                <li key={i}>
                  <span className={styles.execHelpArrow}>→</span>
                  {s}
                </li>
              ))}
            </ul>
          )}
          <button className={styles.execHelpDismiss} onClick={() => setStuckResult(null)}>Got it ✓</button>
        </div>
      )}

      {stuckOpen && !stuckResult && (
        <div className={styles.execStuckPanel}>
          <p className={styles.execStuckHeading}>What part is unclear?</p>
          <div className={styles.execStuckOptions}>
            {QUICK.map((q) => (
              <button
                key={q}
                className={styles.execStuckOption}
                onClick={() => handleHelp(q)}
                disabled={stuckLoading}
              >
                {stuckLoading ? 'Getting help…' : q}
              </button>
            ))}
          </div>
          <button className={styles.execStuckCancel} onClick={() => setStuckOpen(false)}>
            Never mind
          </button>
        </div>
      )}

      <div className={styles.execActions}>
        <div className={styles.execActionsRow}>
          {!isIntro && (
            <button className={styles.execDoneSecondary} onClick={onDone} disabled={animState !== 'visible'}>
              Done
            </button>
          )}
          <button
            className={styles.execDoneBtn}
            onClick={onDone}
            disabled={animState !== 'visible'}
          >
            {isIntro ? 'Start here' : stepNum >= totalSteps ? 'Finish ✓' : 'Next small step →'}
          </button>
        </div>
        {!isIntro && !stuckResult && !stuckOpen && (
          <button className={styles.execStuckBtn} onClick={() => setStuckOpen(true)}>
            I&apos;m stuck
          </button>
        )}
      </div>

      <button
        className={styles.execSpeak}
        onClick={() => speakText(action + (detail ? '. ' + detail : ''))}
      >
        🔊 Read step aloud
      </button>
    </div>
  )
}

function CompletionView({
  task,
  totalSteps,
  onReset,
  isPaid,
  isSignedIn,
}: {
  task: string
  totalSteps: number
  onReset: () => void
  isPaid: boolean
  isSignedIn: boolean
}) {
  const upsellHref = isPaid ? '/match' : isSignedIn ? '/billing' : '/auth'
  const upsellLabel = isPaid
    ? 'Start a Body Double session'
    : isSignedIn
      ? 'Unlock Body Double'
      : 'Create account for Body Double'
  const upsellText = isPaid
    ? 'Take this momentum into a live 25-minute focus session with another person beside you.'
    : 'Want a real person in the room while you tackle the next task? Body Double is the next support layer.'

  return (
    <div className={styles.execComplete}>
      <div className={styles.execCompleteBurst}>🎉</div>
      <h2 className={styles.execCompleteTitle}>You did it.</h2>
      <div className={styles.execCompleteNote}>You showed up — you’re building momentum.</div>
      <p className={styles.execCompleteTask}>{task}</p>
      <div className={styles.execCompleteStats}>
        {totalSteps} step{totalSteps !== 1 ? 's' : ''} completed
      </div>
      <button
        className={`${styles.execDoneBtn} ${styles.execDoneBtnWide}`}
        onClick={onReset}
        style={{ marginTop: 8 }}
      >
        Start another task
      </button>
      <div className={styles.execCompleteUpsell}>
        <p className={styles.execCompleteUpsellLabel}>Next step</p>
        <p className={styles.execCompleteUpsellText}>{upsellText}</p>
        <Link href={upsellHref} className={styles.execCompleteUpsellBtn}>
          {upsellLabel} →
        </Link>
      </div>
    </div>
  )
}

function StepExecution({
  steps,
  startHere,
  task,
  userEmail,
  onReset,
  isPaid,
  isSignedIn,
}: {
  steps: Step[]
  startHere: string
  task: string
  userEmail: string
  onReset: () => void
  isPaid: boolean
  isSignedIn: boolean
}) {
  const [index, setIndex] = useState(-1) // -1 = intro card
  const [done, setDone] = useState(false)
  const [animState, setAnimState] = useState('visible')
  const [showPlan, setShowPlan] = useState(false)
  const [reinforceMsg, setReinforceMsg] = useState<string | null>(null)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [emailToSave, setEmailToSave] = useState(userEmail || '')
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const totalSteps = steps.length
  const isIntro = index === -1
  const progress = isIntro ? 0 : Math.round(((index + 1) / totalSteps) * 100)
  const current = isIntro ? { action: startHere, detail: undefined } : parseStep(steps[index])

  const transition = useCallback((nextFn: () => void, direction: 'next' | 'prev' = 'next') => {
    setAnimState(direction === 'next' ? 'exit-left' : 'exit-right')
    setTimeout(() => {
      nextFn()
      setAnimState(direction === 'next' ? 'enter-right' : 'enter-left')
      setTimeout(() => setAnimState('visible'), 30)
    }, 220)
  }, [])

  const handleDone = useCallback(() => {
    const isLastStep = !isIntro && index + 1 >= totalSteps
    // Choose a small, calm reinforcement message
    const reinforceOptionsFirst = ['You started. That matters.', 'Good. Keep going.']
    const reinforceOptionsLater = ['You didn’t avoid it this time', 'That was the hardest part', 'You’re moving now']
    const msg = isIntro ? reinforceOptionsFirst[Math.floor(Math.random() * reinforceOptionsFirst.length)] : reinforceOptionsLater[Math.floor(Math.random() * reinforceOptionsLater.length)]
    setReinforceMsg(msg)
    // show reinforcement briefly, then advance
    setTimeout(() => {
      setReinforceMsg(null)
      transition(() => {
        if (isLastStep) {
          setDone(true)
        } else {
          setIndex((i) => i + 1)
          // after completing the intro (first actual step), gently offer to save progress
          if (isIntro && !isSignedIn) setShowSavePrompt(true)
        }
      }, 'next')
    }, 700)
  }, [isIntro, index, totalSteps, transition, isSignedIn])

  const handleBack = useCallback(() => {
    if (index <= -1) return
    transition(() => setIndex((i) => i - 1), 'prev')
  }, [index, transition])

  if (done) {
    return (
      <CompletionView
        task={task}
        totalSteps={totalSteps}
        onReset={onReset}
        isPaid={isPaid}
        isSignedIn={isSignedIn}
      />
    )
  }

  return (
    <div className={styles.execShell}>
      <div className={styles.execTopbar}>
        {index > -1 ? (
          <button className={styles.execBack} onClick={handleBack}>← Back</button>
        ) : <span />}
        <button
          className={styles.execExit}
          onClick={() => { window.speechSynthesis.cancel(); onReset() }}
        >
          ✕ Exit
        </button>
      </div>

      <div className={styles.execProgressTrack}>
        <div className={styles.execProgressFill} style={{ width: progress + '%' }} />
      </div>

      <div className={styles.execHeader}>
        {isIntro ? "Let's start" : `Step ${index + 1} of ${totalSteps}`}
      </div>
      <div className={styles.execTaskContext}>{task}</div>

      <StepCard
        key={index}
        stepNum={index + 1}
        totalSteps={totalSteps}
        action={current.action}
        detail={current.detail}
        isIntro={isIntro}
        animState={animState}
        onDone={handleDone}
        task={task}
        userEmail={userEmail}
      />

      {reinforceMsg && (
        <div className={styles.reinforceMsg} role="status">{reinforceMsg}</div>
      )}

      {showSavePrompt && (
        <div className={styles.softSavePrompt}>
          {!saveStatus ? (
            <>
              <div className={styles.softSaveText}>Want to save your progress for later?</div>
              <div className={styles.softSaveActions}>
                <button className={styles.softSaveSkip} onClick={() => setShowSavePrompt(false)}>Continue without saving</button>
                <button className={styles.softSavePrimary} onClick={() => setSaveStatus('prompt')}>Save my progress</button>
              </div>
            </>
          ) : saveStatus === 'prompt' ? (
            <div className={styles.saveForm}>
              <input
                className={styles.saveInput}
                value={emailToSave}
                onChange={(e) => setEmailToSave(e.target.value)}
                placeholder="Email (optional)"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.saveBtn} onClick={async () => {
                  try {
                    const res = await fetch('/api/save-progress', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: emailToSave, task, stepsCompleted: index + 1 })
                    })
                    if (!res.ok) throw new Error('save failed')
                    setSaveStatus('saved')
                    setTimeout(() => setShowSavePrompt(false), 900)
                  } catch {
                    // fallback to localStorage
                    try { localStorage.setItem('focusstep_saved_progress', JSON.stringify({ email: emailToSave, task, stepsCompleted: index + 1, t: Date.now() })) } catch {}
                    setSaveStatus('saved-local')
                    setTimeout(() => setShowSavePrompt(false), 900)
                  }
                }}>Save</button>
                <button className={styles.saveCancel} onClick={() => { setSaveStatus(null); setShowSavePrompt(false) }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className={styles.saveStatusNote}>{saveStatus === 'saved' ? 'Saved — check your inbox if you provided an email.' : 'Saved locally.'}</div>
          )}
        </div>
      )}

      <div className={styles.execPlanToggleRow}>
        <button className={styles.execPlanToggle} onClick={() => setShowPlan((p) => !p)}>
          {showPlan ? 'Hide plan' : 'View full plan'}
        </button>
      </div>

      {showPlan && (
        <div className={styles.execFullPlan}>
          <div className={styles.execPlanLabel}>Full plan</div>
          {steps.map((s, i) => {
            const { action, detail } = parseStep(s)
            const state = i < index ? 'done' : i === index ? 'current' : 'upcoming'
            const rowClass = state === 'done'
              ? `${styles.execPlanRow} ${styles.execPlanRowDone}`
              : state === 'current'
                ? `${styles.execPlanRow} ${styles.execPlanRowCurrent}`
                : styles.execPlanRow
            return (
              <div key={i} className={rowClass}>
                <div className={styles.execPlanDot}>
                  {state === 'done' ? '✓' : i + 1}
                </div>
                <div>
                  <div className={styles.execPlanAction}>{action}</div>
                  {detail && <div className={styles.execPlanDetail}>{detail}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function TranslateClient({
  userEmail,
  isPaid,
  isSignedIn = false,
}: {
  userEmail: string
  userId: string
  isPaid: boolean
  plan: string
  isSignedIn?: boolean
}) {
  const [task, setTask] = useState('')
  const [result, setResult] = useState<TranslateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [refining, setRefining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null)
  const [loadingMsg, setLoadingMsg] = useState(0)
  const [ctaLabel] = useState(() => CTA_OPTIONS[Math.floor(Math.random() * CTA_OPTIONS.length)])
  const [followUpAnswer, setFollowUpAnswer] = useState('')
  const [showFollowUp, setShowFollowUp] = useState(false)
  const [refined, setRefined] = useState(false)
  const [startMode, setStartMode] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const examplePrompts = useMemo(() => {
    const EXAMPLE_POOL = [
      'Clean the bathroom',
      'Tidy the kitchen sink',
      'Reply to that email',
      'Answer the unread message',
      'File my taxes',
      'Start the laundry',
      'Book the appointment',
      'Clear the desktop files',
    ]
    // pick 4 slightly varied prompts so chips feel dynamic
    const copy = [...EXAMPLE_POOL]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, 4)
  }, [])

  // Fetch usage on mount so circles show before first translation
  useEffect(() => {
    if (isPaid) return
    fetch('/api/translate/usage')
      .then(r => r.json())
      .then(data => {
        if (data.usage != null) setUsage({ used: data.usage, limit: data.limit })
      })
      .catch(() => {})
  }, [isPaid])

  const startInterval = (msgs: string[]) => {
    setLoadingMsg(0)
    intervalRef.current = setInterval(() => setLoadingMsg((m) => (m + 1) % msgs.length), 1800)
  }

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const handleTranslate = async () => {
    if (!task.trim() || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setLimitReached(false)
    setShowFollowUp(false)
    setFollowUpAnswer('')
    setRefined(false)
    startInterval(LOADING_MESSAGES)
    try {
      const res = await fetch('/api/translate/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, email: userEmail }),
      })
      const data = await res.json()
      if (res.status === 429) { setLimitReached(true); return }
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      // Normalize the first-step to be ultra-small and action-oriented
      const normalizeFirst = (s?: string) => {
        if (!s) return s
        let t = s.split(/[\.\n]/)[0].trim()
        t = t.replace(/^to\s+/i, '')
        t = t.replace(/^you should\s+/i, '')
        t = t.replace(/^please\s+/i, '')
        return t
      }
      const out = { ...data, startHere: normalizeFirst(data.startHere) }
      setResult(out)
      setStartMode(true) // auto-enter guided execution mode
      if (data.usage != null) setUsage({ used: data.usage, limit: data.limit })
    } catch {
      setError("Couldn't connect to the server.")
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setLoading(false)
    }
  }

  const handleRefine = async () => {
    if (!followUpAnswer.trim() || refining || !result) return
    setRefining(true)
    setError(null)
    startInterval(REFINE_MESSAGES)
    try {
      const res = await fetch('/api/translate/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          question: result.followUpQuestion,
          answer: followUpAnswer,
          email: userEmail,
        }),
      })
      const data = await res.json()
      if (res.status === 429) { setLimitReached(true); return }
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
      setResult(data)
      setRefined(true)
      setShowFollowUp(false)
      setFollowUpAnswer('')
      if (data.usage != null) setUsage({ used: data.usage, limit: data.limit })
    } catch {
      setError("Couldn't connect to the server.")
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setRefining(false)
    }
  }

  const remaining = usage ? usage.limit - usage.used : null

  const handleReset = () => {
    setStartMode(false)
    setResult(null)
    setTask('')
    setUsage(null)
    setRefined(false)
    setError(null)
    setLimitReached(false)
  }

  return (
    <div className={styles.root}>
      <div className={styles.translatorPage}>

        {/* ── Guided step execution mode ──────────────────────────── */}
        {startMode && result && (
          <StepExecution
            steps={result.steps}
            startHere={result.startHere}
            task={task}
            userEmail={userEmail}
            onReset={handleReset}
            isPaid={isPaid}
            isSignedIn={isSignedIn}
          />
        )}

        {/* ── Input + result mode ─────────────────────────────────── */}
        {!startMode && (
          <>
            <div className={styles.pageIntro}>
              <h1>
                Turn overwhelming tasks into<br />
                <em>a clear first step.</em>
              </h1>
              <p>
                Paste what feels stuck. FocusStep gives one tiny step to start.
              </p>
            </div>

            {isPaid && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                background: '#EBF2EC',
                border: '1px solid rgba(107,143,113,0.25)',
                borderRadius: 10,
                marginBottom: 20,
                fontSize: '0.875rem',
                color: '#4A6B50',
                fontWeight: 500,
              }}>
                <span>✓</span>
                <span>Unlimited translations active</span>
              </div>
            )}

            {!isPaid && (
              <div className={styles.usageBar}>
                <div className={styles.usagePips}>
                  {Array.from({ length: usage?.limit ?? 3 }).map((_, i) => (
                    <div
                      key={i}
                      className={`${styles.pip}${i < (usage?.used ?? 0) ? ' ' + styles.used : ''}`}
                    />
                  ))}
                </div>
                <span className={styles.usageText}>
                  {remaining === 0
                    ? 'No free translations left today'
                    : remaining === null
                      ? '3 free translations per day'
                      : `${remaining} free translation${remaining === 1 ? '' : 's'} left today`}
                </span>
                {remaining !== null && remaining <= 2 && remaining > 0 && (
                  <Link href="/billing" className={styles.upgradeLink}>Get more support</Link>
                )}
              </div>
            )}

            {/* Input card */}
            <div className={styles.inputCard}>
              <label className={styles.inputLabel}>What&apos;s overwhelming you right now?</label>
              <div className={styles.examplePrompts}>
                {examplePrompts.map((ex) => (
                  <button
                    key={ex}
                    className={styles.exampleChip}
                    onClick={() => setTask(ex)}
                    disabled={loading}
                  >
                    {ex}
                  </button>
                ))}
              </div>
              <textarea
                className={styles.taskInput}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && handleTranslate()}
                placeholder="Type anything that's been sitting on your list…"
                maxLength={300}
                disabled={loading}
              />
              <div className={styles.inputFooter}>
                <span className={styles.charCount}>
                  {task.length > 0 ? `${task.length}/300` : 'Cmd+Enter to break it down'}
                </span>
                <button
                  className={styles.translateBtn}
                  onClick={handleTranslate}
                  disabled={loading || !task.trim()}
                >
                  {loading ? LOADING_MESSAGES[loadingMsg] : ctaLabel}
                </button>
              </div>
              <p className={styles.inputReassurance}>
                Calm, specific steps. No judgment.
              </p>
            </div>

            {/* Loading orb */}
            {(loading || refining) && (
              <div className={styles.loadingState}>
                <div className={styles.loadingOrb} />
                <p className={styles.loadingText}>
                  {refining ? REFINE_MESSAGES[loadingMsg] : LOADING_MESSAGES[loadingMsg]}
                </p>
                <p className={styles.loadingSub}>Just a few seconds.</p>
              </div>
            )}

            {/* Error */}
            {error && !loading && !refining && (
              <div className={styles.errorCard}>
                <h3>Something went wrong</h3>
                <p>{error}</p>
              </div>
            )}

            {/* Limit reached */}
            {limitReached && !loading && (
              <div className={styles.limitReached}>
                <p className={styles.limitReachedLabel}>Daily limit reached</p>
                <p className={styles.limitReachedText}>
                  You&apos;ve used your 3 free translations for today.
                  Want help finishing too? Upgrade for more support and more body doubling.
                </p>
                <Link href={isSignedIn ? '/billing' : '/auth'} className={styles.upgradeBtnPrimary}>
                  {isSignedIn ? 'Start Finishing Tasks' : 'Create account'}
                </Link>
              </div>
            )}

            {/* Result card */}
            {result && !startMode && (
              <div className={styles.resultCard}>
                <div className={styles.startHereSection}>
                  <div className={styles.startHereLabel}>Start Here</div>
                  <div className={styles.startHereRow}>
                    <div className={styles.startHereText}>{result.startHere}</div>
                    <button
                      className={styles.audioBtn}
                      onClick={() => speakText('Start here. ' + result.startHere)}
                    >🔊</button>
                  </div>
                  {result.startTime && (
                    <div className={styles.timeBadge}>~{result.startTime} to begin</div>
                  )}
                </div>

                <div className={styles.stepsSection}>
                  <div className={styles.stepsLabel}>Detailed Steps</div>
                  <ol className={styles.stepsList}>
                    {result.steps.map((step, i) => (
                      <StepItem
                        key={i}
                        index={i}
                        step={step}
                        task={task}
                        userEmail={userEmail}
                        onLimitReached={() => setLimitReached(true)}
                      />
                    ))}
                  </ol>
                </div>

                {!isPaid && (
                  <div className={styles.resultUpsell}>
                    <p className={styles.resultUpsellTitle}>You have a plan. Now make it easier to finish.</p>
                    <p className={styles.resultUpsellText}>
                      This is where most people lose momentum. Upgrade for more support, more body doubling, and less starting over.
                    </p>
                    <p className={styles.resultUpsellNote}>Best if you want help more than once today.</p>
                    <Link href={isSignedIn ? '/billing' : '/auth'} className={styles.resultUpsellLink}>
                      Keep Going With Support
                    </Link>
                  </div>
                )}

                {/* Follow-up refinement */}
                {result.followUpQuestion && !refined && (
                  <div className={styles.followUpSection}>
                    {!showFollowUp ? (
                      <button className={styles.followUpToggle} onClick={() => setShowFollowUp(true)}>
                        Make these steps more specific →
                      </button>
                    ) : (
                      <>
                        <p className={styles.followUpQuestion}>{result.followUpQuestion}</p>
                        <textarea
                          className={styles.followUpTextarea}
                          placeholder="Your answer…"
                          value={followUpAnswer}
                          onChange={(e) => setFollowUpAnswer(e.target.value)}
                          rows={2}
                        />
                        <div className={styles.followUpActions}>
                          <button
                            className={styles.skipBtn}
                            onClick={() => { setShowFollowUp(false); setFollowUpAnswer('') }}
                          >
                            Skip
                          </button>
                          <button
                            className={styles.refineBtn}
                            onClick={handleRefine}
                            disabled={!followUpAnswer.trim() || refining}
                          >
                            {refining ? REFINE_MESSAGES[loadingMsg] : 'Refine steps →'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {refined && (
                  <div className={styles.refinedNote}>Steps refined based on your context.</div>
                )}
              </div>
            )}

          </>
        )}

      </div>
    </div>
  )
}


