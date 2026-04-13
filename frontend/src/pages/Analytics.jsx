import { useState, useEffect, useCallback } from 'react'
import { BarChart3, RefreshCw, Download, Calendar, TrendingUp } from 'lucide-react'
import { getAnalytics, getAnalyticsTeam, exportAnalytics } from '../api'

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getPresetDates(preset) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'today':
      return { start_date: formatDate(today), end_date: formatDate(today) }
    case 'yesterday': {
      const yd = new Date(today)
      yd.setDate(yd.getDate() - 1)
      return { start_date: formatDate(yd), end_date: formatDate(yd) }
    }
    case '7days': {
      const d7 = new Date(today)
      d7.setDate(d7.getDate() - 7)
      return { start_date: formatDate(d7), end_date: formatDate(today) }
    }
    case '30days': {
      const d30 = new Date(today)
      d30.setDate(d30.getDate() - 30)
      return { start_date: formatDate(d30), end_date: formatDate(today) }
    }
    case 'all':
      return {}
    default:
      return {}
  }
}

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7days', label: 'Previous 7 Days' },
  { key: '30days', label: 'Previous 30 Days' },
  { key: 'all', label: 'All Time' },
]

export default function Analytics() {
  const [data, setData] = useState(null)
  const [teamData, setTeamData] = useState([])
  const [loading, setLoading] = useState(true)
  const [activePreset, setActivePreset] = useState('30days')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const loadData = useCallback(async (params) => {
    setLoading(true)
    try {
      const [analytics, team] = await Promise.all([
        getAnalytics(params),
        getAnalyticsTeam(params),
      ])
      setData(analytics)
      setTeamData(team || [])
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const params = getPresetDates(activePreset)
    loadData(params)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreset = (preset) => {
    setActivePreset(preset)
    setCustomStart('')
    setCustomEnd('')
    const params = getPresetDates(preset)
    loadData(params)
  }

  const handleCustomDate = (field, value) => {
    const nextStart = field === 'start' ? value : customStart
    const nextEnd = field === 'end' ? value : customEnd

    if (field === 'start') setCustomStart(value)
    if (field === 'end') setCustomEnd(value)

    setActivePreset('custom')

    if (nextStart) {
      loadData({
        start_date: nextStart,
        end_date: nextEnd || formatDate(new Date()),
      })
    }
  }

  const handleExport = async () => {
    try {
      await exportAnalytics()
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  if (loading && !data) {
    return (
      <div style={{ overflowY: 'auto', height: 'calc(100vh - 56px)', padding: 24 }}>
        <div className="empty-state">
          <BarChart3 size={48} />
          <p>Loading analytics...</p>
        </div>
      </div>
    )
  }

  const overview = data?.overview || {}
  const twilio = data?.twilio || {}
  const signalwire = data?.signalwire || {}
  const contacts = data?.contacts || {}

  return (
    <div style={{ overflowY: 'auto', height: 'calc(100vh - 56px)', padding: 24 }}>
      {/* Page Header */}
      <div className="page-header">
        <h1><BarChart3 size={22} style={{ marginRight: 8, verticalAlign: 'middle' }} />Analytics</h1>
        <button className="btn btn-primary" onClick={handleExport}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Date Range Picker */}
      <div className="card" style={{ marginBottom: 24, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <Calendar size={16} style={{ opacity: 0.6 }} />
          {PRESETS.map((p) => (
            <button
              key={p.key}
              className={`btn btn-sm ${activePreset === p.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handlePreset(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, opacity: 0.7 }}>Custom Range:</span>
          <input
            type="date"
            className="input"
            value={customStart}
            onChange={(e) => handleCustomDate('start', e.target.value)}
            style={{ width: 160 }}
          />
          <span style={{ opacity: 0.5 }}>to</span>
          <input
            type="date"
            className="input"
            value={customEnd}
            onChange={(e) => handleCustomDate('end', e.target.value)}
            style={{ width: 160 }}
          />
        </div>
      </div>

      {/* Overview Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Conversations</div>
          <div className="stat-value" style={{ fontSize: 32 }}>{overview.conversations ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Messages Sent</div>
          <div className="stat-value info">{overview.sent ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Messages Received</div>
          <div className="stat-value">{overview.received ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Engagement Rate</div>
          <div className="stat-value success">
            <TrendingUp size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {overview.engagement_rate ?? 0}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Campaigns Sent</div>
          <div className="stat-value">{overview.campaigns_sent ?? 0}</div>
        </div>
      </div>

      {/* Provider Breakdown */}
      <h2 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        Provider Breakdown
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Twilio Card */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dot twilio" /> Twilio
          </h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Sent</div>
              <div className="stat-value info">{twilio.sent ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Delivered</div>
              <div className="stat-value success">{twilio.delivered ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Failed</div>
              <div className="stat-value error">{twilio.failed ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Received</div>
              <div className="stat-value">{twilio.received ?? 0}</div>
            </div>
          </div>
        </div>

        {/* SignalWire Card */}
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="dot signalwire" /> SignalWire
          </h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Sent</div>
              <div className="stat-value info">{signalwire.sent ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Delivered</div>
              <div className="stat-value success">{signalwire.delivered ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Failed</div>
              <div className="stat-value error">{signalwire.failed ?? 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Received</div>
              <div className="stat-value">{signalwire.received ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contacts Summary */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Contacts</div>
          <div className="stat-value">{contacts.total ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Opted Out</div>
          <div className="stat-value error">{contacts.opted_out ?? 0}</div>
        </div>
      </div>

      {/* Team Member Performance */}
      <h2 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        Team Member Performance
      </h2>
      <div className="card table-wrap" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Sent</th>
              <th>Delivered</th>
              <th>Failed</th>
              <th>Received</th>
              <th>Delivered Rate</th>
              <th>Failed Rate</th>
            </tr>
          </thead>
          <tbody>
            {teamData.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', opacity: 0.5, padding: 24 }}>
                  No team data available
                </td>
              </tr>
            ) : (
              teamData.map((member, i) => (
                <tr key={i}>
                  <td><strong>{member.name}</strong></td>
                  <td>{member.role}</td>
                  <td>{member.sent}</td>
                  <td>{member.delivered}</td>
                  <td>{member.failed}</td>
                  <td>{member.received}</td>
                  <td>
                    <span style={{ color: (member.delivered_rate ?? 0) >= 90 ? 'var(--green)' : (member.delivered_rate ?? 0) >= 70 ? 'var(--yellow)' : 'var(--red)' }}>
                      {member.delivered_rate ?? 0}%
                    </span>
                  </td>
                  <td>
                    <span style={{ color: (member.failed_rate ?? 0) > 10 ? 'var(--red)' : (member.failed_rate ?? 0) > 5 ? 'var(--yellow)' : 'var(--green)' }}>
                      {member.failed_rate ?? 0}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Message Deliverability */}
      <h2 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        Message Deliverability
      </h2>
      <div className="card table-wrap" style={{ marginBottom: 24 }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Sent</th>
              <th>Delivered</th>
              <th>Delivered Rate</th>
              <th>Failed</th>
              <th>Failed Rate</th>
            </tr>
          </thead>
          <tbody>
            {teamData.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', opacity: 0.5, padding: 24 }}>
                  No deliverability data available
                </td>
              </tr>
            ) : (
              teamData.map((member, i) => (
                <tr key={i}>
                  <td><strong>{member.name}</strong></td>
                  <td>{member.role}</td>
                  <td>{member.sent}</td>
                  <td>{member.delivered}</td>
                  <td>
                    <span style={{ color: (member.delivered_rate ?? 0) >= 90 ? 'var(--green)' : (member.delivered_rate ?? 0) >= 70 ? 'var(--yellow)' : 'var(--red)', fontWeight: 600 }}>
                      {member.delivered_rate ?? 0}%
                    </span>
                  </td>
                  <td>{member.failed}</td>
                  <td>
                    <span style={{ color: (member.failed_rate ?? 0) > 10 ? 'var(--red)' : (member.failed_rate ?? 0) > 5 ? 'var(--yellow)' : 'var(--green)', fontWeight: 600 }}>
                      {member.failed_rate ?? 0}%
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
