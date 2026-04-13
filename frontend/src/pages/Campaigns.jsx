import { useState, useEffect } from 'react'
import { Megaphone, Plus, X } from 'lucide-react'
import { getCampaigns, createCampaign, getTags } from '../api'

function segmentCount(text) {
  const len = text.length
  if (len <= 160) return 1
  return Math.ceil(len / 153)
}

export default function Campaigns({ provider }) {
  const [campaigns, setCampaigns] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [tags, setTags] = useState([])
  const [form, setForm] = useState({ name: '', message_template: '', tags: [] })

  useEffect(() => {
    loadCampaigns()
    getTags().then(setTags)
  }, [])

  const loadCampaigns = async () => {
    const data = await getCampaigns()
    setCampaigns(data)
  }

  const handleCreate = async () => {
    await createCampaign({
      name: form.name,
      message_template: form.message_template,
      tags: form.tags,
      provider,
    })
    setShowModal(false)
    setForm({ name: '', message_template: '', tags: [] })
    loadCampaigns()
  }

  const toggleTag = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
    }))
  }

  const previewText = form.message_template
    .replace('{name}', 'John')
    .replace('{business}', 'Acme Inc')
    + '\nReply STOP to opt out'

  const statusColor = (s) => {
    switch (s) {
      case 'draft': return 'var(--text-muted)'
      case 'sending': return 'var(--warning)'
      case 'completed': return 'var(--success)'
      case 'failed': return 'var(--error)'
      default: return 'var(--text-muted)'
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Campaigns</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Campaign
        </button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Tags</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Delivered</th>
              <th>Failed</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No campaigns yet</td></tr>
            )}
            {campaigns.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>
                  <span className={`provider-dot ${c.provider}`} style={{ marginRight: 6 }} />
                  {c.provider}
                </td>
                <td>{c.tags.length ? c.tags.map(t => <span key={t} className="tag">{t}</span>) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>All contacts</span>}</td>
                <td><span style={{ color: statusColor(c.status), fontWeight: 600, fontSize: 13 }}>{c.status}</span></td>
                <td>{c.sent_count}</td>
                <td>{c.delivered_count}</td>
                <td>{c.failed_count}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Create Campaign</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label>Campaign Name</label>
              <input className="input" placeholder="April Promo" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Target Tags (leave empty for all contacts)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {tags.map(tag => (
                  <button
                    key={tag}
                    className={`tag`}
                    style={{
                      cursor: 'pointer',
                      background: form.tags.includes(tag) ? 'var(--medium-purple)' : 'rgba(155,127,191,0.2)',
                      color: form.tags.includes(tag) ? 'white' : 'var(--light-purple)',
                      border: 'none',
                      padding: '4px 10px',
                      fontSize: 13,
                    }}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
                {tags.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tags — add tags to contacts first</span>}
              </div>
            </div>
            <div className="form-group">
              <label>Message Template</label>
              <textarea
                className="input"
                style={{ minHeight: 100 }}
                placeholder="Hi {name}, great news for {business}! ..."
                value={form.message_template}
                onChange={e => setForm({ ...form, message_template: e.target.value })}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Merge: {'{name}'}, {'{business}'}</span>
                <span>
                  {form.message_template.length} chars · {segmentCount(previewText)} segment{segmentCount(previewText) > 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="form-group">
              <label>Preview</label>
              <div style={{
                background: 'var(--bg-input)',
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
                border: '1px solid var(--border-color)',
              }}>
                {previewText || 'Type a message above...'}
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              "Reply STOP to opt out" will be auto-appended. Sending via <strong>{provider === 'twilio' ? 'Twilio' : 'SignalWire'}</strong>.
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!form.name || !form.message_template}>
                <Megaphone size={14} /> Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
