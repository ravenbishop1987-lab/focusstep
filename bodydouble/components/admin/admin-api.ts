/**
 * Admin API client — calls through the Next.js proxy at /api/translate/admin/*.
 * The proxy attaches the Supabase JWT automatically, so no manual auth needed here.
 */

const BASE = '/api/translate'
const LOCAL_ADMIN_BASE = '/api/admin'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function formatAdminError(payload: unknown, status: number) {
  if (isRecord(payload)) {
    const message = payload.error
    const requestId = payload.requestId

    if (typeof message === 'string' && message.trim()) {
      return typeof requestId === 'string' && requestId.trim()
        ? `${message} (request ID: ${requestId})`
        : message
    }
  }

  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'The admin service is temporarily unavailable.'
  return `Request failed with status ${status}.`
}

async function adminFetch(path: string, init: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, init)
  const contentType = r.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await r.json() : await r.text()

  if (!r.ok) {
    throw new Error(formatAdminError(payload, r.status))
  }

  return payload
}

async function localAdminFetch(path: string, init: RequestInit = {}) {
  const r = await fetch(`${LOCAL_ADMIN_BASE}${path}`, init)
  const contentType = r.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await r.json() : await r.text()

  if (!r.ok) {
    throw new Error(formatAdminError(payload, r.status))
  }

  return payload
}

export function fetchMetrics() {
  return adminFetch('/admin/metrics')
}

export function fetchRevenue() {
  return adminFetch('/admin/revenue')
}

export function fetchTranslatorAnalytics() {
  return adminFetch('/admin/translator-analytics')
}

export function fetchBodyDoubleAnalytics() {
  return localAdminFetch('/bodydouble-metrics')
}

export function fetchUsers() {
  return adminFetch('/admin/users')
}

export function updateUser(email: string, fields: Record<string, unknown>) {
  return adminFetch(`/admin/users/${encodeURIComponent(email)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
}

export function deleteUser(email: string) {
  return adminFetch(`/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' })
}

export function fetchUserDetail(email: string) {
  return adminFetch(`/admin/users/${encodeURIComponent(email)}/detail`)
}

export function fetchModeratedTaskShares() {
  return adminFetch('/admin/task-shares')
}

export function fetchUserReports() {
  return localAdminFetch('/user-reports')
}

export function resolveUserReport(id: string, status: 'reviewed' | 'dismissed', reviewNotes = '') {
  return localAdminFetch(`/user-reports/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, reviewNotes }),
  })
}

export function banUser(userId: string, reason: string, durationDays = 0) {
  return localAdminFetch(`/users/${encodeURIComponent(userId)}/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, durationDays }),
  })
}

export function unbanUser(userId: string) {
  return localAdminFetch(`/users/${encodeURIComponent(userId)}/unban`, {
    method: 'POST',
  })
}

export function blockTaskShare(shareCode: string) {
  return adminFetch(`/admin/task-shares/${encodeURIComponent(shareCode)}/block`, { method: 'POST' })
}

export function unblockTaskShare(shareCode: string) {
  return adminFetch(`/admin/task-shares/${encodeURIComponent(shareCode)}/unblock`, { method: 'POST' })
}

export function fetchAuditLog() {
  return adminFetch('/admin/audit-log')
}

export function fetchReferrals() {
  return adminFetch('/admin/referrals')
}

export function fetchReferralStats() {
  return adminFetch('/admin/referrals/stats')
}

export function actOnReferral(id: string, action: string) {
  return adminFetch(`/admin/referrals/${id}/${action}`, { method: 'POST' })
}

export function fetchReferralRewards() {
  return adminFetch('/admin/referral-rewards')
}

export function updateReferralReward(id: string, fields: Record<string, unknown>) {
  return adminFetch(`/admin/referral-rewards/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  })
}

export function issueReferralReward(id: string) {
  return adminFetch(`/admin/referral-rewards/${id}/issue`, { method: 'POST' })
}

export function reverseReferralReward(id: string) {
  return adminFetch(`/admin/referral-rewards/${id}/reverse`, { method: 'POST' })
}

export function fetchReferralRules() {
  return adminFetch('/admin/referral-rules')
}

export function fetchReferralProgramSettings() {
  return adminFetch('/admin/referral-program-settings')
}

export function saveReferralProgramSettings(data: Record<string, unknown>) {
  return adminFetch('/admin/referral-program-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function createReferralRule(data: Record<string, unknown>) {
  return adminFetch('/admin/referral-rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updateReferralRule(id: string, data: Record<string, unknown>) {
  return adminFetch(`/admin/referral-rules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function deleteReferralRule(id: string) {
  return adminFetch(`/admin/referral-rules/${id}`, { method: 'DELETE' })
}
