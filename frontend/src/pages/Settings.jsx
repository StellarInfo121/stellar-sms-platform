import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  FileText,
  Users,
  Shield,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Share2,
  Lock,
  Key,
  Copy,
} from 'lucide-react'
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getProvider,
  setProvider,
  getApiKeys,
  createApiKey,
  revokeApiKey,
} from '../api'

const SECTIONS = [
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'team', label: 'Team Members', icon: Users },
  { key: 'account', label: 'Account', icon: Shield },
  { key: 'apikeys', label: 'API Keys', icon: Key },
  { key: 'apidocs', label: 'API Docs', icon: FileText },
]

const MERGE_VARS = ['{name}', '{first_name}', '{last_name}', '{business}']

function highlightMergeVars(text) {
  const parts = text.split(/(\{[^}]+\})/g)
  return parts.map((part, i) =>
    /^\{[^}]+\}$/.test(part) ? (
      <span key={i} style={{ color: 'var(--medium-purple)', fontWeight: 600 }}>
        {part}
      </span>
    ) : (
      part
    )
  )
}

function maskString(str) {
  if (!str) return '••••••••'
  if (str.length <= 6) return '••••••••'
  return str.slice(0, 3) + '••••••••' + str.slice(-3)
}

// ─── Templates Section ──────────────────────────────────────────────

function TemplatesSection({ currentUser }) {
  const [templates, setTemplates] = useState([])
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', body: '', shared: true })

  useEffect(() => {
    loadTemplates()
  }, [search, tab])

  const loadTemplates = async () => {
    const params = {}
    if (search) params.search = search
    if (tab === 'mine') params.owner = 'mine'
    const data = await getTemplates(params)
    setTemplates(data)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ title: '', body: '', shared: true })
    setShowModal(true)
  }

  const openEdit = (tpl) => {
    setEditing(tpl)
    setForm({ title: tpl.title, body: tpl.body, shared: tpl.shared })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (editing) {
      await updateTemplate(editing.id, {
        title: form.title,
        body: form.body,
        shared: form.shared,
      })
    } else {
      await createTemplate({
        title: form.title,
        body: form.body,
        owner: currentUser.name,
        shared: form.shared,
      })
    }
    setShowModal(false)
    loadTemplates()
  }

  const handleDelete = async (id) => {
    await deleteTemplate(id)
    loadTemplates()
  }

  return (
    <>
      <div className="page-header">
        <h2>Message Templates</h2>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={14} /> New Template
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }}
        />
        <input
          className="input"
          placeholder="Search templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 36, width: '100%' }}
        />
      </div>

      <div className="tab-bar">
        <button
          className={`tab-btn ${tab === 'all' ? 'active' : ''}`}
          onClick={() => setTab('all')}
        >
          ALL
        </button>
        <button
          className={`tab-btn ${tab === 'mine' ? 'active' : ''}`}
          onClick={() => setTab('mine')}
        >
          MINE
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="empty-state">
          <FileText size={40} />
          <p>No templates found</p>
        </div>
      ) : (
        templates.map((tpl) => (
          <div className="card" key={tpl.id} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ margin: '0 0 4px' }}>{tpl.title}</h4>
                <p
                  style={{
                    margin: '0 0 8px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  {highlightMergeVars(tpl.body)}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {tpl.owner}
                  </span>
                  <span className="tag">
                    {tpl.shared ? (
                      <>
                        <Share2 size={12} /> Shared
                      </>
                    ) : (
                      <>
                        <Lock size={12} /> Personal
                      </>
                    )}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(tpl)}>
                  <Edit2 size={14} />
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(tpl.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0 }}>
                {editing ? 'Edit Template' : 'New Template'}
              </h3>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setShowModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label>Title</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Template title"
              />
            </div>

            <div className="form-group">
              <label>Body</label>
              <textarea
                className="input"
                rows={5}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Type your message..."
              />
              <small style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Merge variables: {MERGE_VARS.join(', ')}
              </small>
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.shared}
                  onChange={(e) => setForm({ ...form, shared: e.target.checked })}
                />
                Share with team
              </label>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Team Members Section ───────────────────────────────────────────

