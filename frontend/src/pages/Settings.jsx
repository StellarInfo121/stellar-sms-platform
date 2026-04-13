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
} from 'lucide-react'
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTeamMembers,
  createTeamMember,
  updateTeamMember,
  deleteTeamMember,
  getProvider,
  setProvider,
} from '../api'

const SECTIONS = [
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'team', label: 'Team Members', icon: Users },
  { key: 'account', label: 'Account', icon: Shield },
]

const MERGE_VARS = ['{name}', '{first_name}', '{last_name}', '{business}']

function highlightMergeVars(text) {
  const parts = text.split(/(\{[^}]+\})/g)
  return parts.map((part, i) =>
    /^\{[^}]+\}$/.test(part) ? (
      <span key={i} style={{ color: 'var(--purple, #a855f7)', fontWeight: 600 }}>
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

function TemplatesSection() {
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
    if (tab === 'mine') params.owner = 'Moise'
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
        owner: 'Moise',
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

function TeamSection() {
  const [members, setMembers] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', role: 'rep' })

  useEffect(() => {
    loadMembers()
  }, [])

  const loadMembers = async () => {
    const data = await getTeamMembers()
    setMembers(data)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', role: 'rep' })
    setShowModal(true)
  }

  const openEdit = (member) => {
    setEditing(member)
    setForm({ name: member.name, role: member.role })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (editing) {
      await updateTeamMember(editing.id, { name: form.name, role: form.role })
    } else {
      await createTeamMember({ name: form.name, role: form.role })
    }
    setShowModal(false)
    loadMembers()
  }

  const handleDelete = async (id) => {
    await deleteTeamMember(id)
    loadMembers()
  }

  return (
    <>
      <div className="page-header">
        <h2>Team Members</h2>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus size={14} /> Add Member
        </button>
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
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
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
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDelete(m.id)}
                      >
                        <Trash2 size={14} />
                      </button>
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

// ─── Main Settings Page ─────────────────────────────────────────────

export default function Settings({ provider }) {
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
        {section === 'templates' && <TemplatesSection />}
        {section === 'team' && <TeamSection />}
        {section === 'account' && <AccountSection provider={provider} />}
      </div>
    </div>
  )
}
