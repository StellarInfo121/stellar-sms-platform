import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageSquare, Send, Plus, X, Star, Search, User,
  Filter, Check, Clock, Archive, StickyNote, Smile, Variable, FileText
} from 'lucide-react'
import {
  getConversations, getMessages, sendSMS, addNote,
  assignConversation, starConversation, setConversationStatus,
  getTeamMembers, getTemplates
} from '../api'

function segmentInfo(text) {
  const len = text.length
  if (len <= 160) {
    return { chars: len, limit: 160, segments: len === 0 ? 0 : 1 }
  }
  const segments = Math.ceil(len / 153)
  return { chars: len, limit: segments * 153, segments }
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const EMOJI_LIST = ['👍', '👋', '😊', '🎉', '✅', '❤️', '🙏', '😂', '🔥', '💯']
const MERGE_VARS = ['{name}', '{business}', '{phone}', '{date}']

export default function Inbox({ provider }) {
  const [conversations, setConversations] = useState([])
  const [activeConvo, setActiveConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [filter, setFilter] = useState('open')
  const [searchQuery, setSearchQuery] = useState('')
  const [newMsg, setNewMsg] = useState('')
  const [noteText, setNoteText] = useState('')
  const [composeTab, setComposeTab] = useState('message')
  const [showCompose, setShowCompose] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [teamMembers, setTeamMembers] = useState([])
  const [templates, setTemplates] = useState([])
  const [showAssignDropdown, setShowAssignDropdown] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showMergeVars, setShowMergeVars] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const bottomRef = useRef(null)
  const msgInputRef = useRef(null)
  const currentUser = 'Me'

  // Load team members and templates once
  useEffect(() => {
    getTeamMembers().then(setTeamMembers).catch(() => {})
    getTemplates().then(data => setTemplates(Array.isArray(data) ? data : data.templates || [])).catch(() => {})
  }, [])

  // Poll conversations
  const loadConversations = useCallback(async () => {
    try {
      const params = {}
      if (filter === 'open') params.filter = 'open'
      else if (filter === 'closed') params.filter = 'closed'
      else if (filter === 'starred') params.filter = 'starred'
      else if (filter === 'mine') params.assigned_to = currentUser
      const data = await getConversations(params)
      setConversations(Array.isArray(data) ? data : [])
    } catch { /* silent */ }
  }, [filter])

  useEffect(() => {
    loadConversations()
    const interval = setInterval(loadConversations, 5000)
    return () => clearInterval(interval)
  }, [loadConversations])

  // Poll messages
  useEffect(() => {
    if (!activeConvo) return
    const load = async () => {
      try {
        const data = await getMessages(activeConvo.id)
        setMessages(Array.isArray(data) ? data : [])
      } catch { /* silent */ }
    }
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [activeConvo?.id])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Refresh active convo data from conversation list
  useEffect(() => {
    if (activeConvo) {
      const updated = conversations.find(c => c.id === activeConvo.id)
      if (updated) setActiveConvo(updated)
    }
  }, [conversations])

  const handleSend = async () => {
    if (!newMsg.trim() || !activeConvo) return
    await sendSMS({ to: activeConvo.phone, body: newMsg, provider })
    setNewMsg('')
    const data = await getMessages(activeConvo.id)
    setMessages(Array.isArray(data) ? data : [])
    loadConversations()
  }

  const handleAddNote = async () => {
    if (!noteText.trim() || !activeConvo) return
    await addNote(activeConvo.id, { body: noteText, sender_name: currentUser })
    setNoteText('')
    const data = await getMessages(activeConvo.id)
    setMessages(Array.isArray(data) ? data : [])
  }

  const handleCompose = async () => {
    if (!composeTo.trim() || !composeBody.trim()) return
    await sendSMS({ to: composeTo, body: composeBody, provider })
    setShowCompose(false)
    setComposeTo('')
    setComposeBody('')
    loadConversations()
  }

  const handleAssign = async (memberName) => {
    if (!activeConvo) return
    await assignConversation(activeConvo.id, { assigned_to: memberName, assigned_by: currentUser })
    setShowAssignDropdown(false)
    loadConversations()
  }

  const handleStar = async () => {
    if (!activeConvo) return
    await starConversation(activeConvo.id)
    loadConversations()
  }

  const handleToggleStatus = async () => {
    if (!activeConvo) return
    const newStatus = activeConvo.status === 'closed' ? 'open' : 'closed'
    await setConversationStatus(activeConvo.id, newStatus)
    loadConversations()
  }

  const insertAtCursor = (text) => {
    setNewMsg(prev => prev + text)
    msgInputRef.current?.focus()
  }

  // Filter counts (approximate from current data - re-fetching each would be too heavy)
  const allCount = conversations.length
  const filteredConversations = conversations.filter(c => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const name = (c.contact_name || '').toLowerCase()
      const phone = (c.phone || '').toLowerCase()
      return name.includes(q) || phone.includes(q)
    }
    return true
  })

  const segInfo = segmentInfo(newMsg)
  const composeSegInfo = segmentInfo(composeBody)

  // Sidebar filters
  const filters = [
    { key: 'all', label: 'All', icon: <MessageSquare size={16} /> },
    { key: 'open', label: 'Open', icon: <Clock size={16} /> },
    { key: 'mine', label: 'Assigned to Me', icon: <User size={16} /> },
    { key: 'starred', label: 'Starred', icon: <Star size={16} /> },
    { key: 'closed', label: 'Closed', icon: <Archive size={16} /> },
  ]

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Left sidebar - filters */}
      <div className="page-sidebar" style={{ width: 200, minWidth: 200, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)' }}>
        <h3 style={{ padding: '16px 16px 8px', margin: 0 }}>Inbox</h3>
        <nav style={{ flex: 1, padding: '4px 8px' }}>
          {filters.map(f => (
            <button
              key={f.key}
              className={`sidebar-item ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 12px', border: 'none', borderRadius: 6,
                background: filter === f.key ? 'rgba(155,127,191,0.15)' : 'none',
                color: filter === f.key ? 'var(--light-purple)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 13, fontWeight: filter === f.key ? 600 : 400,
                textAlign: 'left', marginBottom: 2
              }}
            >
              {f.icon}
              <span style={{ flex: 1 }}>{f.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Middle panel - conversation list */}
      <div style={{
        width: 320, minWidth: 280, borderRight: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)'
      }}>
        <div style={{
          padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 32, width: '100%', fontSize: 13 }}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCompose(true)} title="New Message">
            <Plus size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConversations.length === 0 && (
            <div className="empty-state" style={{ padding: '40px 16px' }}>
              <MessageSquare size={32} />
              <p>No conversations</p>
            </div>
          )}
          {filteredConversations.map(c => {
            const isActive = activeConvo?.id === c.id
            const displayName = c.contact_name || c.phone
            return (
              <div
                key={c.id}
                onClick={() => setActiveConvo(c)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: '1px solid rgba(61,45,86,0.15)',
                  background: isActive ? 'rgba(155,127,191,0.15)' : 'transparent',
                  position: 'relative'
                }}
                onMouseEnter={e => { const star = e.currentTarget.querySelector('.hover-star'); if (star) star.style.opacity = '1' }}
                onMouseLeave={e => { const star = e.currentTarget.querySelector('.hover-star'); if (star && !c.starred) star.style.opacity = '0' }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--medium-purple), var(--light-purple))',
                  color: 'var(--deep-purple)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 700, fontSize: 15
                }}>
                  {displayName[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {displayName}
                    </span>
                    {c.assigned_to && (
                      <span className="tag" style={{ fontSize: 10, padding: '1px 6px' }}>
                        {c.assigned_to}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.phone}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                    {c.last_message?.slice(0, 50)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatTime(c.last_message_at || c.updated_at)}
                  </span>
                  <span
                    className="hover-star"
                    onClick={e => { e.stopPropagation(); starConversation(c.id).then(loadConversations) }}
                    style={{
                      opacity: c.starred ? 1 : 0, transition: 'opacity 0.15s', cursor: 'pointer',
                      color: c.starred ? '#f5a623' : 'var(--text-muted)'
                    }}
                  >
                    <Star size={14} fill={c.starred ? '#f5a623' : 'none'} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right panel - chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {activeConvo ? (
          <>
            {/* Chat header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 20px', borderBottom: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)'
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--medium-purple), var(--light-purple))',
                color: 'var(--deep-purple)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, fontSize: 15
              }}>
                {(activeConvo.contact_name || activeConvo.phone)[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{activeConvo.contact_name || activeConvo.phone}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeConvo.phone}</div>
              </div>

              {/* Assign dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAssignDropdown(!showAssignDropdown)}
                  title="Assign"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                >
                  <User size={14} />
                  {activeConvo.assigned_to || 'Assign'}
                </button>
                {showAssignDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                    borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    minWidth: 160, zIndex: 100, overflow: 'hidden'
                  }}>
                    <div
                      onClick={() => handleAssign('')}
                      style={{
                        padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                        color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)'
                      }}
                    >
                      Unassign
                    </div>
                    {teamMembers.map(m => (
                      <div
                        key={m.id}
                        onClick={() => handleAssign(m.name)}
                        style={{
                          padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: activeConvo.assigned_to === m.name ? 'rgba(155,127,191,0.1)' : 'transparent'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(155,127,191,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = activeConvo.assigned_to === m.name ? 'rgba(155,127,191,0.1)' : 'transparent'}
                      >
                        {activeConvo.assigned_to === m.name && <Check size={12} />}
                        {m.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Star button */}
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleStar}
                title={activeConvo.starred ? 'Unstar' : 'Star'}
                style={{ color: activeConvo.starred ? '#f5a623' : 'var(--text-muted)' }}
              >
                <Star size={16} fill={activeConvo.starred ? '#f5a623' : 'none'} />
              </button>

              {/* Close/open button */}
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleToggleStatus}
                title={activeConvo.status === 'closed' ? 'Reopen' : 'Close'}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
              >
                {activeConvo.status === 'closed' ? (
                  <><Clock size={14} /> Reopen</>
                ) : (
                  <><Archive size={14} /> Close</>
                )}
              </button>
            </div>

            {/* Messages area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {messages.map(m => {
                // Event messages (system events)
                if (m.type === 'event') {
                  return (
                    <div key={m.id} className="event-msg" style={{
                      textAlign: 'center', fontSize: 12, color: 'var(--text-muted)',
                      padding: '8px 0', fontStyle: 'italic'
                    }}>
                      {m.body || m.text}
                    </div>
                  )
                }

                // Notes
                if (m.type === 'note') {
                  return (
                    <div key={m.id} className="chat-bubble note" style={{
                      alignSelf: 'center', maxWidth: '70%',
                      background: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.25)',
                      borderRadius: 12, padding: '10px 16px', fontStyle: 'italic', fontSize: 13
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <StickyNote size={12} style={{ color: '#4caf50' }} />
                        <span style={{ fontWeight: 600, fontSize: 11, color: '#4caf50' }}>
                          {m.sender_name || 'Note'}
                        </span>
                      </div>
                      <div>{m.body}</div>
                      <div className="bubble-meta" style={{ justifyContent: 'center', marginTop: 6 }}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  )
                }

                // Regular messages
                const isOutbound = m.direction === 'outbound'
                return (
                  <div
                    key={m.id}
                    className={`chat-bubble ${isOutbound ? 'outbound' : 'inbound'}`}
                    style={{
                      alignSelf: isOutbound ? 'flex-end' : 'flex-start',
                      maxWidth: '70%', padding: '10px 14px', borderRadius: 16,
                      fontSize: 14, lineHeight: 1.4,
                      ...(isOutbound
                        ? { background: 'var(--medium-purple)', color: 'white', borderBottomRightRadius: 4 }
                        : { background: 'var(--bg-card)', borderBottomLeftRadius: 4 }
                      )
                    }}
                  >
                    <div>{m.body}</div>
                    <div className="bubble-meta" style={{
                      fontSize: 10, marginTop: 4, opacity: 0.7,
                      display: 'flex', alignItems: 'center', gap: 6,
                      justifyContent: isOutbound ? 'flex-end' : 'flex-start'
                    }}>
                      {m.provider && <span className={`dot ${m.provider}`} />}
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isOutbound && m.status && (
                        <span className={`status-badge ${m.status}`} style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 500,
                          background: m.status === 'delivered' ? 'rgba(76,175,80,0.2)' :
                                     m.status === 'failed' ? 'rgba(244,67,54,0.2)' : 'rgba(255,193,7,0.2)',
                          color: m.status === 'delivered' ? '#4caf50' :
                                 m.status === 'failed' ? '#f44336' : '#ffc107'
                        }}>
                          {m.status === 'delivered' ? 'Delivered' : m.status === 'failed' ? 'Failed' : 'Sent'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Compose area */}
            <div style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              {/* Tabs */}
              <div className="tab-bar" style={{
                display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 16px'
              }}>
                <button
                  className={`tab-btn ${composeTab === 'message' ? 'active' : ''}`}
                  onClick={() => setComposeTab('message')}
                  style={{
                    padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: composeTab === 'message' ? 600 : 400,
                    color: composeTab === 'message' ? 'var(--light-purple)' : 'var(--text-muted)',
                    borderBottom: composeTab === 'message' ? '2px solid var(--light-purple)' : '2px solid transparent'
                  }}
                >
                  <Send size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> MESSAGE
                </button>
                <button
                  className={`tab-btn ${composeTab === 'note' ? 'active' : ''}`}
                  onClick={() => setComposeTab('note')}
                  style={{
                    padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: composeTab === 'note' ? 600 : 400,
                    color: composeTab === 'note' ? '#4caf50' : 'var(--text-muted)',
                    borderBottom: composeTab === 'note' ? '2px solid #4caf50' : '2px solid transparent'
                  }}
                >
                  <StickyNote size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> NOTE
                </button>
              </div>

              {composeTab === 'message' ? (
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <textarea
                      ref={msgInputRef}
                      className="input"
                      placeholder="Type a message..."
                      value={newMsg}
                      onChange={e => setNewMsg(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                      style={{ flex: 1, minHeight: 40, maxHeight: 120, resize: 'vertical', fontSize: 13 }}
                      rows={2}
                    />
                    <button className="btn btn-primary" onClick={handleSend} disabled={!newMsg.trim()} style={{ height: 40 }}>
                      <Send size={16} />
                    </button>
                  </div>
                  {/* Character counter */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginTop: 8, fontSize: 11, color: 'var(--text-muted)'
                  }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {/* Quick insert toolbar */}
                      <div style={{ position: 'relative' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowMergeVars(false); setShowTemplates(false) }}
                          title="Insert Emoji"
                          style={{ padding: '2px 6px', fontSize: 12 }}
                        >
                          <Smile size={14} />
                        </button>
                        {showEmojiPicker && (
                          <div style={{
                            position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 8, padding: 8, display: 'flex', gap: 4, flexWrap: 'wrap',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 50, width: 200
                          }}>
                            {EMOJI_LIST.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => { insertAtCursor(emoji); setShowEmojiPicker(false) }}
                                style={{
                                  border: 'none', background: 'none', cursor: 'pointer',
                                  fontSize: 18, padding: 4, borderRadius: 4
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(155,127,191,0.15)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ position: 'relative' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setShowMergeVars(!showMergeVars); setShowEmojiPicker(false); setShowTemplates(false) }}
                          title="Merge Variables"
                          style={{ padding: '2px 6px', fontSize: 12 }}
                        >
                          <Variable size={14} />
                        </button>
                        {showMergeVars && (
                          <div style={{
                            position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 8, overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 50, minWidth: 140
                          }}>
                            {MERGE_VARS.map(v => (
                              <div
                                key={v}
                                onClick={() => { insertAtCursor(v); setShowMergeVars(false) }}
                                style={{
                                  padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                                  fontFamily: 'monospace', borderBottom: '1px solid var(--border-color)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(155,127,191,0.15)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {v}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div style={{ position: 'relative' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setShowTemplates(!showTemplates); setShowEmojiPicker(false); setShowMergeVars(false) }}
                          title="Templates"
                          style={{ padding: '2px 6px', fontSize: 12 }}
                        >
                          <FileText size={14} />
                        </button>
                        {showTemplates && (
                          <div style={{
                            position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
                            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                            borderRadius: 8, overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)', zIndex: 50,
                            minWidth: 200, maxHeight: 200, overflowY: 'auto'
                          }}>
                            {templates.length === 0 ? (
                              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>
                                No templates saved
                              </div>
                            ) : templates.map(t => (
                              <div
                                key={t.id}
                                onClick={() => { setNewMsg(t.body || t.content || ''); setShowTemplates(false) }}
                                style={{
                                  padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                                  borderBottom: '1px solid var(--border-color)'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(155,127,191,0.15)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ fontWeight: 600, fontSize: 12 }}>{t.name || t.title}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {(t.body || t.content || '').slice(0, 60)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <span>
                      {segInfo.chars}/{segInfo.limit} ({segInfo.segments || 1} segment{segInfo.segments !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px 16px' }}>
                  <textarea
                    className="input"
                    placeholder="Add an internal note..."
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    style={{
                      width: '100%', minHeight: 60, maxHeight: 120, resize: 'vertical',
                      fontSize: 13, background: 'rgba(76, 175, 80, 0.06)',
                      border: '1px solid rgba(76, 175, 80, 0.25)'
                    }}
                    rows={3}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button
                      className="btn btn-sm"
                      onClick={handleAddNote}
                      disabled={!noteText.trim()}
                      style={{
                        background: '#4caf50', color: 'white', border: 'none',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <StickyNote size={12} /> Add Note
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 12
          }}>
            <MessageSquare size={48} style={{ opacity: 0.4 }} />
            <p style={{ color: 'var(--text-muted)' }}>Select a conversation or start a new one</p>
          </div>
        )}
      </div>

      {/* New Message Modal */}
      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>New Message</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCompose(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="form-group">
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>To</label>
              <input
                className="input"
                placeholder="+1234567890"
                value={composeTo}
                onChange={e => setComposeTo(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginTop: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: 'block' }}>Message</label>
              <textarea
                className="input"
                placeholder="Type your message..."
                value={composeBody}
                onChange={e => setComposeBody(e.target.value)}
                rows={4}
                style={{ resize: 'vertical' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                {composeSegInfo.chars}/{composeSegInfo.limit} ({composeSegInfo.segments || 1} segment{composeSegInfo.segments !== 1 ? 's' : ''})
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Sending via <strong>{provider === 'twilio' ? 'Twilio' : 'SignalWire'}</strong>
            </div>
            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowCompose(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCompose}
                disabled={!composeTo.trim() || !composeBody.trim()}
              >
                <Send size={14} /> Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
