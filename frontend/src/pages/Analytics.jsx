import { useState, useEffect } from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import { getAnalytics } from '../api'

export default function Analytics() {
  const [data, setData] = useState(null)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    const d = await getAnalytics()
    setData(d)
  }

  if (!data) {
    return (
      <div className="page">
        <div className="empty-state">
          <BarChart3 size={48} />
          <p>Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Analytics</h1>
        <button className="btn btn-secondary" onClick={loadAnalytics}><RefreshCw size={14} /> Refresh</button>
      </div>

      {/* Twilio Stats */}
      <h2 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="provider-dot twilio" /> Twilio
      </h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Sent</div>
          <div className="stat-value info">{data.twilio.sent}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Delivered</div>
          <div className="stat-value success">{data.twilio.delivered}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed</div>
          <div className="stat-value error">{data.twilio.failed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Received</div>
          <div className="stat-value">{data.twilio.received}</div>
        </div>
      </div>

      {/* SignalWire Stats */}
      <h2 style={{ fontSize: 16, marginBottom: 12, marginTop: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="provider-dot signalwire" /> SignalWire
      </h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Sent</div>
          <div className="stat-value info">{data.signalwire.sent}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Delivered</div>
          <div className="stat-value success">{data.signalwire.delivered}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed</div>
          <div className="stat-value error">{data.signalwire.failed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Received</div>
          <div className="stat-value">{data.signalwire.received}</div>
        </div>
      </div>

      {/* Blast Stats */}
      <h2 style={{ fontSize: 16, marginBottom: 12, marginTop: 24 }}>Blast Engine</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Queued</div>
          <div className="stat-value warning">{data.blasts.queued}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sent</div>
          <div className="stat-value info">{data.blasts.sent}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Delivered</div>
          <div className="stat-value success">{data.blasts.delivered}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed</div>
          <div className="stat-value error">{data.blasts.failed}</div>
        </div>
      </div>

      {/* Contacts Stats */}
      <h2 style={{ fontSize: 16, marginBottom: 12, marginTop: 24 }}>Contacts</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Contacts</div>
          <div className="stat-value">{data.contacts.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Opted Out</div>
          <div className="stat-value error">{data.contacts.opted_out}</div>
        </div>
      </div>
    </div>
  )
}