function TeamSection({ currentUser }) {
  const [members, setMembers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', role: 'rep', twilio_number: '', signalwire_number: '' })

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    const data = await getUsers()
    setMembers(data)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', email: '', role: 'rep', twilio_number: '', signalwire_number: '' })
    setShowModal(true)
  }

  const openEdit = (member) => {
    setEditing(member)
    setForm({ name: member.name, email: member.email || '', role: member.role, twilio_number: member.twilio_number || '', signalwire_number: member.signalwire_number || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (editing) {
      await updateUser(editing.id, { name: form.name, email: form.email, role: form.role, twilio_number: form.twilio_number, signalwire_number: form.signalwire_number })
    } else {
      await createUser({ name: form.name, email: form.email, role: form.role, twilio_number: form.twilio_number, signalwire_number: form.signalwire_number })
    }
    setShowModal(false)
    loadMembers()
  }

  const handleDelete = async (id) => {
    await deleteUser(id)
    loadMembers()
  }

  return (
    <>
      <div className="page-header">
        <h2>Team Members</h2>
        {currentUser.role === 'admin' && (
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={14} /> Add Member
          </button>
        )}
      </div>

      {members.length === 0 ? (
        <div className="empty-state">
          <Users size={40} />
          <p>No team members yet</p>
        </div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Twilio Number</th>
                <th>SignalWire Number</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.email}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.twilio_number || '--'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{m.signalwire_number || '--'}</td>
                  <td>
                    <span className="tag">
                      {m.role === 'admin' ? (
                        <>
                          <Shield size={12} /> admin
                        </>
                      ) : (
                        'rep'
                      )}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openEdit(m)}
                      >
                        <Edit2 size={14} />
                      </button>
                      {currentUser.role === 'admin' && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(m.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h3 style={{ margin: 0 }}>
                {editing ? 'Edit Member' : 'Add Member'}
              </h3>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setShowModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="form-group">
              <label>Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Email address"
              />
            </div>

            <div className="form-group">
              <label>Twilio Phone Number</label>
              <input
                className="input"
                placeholder="+15551234567"
                value={form.twilio_number}
                onChange={(e) => setForm({ ...form, twilio_number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>SignalWire Phone Number</label>
              <input
                className="input"
                placeholder="+15551234567"
                value={form.signalwire_number}
                onChange={(e) => setForm({ ...form, signalwire_number: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Role</label>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="rep">Rep</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Account Section ────────────────────────────────────────────────

function AccountSection({ provider }) {
  const [activeProvider, setActiveProvider] = useState(provider || 'twilio')

  useEffect(() => {
    getProvider().then((data) => {
      if (data?.provider) setActiveProvider(data.provider)
    })
  }, [])

  const handleSwitch = async (p) => {
    await setProvider(p)
    setActiveProvider(p)
  }

  return (
    <>
      <div className="page-header">
        <h2>Account</h2>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>SMS Provider</h4>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            className={`btn ${activeProvider === 'twilio' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSwitch('twilio')}
          >
            Twilio
          </button>
          <button
            className={`btn ${activeProvider === 'signalwire' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleSwitch('signalwire')}
          >
            SignalWire
          </button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Active provider: <strong>{activeProvider}</strong>
        </p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>Twilio Configuration</h4>
        <div className="form-group">
          <label>Account SID</label>
          <input className="input" value={maskString('AC_TWILIO_SID')} disabled />
        </div>
        <div className="form-group">
          <label>Phone Number</label>
          <input className="input" value="+1 (XXX) XXX-XXXX" disabled />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 12px' }}>SignalWire Configuration</h4>
        <div className="form-group">
          <label>Project ID</label>
          <input className="input" value={maskString('SW_PROJECT_ID')} disabled />
        </div>
        <div className="form-group">
          <label>Space URL</label>
          <input className="input" value="example.signalwire.com" disabled />
        </div>
        <div className="form-group">
          <label>Phone Number</label>
          <input className="input" value="+1 (XXX) XXX-XXXX" disabled />
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        <Shield size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        Configure credentials in environment variables
      </p>
    </>
  )
}

// ─── API Keys Section ──────────────────────────────────────────────

function ApiKeysSection() {
  const [apiKeys, setApiKeys] = useState([])
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyResult, setNewKeyResult] = useState(null)

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    const data = await getApiKeys()
    setApiKeys(data)
  }

  const handleCreate = async () => {
    if (!newKeyLabel.trim()) return
    const result = await createApiKey({ label: newKeyLabel.trim() })
    setNewKeyResult(result)
    setNewKeyLabel('')
    loadKeys()
  }

  const handleRevoke = async (id) => {
    if (!window.confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return
    await revokeApiKey(id)
    loadKeys()
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <>
      <div className="page-header">
        <h2>API Keys</h2>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          className="input"
          placeholder='Key label (e.g., "Zapier", "GHL", "Retell AI")'
          value={newKeyLabel}
          onChange={(e) => setNewKeyLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && newKeyLabel.trim() && handleCreate()}
          style={{ flex: 1 }}
        />
        <button
          className="btn btn-primary"
          onClick={handleCreate}
          disabled={!newKeyLabel.trim()}
          style={{ opacity: newKeyLabel.trim() ? 1 : 0.5, cursor: newKeyLabel.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}
        >
          <Plus size={14} /> Create Key
        </button>
      </div>

      {newKeyResult && (
        <div className="card" style={{ marginBottom: 16, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ color: '#166534' }}>API Key Created</strong>
            <button className="btn btn-sm btn-secondary" onClick={() => handleCopy(newKeyResult.key)}>
              <Copy size={14} /> Copy
            </button>
          </div>
          <code style={{ display: 'block', padding: 8, background: '#DCFCE7', borderRadius: 4, wordBreak: 'break-all', fontSize: 13 }}>
            {newKeyResult.key}
          </code>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: '#92400E', fontWeight: 600 }}>
            Save this key — you won't see it again.
          </p>
        </div>
      )}

      {apiKeys.length === 0 ? (
        <div className="empty-state">
          <Key size={40} />
          <p>No API keys yet</p>
        </div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Key Prefix</th>
                <th>Owner</th>
                <th>Created</th>
                <th>Last Used</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((k) => (
                <tr key={k.id}>
                  <td>{k.label}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{k.prefix || `sk_${(k.key_prefix || '').slice(0, 6)}...`}</td>
                  <td>{k.owner || k.user_name || '--'}</td>
                  <td>{k.created_at ? new Date(k.created_at).toLocaleDateString() : '--'}</td>
                  <td>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => handleRevoke(k.id)}>
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// ─── API Docs Section ──────────────────────────────────────────────

const API_DOCS = [
  { method: 'POST', path: '/messages/send', desc: 'Send an SMS message', body: '{"to": "+15551234567", "body": "Hello!", "provider": "twilio"}', response: '{"success": true, "message_id": 1, "sid": "SM...", "provider": "twilio"}' },
  { method: 'GET', path: '/messages', desc: 'List messages (paginated)', params: 'page, per_page, phone, direction' },
  { method: 'GET', path: '/conversations', desc: 'List conversations' },
  { method: 'GET', path: '/conversations/:id/messages', desc: 'Get conversation thread' },
  { method: 'GET', path: '/contacts', desc: 'List contacts (paginated)', params: 'page, per_page, search, tag' },
  { method: 'POST', path: '/contacts', desc: 'Create a contact', body: '{"name": "John", "phone": "+15551234567", "business": "Acme", "tags": ["vip"]}' },
  { method: 'POST', path: '/contacts/bulk', desc: 'Create multiple contacts', body: '{"contacts": [{"name": "John", "phone": "+15551234567"}]}' },
  { method: 'PUT', path: '/contacts/:id', desc: 'Update a contact' },
  { method: 'DELETE', path: '/contacts/:id', desc: 'Delete a contact' },
  { method: 'GET', path: '/campaigns', desc: 'List campaigns' },
  { method: 'POST', path: '/campaigns', desc: 'Create a campaign', body: '{"name": "Promo", "message_template": "Hi {name}!", "tags": ["vip"], "send_now": true}' },
  { method: 'POST', path: '/campaigns/:id/send', desc: 'Trigger campaign send' },
  { method: 'GET', path: '/campaigns/:id/status', desc: 'Get campaign progress' },
  { method: 'POST', path: '/webhooks', desc: 'Register outbound webhook', body: '{"url": "https://...", "events": ["message.received", "message.delivered"]}' },
  { method: 'GET', path: '/webhooks', desc: 'List registered webhooks' },
  { method: 'DELETE', path: '/webhooks/:id', desc: 'Delete a webhook' },
]

const METHOD_STYLES = {
  GET: { background: '#DBEAFE', color: '#1E40AF' },
  POST: { background: '#DCFCE7', color: '#166534' },
  PUT: { background: '#FEF3C7', color: '#92400E' },
  DELETE: { background: '#FEE2E2', color: '#991B1B' },
}

function ApiDocsSection() {
  return (
    <div>
      <h2>API Documentation</h2>
      <p style={{ color: '#666', marginBottom: 24 }}>Base URL: <code style={{ background: '#F5F0FA', padding: '2px 6px', borderRadius: 4 }}>https://stellar-sms-platform-production.up.railway.app/api/v1</code></p>

      <p style={{ marginBottom: 16, fontSize: 13, color: '#666' }}>
        Authenticate with header: <code>Authorization: Bearer sk_your_key_here</code><br/>
        Rate limit: 100 requests per minute per key.
      </p>

      {API_DOCS.map((ep, i) => {
        const badge = METHOD_STYLES[ep.method] || METHOD_STYLES.GET
        return (
          <div className="card" key={i} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'monospace',
                background: badge.background,
                color: badge.color,
              }}>
                {ep.method}
              </span>
              <code style={{ fontSize: 14 }}>{ep.path}</code>
            </div>
            <p style={{ margin: '0 0 8px', color: '#444' }}>{ep.desc}</p>
            {ep.params && (
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#666' }}>
                <strong>Query params:</strong> {ep.params}
              </p>
            )}
            {ep.body && (
              <div style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Request body:</strong>
                <pre style={{ background: '#F5F0FA', padding: 10, borderRadius: 4, overflow: 'auto', fontSize: 12, margin: '4px 0 0' }}>
                  <code>{ep.body}</code>
                </pre>
              </div>
            )}
            {ep.response && (
              <div>
                <strong style={{ fontSize: 13 }}>Response:</strong>
                <pre style={{ background: '#F5F0FA', padding: 10, borderRadius: 4, overflow: 'auto', fontSize: 12, margin: '4px 0 0' }}>
                  <code>{ep.response}</code>
                </pre>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Settings Page ─────────────────────────────────────────────

export default function Settings({ provider, currentUser }) {
  const [section, setSection] = useState('templates')

  return (
    <div className="page-with-sidebar">
      <div className="page-sidebar">
        <h3>
          <SettingsIcon size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          SETTINGS
        </h3>
        {SECTIONS.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className={`sidebar-item ${section === key ? 'active' : ''}`}
            onClick={() => setSection(key)}
          >
            <Icon size={16} />
            {label}
          </div>
        ))}
      </div>

      <div className="page-content">
        {section === 'templates' && <TemplatesSection currentUser={currentUser} />}
        {section === 'team' && <TeamSection currentUser={currentUser} />}
        {section === 'account' && <AccountSection provider={provider} />}
        {section === 'apikeys' && <ApiKeysSection />}
        {section === 'apidocs' && <ApiDocsSection />}
      </div>
    </div>
  )
}
