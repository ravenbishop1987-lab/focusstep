import { authFetch } from '../lib/api';

const BASE = import.meta.env.VITE_API_URL || '';

export async function fetchMetrics() {
  const r = await authFetch(`${BASE}/admin/metrics`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchRevenue() {
  const r = await authFetch(`${BASE}/admin/revenue`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchTranslatorAnalytics() {
  const r = await authFetch(`${BASE}/admin/translator-analytics`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchUsers() {
  const r = await authFetch(`${BASE}/admin/users`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function updateUser(email, fields) {
  const r = await authFetch(`${BASE}/admin/users/${encodeURIComponent(email)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function deleteUser(email) {
  const r = await authFetch(`${BASE}/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchUserDetail(email) {
  const r = await authFetch(`${BASE}/admin/users/${encodeURIComponent(email)}/detail`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchModeratedTaskShares() {
  const r = await authFetch(`${BASE}/admin/task-shares`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function blockTaskShare(shareCode) {
  const r = await authFetch(`${BASE}/admin/task-shares/${encodeURIComponent(shareCode)}/block`, { method: 'POST' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function unblockTaskShare(shareCode) {
  const r = await authFetch(`${BASE}/admin/task-shares/${encodeURIComponent(shareCode)}/unblock`, { method: 'POST' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function fetchAuditLog() {
  const r = await authFetch(`${BASE}/admin/audit-log`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
