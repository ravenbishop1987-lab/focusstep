import { useState, useEffect } from 'react';
import { authFetch } from '../lib/api';

const BASE = import.meta.env.VITE_API_URL || '';

const PLAN_LABELS    = { free: 'Free', monthly: 'Pro Monthly', lifetime: 'Lifetime', any: 'Any plan' };
const TRIGGER_LABELS = { monthly: 'Buys Pro Monthly', lifetime: 'Buys Lifetime', any: 'Buys any plan' };
const RECIPIENT_LABELS = { referrer: 'Referrer', referred: 'Referred user', both: 'Both' };
const TYPE_LABELS    = { pro_days: 'Pro days', none: 'No reward' };

const BLANK = { name: '', referrer_plan: 'free', trigger_plan: 'any', recipient: 'referrer', reward_type: 'pro_days', reward_value: 14, auto_issue: true, enabled: true };

export default function AdminReferralSettings() {
  const [rules, setRules]   = useState([]);
  const [programSettings, setProgramSettings] = useState({ programEnabled: true, maxRewardDays: 90 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal]   = useState(null); // null | 'new' | rule object
  const [form, setForm]     = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      authFetch(`${BASE}/admin/referral-rules`).then(r => r.json()),
      authFetch(`${BASE}/admin/referral-program-settings`).then(r => r.json()),
    ])
      .then(([ruleData, settingsData]) => {
        setRules(Array.isArray(ruleData) ? ruleData : []);
        if (settingsData && typeof settingsData === 'object') {
          setProgramSettings({
            programEnabled: settingsData.programEnabled !== false,
            maxRewardDays: settingsData.maxRewardDays ?? 90,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openNew  = () => { setForm(BLANK); setErr(null); setModal('new'); };
  const openEdit = (r) => { setForm({ ...r }); setErr(null); setModal(r); };

  const save = async () => {
    if (!form.name.trim()) return setErr('Name is required');
    setSaving(true); setErr(null);
    try {
      const isNew  = modal === 'new';
      const url    = isNew ? `${BASE}/admin/referral-rules` : `${BASE}/admin/referral-rules/${modal.id}`;
      const method = isNew ? 'POST' : 'PUT';
      const res    = await authFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setModal(null);
      load();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    await authFetch(`${BASE}/admin/referral-rules/${id}`, { method: 'DELETE' });
    load();
  };

  const toggle = async (rule) => {
    await authFetch(`${BASE}/admin/referral-rules/${rule.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !rule.enabled }) });
    load();
  };

  const saveProgramSettings = async () => {
    setSettingsSaving(true);
    try {
      await authFetch(`${BASE}/admin/referral-program-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programEnabled: !!programSettings.programEnabled,
          maxRewardDays: Math.max(0, parseInt(programSettings.maxRewardDays, 10) || 0),
        }),
      });
      load();
    } catch {
      // no-op
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div>
      <div className="a-card" style={{ marginBottom: 18 }}>
        <div className="a-section-header" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="a-section-title">Referral Controls</h2>
            <p className="a-section-sub">Pause the program instantly or cap how much free Pro time one person can earn.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(220px, 0.8fr)', gap: 16, alignItems: 'end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#334155' }}>
            <input
              type="checkbox"
              checked={programSettings.programEnabled}
              onChange={e => setProgramSettings((prev) => ({ ...prev, programEnabled: e.target.checked }))}
            />
            Referral program enabled
          </label>

          <Field label="Max reward days per person">
            <input
              className="a-input"
              type="number"
              min={0}
              max={365}
              value={programSettings.maxRewardDays}
              onChange={e => setProgramSettings((prev) => ({ ...prev, maxRewardDays: e.target.value }))}
            />
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

      {!loading && (
        <div className="a-card a-table-card">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>Rule name</th>
                  <th>Referrer plan</th>
                  <th>Trigger</th>
                  <th>Recipient</th>
                  <th>Reward</th>
                  <th>Auto-issue</th>
                  <th>Status</th>
                  <th>Actions</th>
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
                      {r.reward_type === 'none' ? <span className="a-badge a-badge-free">None</span>
                        : <span className="a-badge a-badge-pro">{r.reward_value} Pro days</span>}
                    </td>
                    <td>{r.auto_issue ? '✓ Yes' : '—'}</td>
                    <td>
                      <span className={`a-badge ${r.enabled ? 'a-badge-pro' : 'a-badge-free'}`}>
                        {r.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <div className="a-actions">
                        <button className="a-btn-action a-btn-edit" onClick={() => openEdit(r)}>Edit</button>
                        <button className="a-btn-action a-btn-reset" onClick={() => toggle(r)}>
                          {r.enabled ? 'Disable' : 'Enable'}
                        </button>
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
            <div className="a-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
  );
}

function Field({ label, children }) {
  return (
    <div className="a-field">
      <span>{label}</span>
      {children}
    </div>
  );
}
