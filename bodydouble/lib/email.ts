import { Resend } from 'resend'
import { APP_NAME } from '@/lib/constants'
import { formatDateTime, formatMinutes } from '@/lib/utils'

function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

function wrapEmail(title: string, body: string) {
  return `
    <style>
      :root {
        --bg: #f0ede6;
        --card: #ffffff;
        --ink: #2c2a22;
        --body: #5a5448;
        --muted: #7a7568;
        --bdc: #ddd8ce;
      }
    </style>
    <div style="font-family: system-ui, -apple-system, sans-serif; background: var(--bg); padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: var(--card); border: 1px solid var(--bdc); border-radius: 14px; padding: 24px; color: var(--body);">
        <h1 style="margin: 0 0 16px; font-family: Georgia, serif; color: var(--ink);">${title}</h1>
        <div>${body}</div>
        <p style="margin-top: 20px; color: var(--muted);">${APP_NAME}</p>
      </div>
    </div>
  `
}

export async function sendScheduledConfirmationEmail(input: {
  hostEmail: string
  hostName: string
  guestEmail: string
  guestName: string
  scheduledAt: string
  durationMinutes: number
  goal: string
}) {
  const resend = getResend()
  if (!resend) return

  const html = wrapEmail(
    'Your body double session is booked',
    `<p>${input.hostName} and ${input.guestName} are set for ${formatDateTime(input.scheduledAt)}.</p>
     <p>Focus block: ${formatMinutes(input.durationMinutes)}</p>
     <p>Goal: ${input.goal || 'Shared focus time'}</p>`
  )

  await resend.emails.send({
    from: 'Body Double <hello@bodydouble.app>',
    to: [input.hostEmail, input.guestEmail],
    subject: 'Your Body Double session is confirmed',
    html,
  })
}

export async function sendReminderEmail(to: string, scheduledAt: string, goal: string) {
  const resend = getResend()
  if (!resend) return

  await resend.emails.send({
    from: 'Body Double <hello@bodydouble.app>',
    to,
    subject: 'Your body double session starts in 15 minutes',
    html: wrapEmail(
      'A gentle reminder',
      `<p>Your session begins at ${formatDateTime(scheduledAt)}.</p><p>Goal: ${goal || 'Shared focus time'}</p>`
    ),
  })
}

export async function sendWeeklySummaryEmail(to: string, name: string, sessions: number, minutes: number, streak: number) {
  const resend = getResend()
  if (!resend) return

  await resend.emails.send({
    from: 'Body Double <hello@bodydouble.app>',
    to,
    subject: 'Your weekly focus summary',
    html: wrapEmail(
      'Your focus week',
      `<p>${name}, you completed ${sessions} sessions this week.</p>
       <p>Total focus time: ${formatMinutes(minutes)}</p>
       <p>Current streak: ${streak} days</p>`
    ),
  })
}

export async function sendUpgradePromptEmail(to: string, name: string) {
  const resend = getResend()
  if (!resend) return

  await resend.emails.send({
    from: 'Body Double <hello@bodydouble.app>',
    to,
    subject: 'You reached this week’s free focus limit',
    html: wrapEmail(
      'Keep the rhythm going',
      `<p>${name}, you’ve used your free sessions for this week.</p>
       <p>Upgrade to Pro for unlimited sessions, scheduling, priority matching, and weekly reports.</p>`
    ),
  })
}
