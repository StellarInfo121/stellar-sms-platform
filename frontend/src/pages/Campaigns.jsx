import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Megaphone, Plus, X, Play, RefreshCw, Calendar, Repeat, Send, ChevronRight } from 'lucide-react'
import { getCampaigns, createCampaign, sendCampaign, getCampaignProgress, getTags } from '../api'

function segmentCount(text) {
  const len = text.length
  if (len === 0) return 0
  if (len <= 160) return 1
  return Math.ceil(len / 153)
}

const STATUS_COLORS = {
  draft: 'gray',
  sending: 'yellow',
  completed: 'green',
  failed: 'red',
}

const SAMPLE_VALUES = {
  '{name}': 'John Smith',
  '{first_name}': 'John',
  '{last_name}': 'Smith',
  '{business}': 'Acme Inc',
}

function applyMerge(text) {
  let result = text
  for (const [key, val] of Object.entries(SAMPLE_VALUES)) {
    result = result.replaceAll(key, val)
  }
  return result
}

export default function Campaigns({ provider }) {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [tags, setTags] = useState([])
  const [form, setForm] = useState({
    name: '',
    message_template: '',
    tags: [],
    campaign_type: 'one_time',
    scheduled_at: '',
    frequency: 'daily',
  })
  const [progress, setProgress] = useState({})
  const pollingRef = useRef({})

  useEffect(() => {
    loadCampaigns()
    getTags().then(setTags)
  }, [])

  const loadCampaigns = async () => {
    const data = await getCampaigns()
    setCampaigns(data)
  }

  // Poll progress for sending campaigns
  const startPolling = useCallback((id) => {
    if (pollingRef.current[id]) return
    const interval = setInterval(async () => {
      try {
        const prog = await getCampaignProgress(id)
        setProgress(prev => ({ ...prev, [id]: prog }))
        if (prog.status !== 'sending') {
          clearInterval(pollingRef.current[id])
          delete pollingRef.current[id]
          loadCampaigns()
        }
      } catch {
        clearInterval(pollingRef.current[id])
        delete pollingRef.current[id]
      }
    }, 3000)
    pollingRef.current[id] = interval
  }, [])

  useEffect(() => {
    campaigns.forEach(c => {
      if (c.status === 'sending') startPolling(c.id)
    })
    return () => {
      Object.values(pollingRef.current).forEach(clearInterval)
      pollingRef.current = {}
    }
  }, [campaigns, startPolling])

  const handleCreate = async () => {
    const payload = {
      name: form.name,
      message_template: form.message_template,
      tags: form.tags,
      provider,
      campaign_type: form.campaign_type,
    }
    if (form.campaign_type === 'scheduled') {
      payload.scheduled_at = form.scheduled_at
    }
    if (form.campaign_type === 'recurring') {
      payload.frequency = form.frequency
    }
    await createCampaign(payload)
    setShowModal(false)
    setForm({ name: '', message_template: '', tags: [], campaign_type: 'one_time', scheduled_at: '', frequency: 'daily' })
    loadCampaigns()
  }

  const handleLaunch = async (id) => {
    await sendCampaign(id)
    loadCampaigns()
  }

  const toggleTag = (tag) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
    }))
  }

  const previewText = applyMerge(form.message_template) + (form.message_template ? '\nReply STOP to opt out' : '')
  const segments = segmentCount(form.message_template + (form.message_template ? '\nReply STOP to opt out' : ''))

  const statusBadgeStyle = (status) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background:
      status === 'draft' ? 'rgba(150,150,150,0.15)' :
      status === 'sending' ? 'rgba(234,179,8,0.15)' :
      status === 'completed' ? 'rgba(34,197,94,0.15)' :
      status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(150,150,150,0.15)',
    color:
      status === 'draft' ? 'var(--text-muted)' :
      status === 'sending' ? '#ca8a04' :
      status === 'completed' ? '#16a34a' :
      status === 'failed' ? '#dc2626' : 'var(--text-muted)',
  })

  return (
    <div className="page">
      <div className="page-header">
        <h1><Megaphone size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />Campaigns</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="empty-state">
          <Megaphone size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p>No campaigns yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Create your first campaign to send bulk messages</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {campaigns.map(c => {
            const prog = progress[c.id]
            const isSending = c.status === 'sending'
            const isCompleted = c.status === 'completed'

            return (
              <div
                key={c.id}
                className="card"
                style={{
                  padding: 16,
                  cursor: isCompleted ? 'pointer' : 'default',
                  transition: 'border-color 0.15s',
                }}
                onClick={() => isCompleted && navigate(`/campaigns/${c.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</span>
                      <span style={statusBadgeStyle(c.status)}>{c.status}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className={`dot ${c.provider}`} />
                        {c.provider === 'twilio' ? 'Twilio' : 'SignalWire'}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {c.tags && c.tags.length > 0
                          ? c.tags.map(t => <span key={t} className="tag" style={{ marginRight: 4 }}>{t}</span>)
                          : 'All contacts'}
                      </span>
                    </div>
                    <div className="stats-grid" style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>Sent: <strong style={{ color: 'var(--text-primary)' }}>{c.sent_count || 0}</strong></span>
                      <span>Delivered: <strong style={{ color: 'var(--success, #16a34a)' }}>{c.delivered_count || 0}</strong></span>
                      <span>Failed: <strong style={{ color: 'var(--error, #dc2626)' }}>{c.failed_count || 0}</strong></span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                    {c.status === 'draft' && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={(e) => { e.stopPropagation(); handleLaunch(c.id) }}
                      >
                        <Play size={12} /> Launch Blast
                      </button>
                    )}
                    {isCompleted && <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {isSending && (
                  <div style={{ marginTop: 12 }}>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: prog
                            ? `${Math.round((prog.sent / prog.total) * 100)}%`
                            : '10%',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      <span>
                        <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite', marginRight: 4 }} />
                        Sending...
                      </span>
                      {prog && <span>{prog.sent}/{prog.total} sent</span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>Create Campaign</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>

            <div className="form-group">
              <label>Campaign Name</label>
              <input
                className="input"
                placeholder="April Promo Blast"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Campaign Type</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'one_time', label: 'One-Time', icon: <Send size={13} /> },
                  { value: 'scheduled', label: 'Scheduled', icon: <Calendar size={13} /> },
                  { value: 'recurring', label: 'Recurring', icon: <Repeat size={13} /> },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`btn ${form.campaign_type === opt.value ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    onClick={() => setForm({ ...form, campaign_type: opt.value })}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.campaign_type === 'scheduled' && (
              <div className="form-group">
                <label>Scheduled Date & Time</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
                />
              </div>
            )}

            {form.campaign_type === 'recurring' && (
              <div className="form-group">
                <label>Frequency</label>
                <select
                  className="input"
                  value={form.frequency}
                  onChange={e => setForm({ ...form, frequency: e.target.value })}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Target Tags <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(leave empty for all contacts)</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {tags.map(tag => (
                  <button
                    key={tag}
                    className="tag"
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
                {tags.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No tags -- add tags to contacts first</span>
                )}
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
                <span>Merge: {'{name}'}, {'{first_name}'}, {'{last_name}'}, {'{business}'}</span>
                <span>
                  {form.message_template.length} chars &middot; {segments} segment{segments !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {form.message_template && (
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
                  {previewText}
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Sending via <strong>{provider === 'twilio' ? 'Twilio' : 'SignalWire'}</strong>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!form.name || !form.message_template || (form.campaign_type === 'scheduled' && !form.scheduled_at)}
              >
                <Megaphone size={14} /> Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
