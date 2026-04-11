'use client'

import { useState, useEffect } from 'react'
import {
  fetchReferralRules, fetchReferralProgramSettings,
  saveReferralProgramSettings, createReferralRule, updateReferralRule, deleteReferralRule,
} from './admin-api'

const PLAN_LABELS: Record<string, string> = { free: 'Free', monthly: 'Pro Monthly', lifetime: 'Lifetime', any: 'Any plan' }
const TRIGGER_LABELS: Record<string, string> = { monthly: 'Buys Pro Monthly', lifetime: 'Buys Lifetime', any: 'Buys any plan' }
const RECIPIENT_LABELS: Record<string, string> = { referrer: 'Referrer', referred: 'Referred user', both: 'Both' }

type Rule = {
  id: string
  name: string
  referrer_plan: string
  trigger_plan: string
  recipient: string
  reward_type: string
  reward_value: number
  auto_issue: boolean
  enabled: boolean
}

const BLANK: Omit<Rule, 'id'> = {
  name: '', referrer_plan: 'free', trigger_plan: 'any',
  recipient: 'referrer', reward_type: 'pro_days', reward_value: 14, auto_issue: true, enabled: true,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="a-field">
      <span>{label}</span>
      {children}
    </div>
  )
}

export default function AdminReferralSettings() {
  const [rules, setRules] = useState<Rule[]>([])
  const [programSettings, setProgramSettings] = useState({ programEnabled: true, maxRewardDays: 90 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [settingsLoadError, setSettingsLoadError] = useState<string | null>(null)
  const [modal, setModal] = useState<'new' | Rule | null>(null)
  const [form, setForm] = useState<Omit<Rule, 'id'>>(BLANK)
  const [saving, setSaving] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.allSettled([fetchReferralRules(), fetchReferralProgramSettings()])
      .then(([rulesResult, settingsResult]) => {
        if (rulesResult.status === 'fulfilled') {
          setRules(Array.isArray(rulesResult.value) ? rulesResult.value : [])
          setLoadError(null)
        } else {
          setRules([])
          setLoadError(rulesResult.reason instanceof Error ? rulesResult.reason.message : 'Failed to load reward rules.')
        }

        if (settingsResult.status === 'fulfilled') {
          const settingsData = settingsResult.value
          setProgramSettings({
            programEnabled: (settingsData as Record<string, unknown>).programEnabled !== false,
            maxRewardDays: (settingsData as Record<string, unknown>).maxRewardDays as number ?? 90,
          })
          setSettingsLoadError(null)
        } else {
          setSettingsLoadError(settingsResult.reason instanceof Error ? settingsResult.reason.message : 'Failed to load referral controls.')
        }
      })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const openNew = () => { setForm(BLANK); setErr(null); setModal('new') }
  const openEdit = (r: Rule) => { setForm({ ...r }); setErr(null); setModal(r) }

  const save = async () => {
    if (!form.name.trim()) return setErr('Name is required')
    setSaving(true); setErr(null)
    try {
      if (modal === 'new') {
        await createReferralRule(form as Record<string, unknown>)
      } else {
        await updateReferralRule((modal as Rule).id, form as Record<string, unknown>)
      }
      setModal(null)
      load()
    } catch (e) { setErr((e as Error).message) }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!window.confirm('Delete this rule?')) return
    await deleteReferralRule(id)
    load()
  }

  const toggle = async (rule: Rule) => {
    await updateReferralRule(rule.id, { enabled: !rule.enabled })
    load()
  }

  const saveProgramSettings = async () => {
    setSettingsSaving(true)
    try {
      await saveReferralProgramSettings({
        programEnabled: !!programSettings.programEnabled,
        maxRewardDays: Math.max(0, parseInt(String(programSettings.maxRewardDays), 10) || 0),
      })
      load()
    } catch {}
    setSettingsSaving(false)
  }

  return (
    <div>
      {settingsLoadError && (
        <div className="a-error" style={{ marginBottom: 18 }}>
          Referral controls unavailable: {settingsLoadError}
        </div>
      )}

      <div className="a-card" style={{ marginBottom: 18 }}>
        <div className="a-section-header" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="a-section-title">Referral Controls</h2>
            <p className="a-section-sub">Pause the program or cap how much free Pro time one person can earn.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(220px, 0.8fr)', gap: 16, alignItems: 'end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
            <input type="checkbox" checked={programSettings.programEnabled}
              onChange={e => setProgramSettings(p => ({ ...p, programEnabled: e.target.checked }))} />
            Referral program enabled
          </label>
          <Field label="Max reward days per person">
            <input className="a-input" type="number" min={0} max={365}
              value={programSettings.maxRewardDays}
              onChange={e => setProgramSettings(p => ({ ...p, maxRewardDays: parseInt(e.target.value) || 0 }))} />
          </Field>
        </div>
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`a-badge ${programSettings.programEnabled ? 'a-badge-pro' : 'a-badge-free'}`}>
            {programSettings.programEnabled ? 'Rewards live' : 'Referral program paused'}
          </span>
          <button className="a-btn-primary" onClick={saveProgramSettings} disabled={settingsSaving}>
            {settingsSaving ? 'Saving…' : 'Save Referral Controls'}
          </button>
        </div>
      </div>

      <div className="a-section-header">
        <div>
          <h2 className="a-section-title">Reward Rules</h2>
          <p className="a-section-sub">Define when and what reward is issued per referrer type.</p>
        </div>
        <button className="a-btn-primary" onClick={openNew}>+ Add Rule</button>
      </div>

      {loading && <div className="a-loading">Loading rules…</div>}

      {!loading && loadError && <div className="a-error">Failed to load rules: {loadError}</div>}

      {!loading && !loadError && (
        <div className="a-card a-table-card">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Rule name</th><th>Referrer plan</th><th>Trigger</th><th>Recipient</th>
                  <th>Reward</th><th>Auto-issue</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 && <tr><td colSpan={8} className="a-table-empty">No rules yet.</td></tr>}
                {rules.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, color: '#1e293b' }}>{r.name}</td>
                    <td>{PLAN_LABELS[r.referrer_plan] || r.referrer_plan}</td>
                    <td>{TRIGGER_LABELS[r.trigger_plan] || r.trigger_plan}</td>
                    <td>{RECIPIENT_LABELS[r.recipient] || r.recipient}</td>
                    <td>
                      {r.reward_type === 'none'
                        ? <span className="a-badge a-badge-free">None</span>
                        : <span className="a-badge a-badge-pro">{r.reward_value} Pro days</span>}
                    </td>
                    <td>{r.auto_issue ? '✓ Yes' : '—'}</td>
                    <td><span className={`a-badge ${r.enabled ? 'a-badge-pro' : 'a-badge-free'}`}>{r.enabled ? 'Active' : 'Disabled'}</span></td>
                    <td>
                      <div className="a-actions">
                        <button className="a-btn-action a-btn-edit" onClick={() => openEdit(r)}>Edit</button>
                        <button className="a-btn-action a-btn-reset" onClick={() => toggle(r)}>{r.enabled ? 'Disable' : 'Enable'}</button>
                        <button className="a-btn-action a-btn-delete" onClick={() => del(r.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && (
        <div className="a-modal-overlay" onClick={() => setModal(null)}>
          <div className="a-modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="a-modal-header">
              <h3>{modal === 'new' ? 'New Rule' : 'Edit Rule'}</h3>
              <button className="a-modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="a-modal-body">
              <Field label="Rule name">
                <input className="a-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Free referrer → Pro monthly" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Referrer plan">
                  <select className="a-input" value={form.referrer_plan} onChange={e => setForm(f => ({ ...f, referrer_plan: e.target.value }))}>
                    <option value="free">Free</option>
                    <option value="monthly">Pro Monthly</option>
                    <option value="lifetime">Lifetime</option>
                    <option value="any">Any</option>
                  </select>
                </Field>
                <Field label="Trigger (referred buys)">
                  <select className="a-input" value={form.trigger_plan} onChange={e => setForm(f => ({ ...f, trigger_plan: e.target.value }))}>
                    <option value="monthly">Pro Monthly</option>
                    <option value="lifetime">Lifetime</option>
                    <option value="any">Any paid plan</option>
                  </select>
                </Field>
              </div>
              <Field label="Reward recipient">
                <select className="a-input" value={form.recipient} onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))}>
                  <option value="referrer">Referrer</option>
                  <option value="referred">Referred user</option>
                  <option value="both">Both</option>
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Reward type">
                  <select className="a-input" value={form.reward_type} onChange={e => setForm(f => ({ ...f, reward_type: e.target.value }))}>
                    <option value="pro_days">Pro days</option>
                    <option value="none">No reward</option>
                  </select>
                </Field>
                <Field label="Value (days)">
                  <input className="a-input" type="number" min={0} max={365} value={form.reward_value}
                    disabled={form.reward_type === 'none'}
                    onChange={e => setForm(f => ({ ...f, reward_value: parseInt(e.target.value) || 0 }))} />
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.auto_issue} onChange={e => setForm(f => ({ ...f, auto_issue: e.target.checked }))} />
                  Auto-issue on payment
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} />
                  Rule enabled
                </label>
              </div>
              {err && <div className="a-error">{err}</div>}
            </div>
            <div className="a-modal-footer">
              <button className="a-btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="a-btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : modal === 'new' ? 'Create Rule' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
