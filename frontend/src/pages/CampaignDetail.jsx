import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { getCampaign, getCampaignMessages, exportCampaign } from '../api'

const STATUS_BADGE = {
  draft: { bg: '#F0F0F0', color: 'var(--text-muted)' },
  sending: { bg: '#FEF9E7', color: '#ca8a04' },
  completed: { bg: '#E8F8EE', color: '#16a34a' },
  failed: { bg: '#FDE8E8', color: '#dc2626' },
}

const MSG_STATUS_BADGE = {
  sent: { bg: '#EBF2FE', color: '#2563eb' },
  delivered: { bg: '#E8F8EE', color: '#16a34a' },
  failed: { bg: '#FDE8E8', color: '#dc2626' },
  replied: { bg: '#F5F0FA', color: 'var(--medium-purple, #9b7fbf)' },
  pending: { bg: '#F0F0F0', color: 'var(--text-muted)' },
}

function highlightMergeVars(text) {
  const parts = text.split(/(\{[a-z_]+\})/g)
  return parts.map((part, i) =>
    /^\{[a-z_]+\}$/.test(part)
      ? <span key={i} style={{ color: 'var(--medium-purple, #9b7fbf)', fontWeight: 600 }}>{part}</span>
      : part
  )
}

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [campaign, setCampaign] = useState(null)
  const [messages, setMessages] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState(null)
  const perPage = 30

  const loadCampaign = useCallback(async () => {
    const data = await getCampaign(id)
    setCampaign(data)
  }, [id])

  const loadMessages = useCallback(async () => {
    const params = { page, per_page: perPage }
    if (statusFilter) params.status = statusFilter
    const data = await getCampaignMessages(id, params)
    setMessages(data.messages)
    setTotal(data.total)
  }, [id, page, statusFilter])

  useEffect(() => { loadCampaign() }, [loadCampaign])
  useEffect(() => { loadMessages() }, [loadMessages])

  useEffect(() => { setPage(1) }, [statusFilter])

  if (!campaign) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading...</span>
      </div>
    )
  }

  const badge = STATUS_BADGE[campaign.status] || STATUS_BADGE.draft
  const totalPages = Math.ceil(total / perPage)
  const startItem = (page - 1) * perPage + 1
  const endItem = Math.min(page * perPage, total)

  const stats = [
    { key: null, label: 'Total', value: campaign.total_messages || 0 },
    { key: 'sent', label: 'Sent', value: campaign.sent_count || 0 },
    { key: 'delivered', label: 'Delivered', value: campaign.delivered_count || 0 },
    { key: 'replied', label: 'Replied', value: campaign.replied_count || 0 },
    { key: 'failed', label: 'Failed', value: campaign.failed_count || 0 },
  ]

  return (
    <div className="page">
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => navigate('/campaigns')}
        style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <ArrowLeft size={14} /> Campaigns
      </button>

      <div className="page-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0 }}>{campaign.name}</h1>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span className={`dot ${campaign.provider}`} />
            {campaign.provider === 'twilio' ? 'Twilio' : 'SignalWire'}
          </span>
          <span style={{
            padding: '3px 10px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 600,
            background: badge.bg,
            color: badge.color,
          }}>
            {campaign.status}
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em' }}>
          Message Template
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {highlightMergeVars(campaign.message_template || '')}
        </div>
        {campaign.tags && campaign.tags.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {campaign.tags.map(t => <span key={t} className="tag">{t}</span>)}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
        {/* LEFT: Stats sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Filter size={11} /> Filter by Status
          </div>
          {stats.map(s => {
            const isActive = statusFilter === s.key
            return (
              <div
                key={s.label}
                className="stat-card"
                onClick={() => setStatusFilter(isActive ? null : s.key)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: isActive ? 'var(--medium-purple, #9b7fbf)' : '#FFFFFF',
                  color: isActive ? 'white' : 'var(--text-primary)',
                  border: isActive ? '1px solid var(--medium-purple, #9b7fbf)' : '1px solid var(--border-color)',
                  transition: 'all 0.15s ease',
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{s.label}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{s.value}</span>
              </div>
            )
          })}
        </div>

        {/* RIGHT: Messages table */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {total > 0 ? `${startItem}-${endItem} of ${total}` : 'No messages'}
              {statusFilter && <span style={{ marginLeft: 6 }}>(filtered: {statusFilter})</span>}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => exportCampaign(id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Download size={13} /> Export Data
            </button>
          </div>

          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Number</th>
                  <th>Sent At</th>
                  <th>Status</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {messages.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      {statusFilter ? `No ${statusFilter} messages` : 'No messages yet'}
                    </td>
                  </tr>
                )}
                {messages.map((m, i) => {
                  const mBadge = MSG_STATUS_BADGE[m.status] || MSG_STATUS_BADGE.pending
                  return (
                    <tr key={m.id || i}>
                      <td style={{ fontWeight: 500 }}>{m.contact_name || m.name || '--'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{m.phone || m.to_number || '--'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {m.sent_at ? new Date(m.sent_at).toLocaleString() : '--'}
                      </td>
                      <td>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 11,
                          fontWeight: 600,
                          background: mBadge.bg,
                          color: mBadge.color,
                        }}>
                          {m.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--error, #dc2626)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.error_message || ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
