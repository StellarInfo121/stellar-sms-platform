import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, Plus, X } from 'lucide-react'
import { getConversations, getMessages, sendSMS } from '../api'

export default function Messages({ provider }) {
  const [conversations, setConversations] = useState([])
  const [activeConvo, setActiveConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [composeTo, setComposeTo] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    loadConversations()
    const interval = setInterval(loadConversations, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activeConvo) {
      loadMessages(activeConvo.id)
      const interval = setInterval(() => loadMessages(activeConvo.id), 3000)
      return () => clearInterval(interval)
    }
  }, [activeConvo?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async () => {
    const data = await getConversations()
    setConversations(data)
  }

  const loadMessages = async (convoId) => {
    const data = await getMessages(convoId)
    setMessages(data)
  }

  const handleSend = async () => {
    if (!newMsg.trim() || !activeConvo) return
    await sendSMS({ to: activeConvo.phone, body: newMsg })
    setNewMsg('')
    loadMessages(activeConvo.id)
    loadConversations()
  }

  const handleCompose = async () => {
    if (!composeTo.trim() || !composeBody.trim()) return
    await sendSMS({ to: composeTo, body: composeBody })
    setShowCompose(false)
    setComposeTo('')
    setComposeBody('')
    loadConversations()
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Conversation list */}
      <div className="convo-list">
        <div className="convo-list-header">
          <h2>Conversations</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCompose(true)}>
            <Plus size={14} /> New
          </button>
        </div>
        <div className="convo-list-body">
          {conversations.length === 0 && (
            <div className="empty-state" style={{ padding: '30px 16px' }}>
              <MessageSquare size={32} />
              <p>No conversations yet</p>
            </div>
          )}
          {conversations.map(c => (
            <button
              key={c.id}
              className={`convo-item ${activeConvo?.id === c.id ? 'active' : ''}`}
              onClick={() => setActiveConvo(c)}
            >
              <div className="convo-avatar">{(c.contact_name || c.phone)[0]?.toUpperCase()}</div>
              <div className="convo-info">
                <div className="convo-name">{c.contact_name || c.phone}</div>
                <div className="convo-preview">{c.last_message?.slice(0, 40)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="chat-area">
        {activeConvo ? (
          <>
            <div className="chat-header">
              <div className="convo-avatar">{(activeConvo.contact_name || activeConvo.phone)[0]?.toUpperCase()}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{activeConvo.contact_name || activeConvo.phone}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activeConvo.phone}</div>
              </div>
            </div>
            <div className="chat-messages">
              {messages.map(m => (
                <div key={m.id} className={`chat-bubble ${m.direction}`}>
                  <div className="bubble-text">{m.body}</div>
                  <div className="bubble-meta">
                    {m.provider && <span className={`provider-dot ${m.provider}`} />}
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <div className="chat-input">
              <input
                className="input"
                placeholder="Type a message..."
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button className="btn btn-primary" onClick={handleSend}>
                <Send size={16} />
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ margin: 'auto' }}>
            <MessageSquare size={48} />
            <p>Select a conversation or start a new one</p>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0 }}>New Message</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCompose(false)}><X size={14} /></button>
            </div>
            <div className="form-group">
              <label>To (phone number)</label>
              <input className="input" placeholder="+1234567890" value={composeTo} onChange={e => setComposeTo(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Message</label>
              <textarea className="input" placeholder="Type your message..." value={composeBody} onChange={e => setComposeBody(e.target.value)} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Sending via <strong>{provider === 'twilio' ? 'Twilio' : 'SignalWire'}</strong>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowCompose(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCompose}><Send size={14} /> Send</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .convo-list {
          width: 300px;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
        }
        .convo-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
        }
        .convo-list-header h2 { font-size: 16px; font-weight: 600; }
        .convo-list-body { flex: 1; overflow-y: auto; }
        .convo-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 12px 16px;
          background: none;
          border: none;
          border-bottom: 1px solid rgba(61, 45, 86, 0.3);
          color: var(--text-primary);
          text-align: left;
          cursor: pointer;
        }
        .convo-item:hover { background: var(--bg-card); }
        .convo-item.active { background: rgba(155, 127, 191, 0.15); }
        .convo-avatar {
          width: 36px; height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--medium-purple), var(--light-purple));
          color: var(--deep-purple);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px; flex-shrink: 0;
        }
        .convo-info { overflow: hidden; }
        .convo-name { font-weight: 600; font-size: 14px; }
        .convo-preview { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
        .chat-area { flex: 1; display: flex; flex-direction: column; }
        .chat-header {
          display: flex; align-items: center; gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-secondary);
        }
        .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
        .chat-bubble { max-width: 70%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.4; }
        .chat-bubble.outbound { align-self: flex-end; background: var(--medium-purple); color: white; border-bottom-right-radius: 4px; }
        .chat-bubble.inbound { align-self: flex-start; background: var(--bg-card); border-bottom-left-radius: 4px; }
        .bubble-meta { font-size: 10px; margin-top: 4px; opacity: 0.7; display: flex; align-items: center; gap: 4px; }
        .chat-input { display: flex; gap: 8px; padding: 16px 20px; border-top: 1px solid var(--border-color); background: var(--bg-secondary); }
        .chat-input .input { flex: 1; }
      `}</style>
    </div>
  )
}
