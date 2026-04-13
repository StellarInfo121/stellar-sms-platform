import { useState, useEffect, useRef } from 'react'
import { Rocket, Play, RefreshCw } from 'lucide-react'
import { getCampaigns, sendCampaign, getCampaignProgress } from '../api'

export default function Blasts({ provider }) {
  const [campaigns, setCampaigns] = useState([])
  const [polling, setPolling] = useState({})
  const intervals = useRef({})

  useEffect(() => {
    loadCampaigns()
    return () => Object.values(intervals.current).forEach(clearInterval)
  }, [])

  const loadCampaigns = async () => {
    const data = await getCampaigns()
    setCampaigns(data)
    // Resume polling for any campaign that is sending
    data.filter(c => c.status === 'sending').forEach(c => startPolling(c.id))
  }

  const startPolling = (id) => {
    if (intervals.current[id]) return
    intervals.current[id] = setInterval(async () => {
      const prog = await getCampaignProgress(id)
      setPolling(prev => ({ ...prev, [id]: prog }))
      if (prog.status !== 'sending') {
        clearInterval(intervals.current[id])
        delete intervals.current[id]
        loadCampaigns()
      }
    }, 3000)
  }

  const handleSend = async (id) => {
    await sendCampaign(id)
    startPolling(id)
    loadCampaigns()
  }

  const getProgress = (c) => {
    const p = polling[c.id] || c
    const total = p.total_messages || p.total || 0
    const sent = p.sent_count ?? p.sent ?? 0
    const pct = total > 0 ? Math.round((sent / total) * 100) : 0
    return { ...p, total, sent, pct, delivered: p.delivered_count ?? p.delivered ?? 0, failed: p.failed_count ?? p.failed ?? 0 }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Blast Engine</h1>
        <button className="btn btn-secondary" onClick={loadCampaigns}><RefreshCw size={14} /> Refresh</button>
      </div>

      {campaigns.length === 0 && (
        <div className="empty-state">
          <Rocket size={48} />
          <p>Create a campaign first, then send it as a blast</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {campaigns.map(c => {
          const p = getProgress(c)
          const isSending = c.status === 'sending' || polling[c.id]?.status === 'sending'

          return (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{c.name}</h3>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12 }}>
                    <span><span className={`provider-dot ${c.provider}`} /> {c.provider}</span>
                    <span>{c.tags?.length ? `Tags: ${c.tags.join(', ')}` : 'All contacts'}</span>
                    <span>{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {c.status === 'draft' && (
                  <button className="btn btn-primary" onClick={() => handleSend(c.id)}>
                    <Play size={14} /> Launch Blast
                  </button>
                )}
                {isSending && (
                  <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={14} className="spin" /> Sending...
                  </span>
                )}
                {c.status === 'completed' && !isSending && (
                  <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 14 }}>Completed</span>
                )}
              </div>

              {(c.status !== 'draft' || isSending) && (
                <>
                  <div className="progress-bar-track" style={{ marginBottom: 8 }}>
                    <div className="progress-bar-fill" style={{ width: `${p.pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                    <span>{p.pct}% — {p.sent} / {p.total} sent</span>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ color: 'var(--success)' }}>Delivered: {p.delivered}</span>
                      <span style={{ color: 'var(--error)' }}>Failed: {p.failed}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
