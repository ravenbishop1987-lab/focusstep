export const APP_NAME = 'FocusStep ADHD'

export const ADHD_TYPES = ['Inattentive', 'Hyperactive', 'Combined', 'Not sure'] as const

export const FOCUS_TYPES = [
  'Work/career',
  'Studying',
  'Creative',
  'Life admin',
  'Side projects',
] as const

export const AVAILABILITY_OPTIONS = [
  'Mornings',
  'Afternoons',
  'Evenings',
  'Late night',
] as const

export const QUICK_GOALS = [
  'Deep work sprint',
  'Admin cleanup',
  'Homework block',
  'Creative session',
  'Inbox zero',
] as const

export const LIVE_MATCH_DURATION_MINUTES = 25
export const DURATION_OPTIONS = [25] as const
export const FREE_DURATION_OPTIONS = [25] as const
export const PRO_DURATION_OPTIONS = [25] as const
export const LIFETIME_DURATION_OPTIONS = [25] as const

export const TIMEZONE_OPTIONS = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Australia/Sydney',
] as const

export const FREE_WEEKLY_SESSION_LIMIT = 3
export const PRO_MONTHLY_SESSION_LIMIT = 20
export const LIFETIME_MONTHLY_SESSION_LIMIT = 50

export function getPlanDurationOptions(plan: string | null | undefined) {
  if (plan === 'lifetime') return [...LIFETIME_DURATION_OPTIONS]
  if (plan === 'pro') return [...PRO_DURATION_OPTIONS]
  return [...FREE_DURATION_OPTIONS]
}
