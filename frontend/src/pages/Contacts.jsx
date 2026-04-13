import { useState, useEffect, useRef } from 'react'
import {
  Users, Plus, Search, Upload, Download, Edit2, Trash2, X,
  FileText, AlertCircle, Ban, UserX, Mail
} from 'lucide-react'
import {
  getContacts, getContactGroups, createContact, updateContact, deleteContact,
  uploadContacts, previewCSV, getTags, getImportHistory, exportContacts
} from '../api'

const FIELD_TARGETS = [
  { key: 'phone', label: 'Number', aliases: ['phone', 'number', 'mobile', 'cell', 'telephone', 'phone number', 'phone_number', 'phonenumber'] },
  { key: 'first_name', label: 'First Name', aliases: ['first name', 'first_name', 'firstname', 'first', 'fname'] },
  { key: 'last_name', label: 'Last Name', aliases: ['last name', 'last_name', 'lastname', 'last', 'lname', 'surname'] },
  { key: 'business', label: 'Business', aliases: ['business', 'company', 'organization', 'org', 'business name', 'company name'] },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail', 'email address', 'email_address', 'emailaddress'] },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'tag', 'labels', 'label', 'groups', 'group'] },
]

function autoDetectMapping(columns) {
  const mapping = {}
  for (const target of FIELD_TARGETS) {
    const match = columns.find(col =>
      target.aliases.includes(col.toLowerCase().trim())
    )
    if (match) mapping[target.key] = match
  }
  return mapping
}

function getStatusLabel(contact) {
  if (contact.blocked) return { text: 'Blocked', color: 'var(--text-muted)' }
  if (contact.invalid) return { text: 'Invalid', color: 'var(--warning, #f59e0b)' }
  if (contact.opted_out) return { text: 'Opted Out', color: 'var(--error)' }
  return { text: 'Active', color: 'var(--success)' }
}

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [groups, setGroups] = useState({ all: 0, opted_out: 0, blocked: 0, invalid: 0, never_messaged: 0 })
  const [tags, setTags] = useState([])
  const [importHistory, setImportHistory] = useState([])
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState('all')
  const [activeTag, setActiveTag] = useState(null)

  // Contact modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', business: '', tags: '' })

  // CSV upload
  const [showCSVModal, setShowCSVModal] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [csvPreview, setCsvPreview] = useState(null)
  const [csvMapping, setCsvMapping] = useState({})
  const [csvUploading, setCsvUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)

  const fileInputRef = useRef(null)

  useEffect(() => {
    loadContacts()
  }, [search, activeGroup, activeTag])

  useEffect(() => {
    loadSidebar()
  }, [])

  const loadContacts = async () => {
    const params = {}
    if (search) params.search = search
    if (activeGroup && activeGroup !== 'all') params.group = activeGroup
    if (activeTag) params.tag = activeTag
    const data = await getContacts(params)
    setContacts(data)
  }

  const loadSidebar = async () => {
    const [groupData, tagData, historyData] = await Promise.all([
      getContactGroups(),
      getTags(),
      getImportHistory(),
    ])
    setGroups(groupData)
    setTags(tagData)
    setImportHistory(historyData)
  }

  const selectGroup = (group) => {
    setActiveGroup(group)
    setActiveTag(null)
  }

  const selectTag = (tag) => {
    setActiveTag(tag)
    setActiveGroup(null)
  }

  // Contact CRUD

  const openNew = () => {
    setEditing(null)
    setForm({ first_name: '', last_name: '', phone: '', email: '', business: '', tags: '' })
    setShowModal(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({
      first_name: c.first_name || '',
      last_name: c.last_name || '',
      phone: c.phone || '',
      email: c.email || '',
      business: c.business || '',
      tags: (c.tags || []).join(', '),
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    const data = {
      name: [form.first_name, form.last_name].filter(Boolean).join(' '),
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
      email: form.email,
      business: form.business,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    }
    if (editing) {
      await updateContact(editing.id, data)
    } else {
      await createContact(data)
    }
    setShowModal(false)
    loadContacts()
    loadSidebar()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this contact?')) return
    await deleteContact(id)
    loadContacts()
    loadSidebar()
  }

  // CSV Upload

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setCsvFile(file)
    const preview = await previewCSV(file)
    setCsvPreview(preview)
    setCsvMapping(autoDetectMapping(preview.columns))
    setUploadResult(null)
    setShowCSVModal(true)
  }

  const handleCSVImport = async () => {
    if (!csvFile) return
    setCsvUploading(true)
    try {
      const result = await uploadContacts(csvFile, csvMapping)
      setUploadResult(result)
      setCsvPreview(null)
      loadContacts()
      loadSidebar()
    } finally {
      setCsvUploading(false)
    }
  }

  const closeCSVModal = () => {
    setShowCSVModal(false)
    setCsvFile(null)
    setCsvPreview(null)
    setCsvMapping({})
    setUploadResult(null)
  }

  // Export

  const handleExport = () => {
    const params = {}
    if (activeGroup && activeGroup !== 'all') params.group = activeGroup
    if (activeTag) params.tag = activeTag
    exportContacts(params)
  }

  const contactName = (c) => {
    if (c.name) return c.name
    return [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown'
  }

  return (
    <div className="page-with-sidebar">
      {/* LEFT SIDEBAR */}
      <div className="page-sidebar">
        <h2>CONTACTS</h2>

        <button
          className={`sidebar-item ${activeGroup === 'all' && !activeTag ? 'active' : ''}`}
          onClick={() => selectGroup('all')}
        >
          <Users size={14} />
          All Contacts
          <span className="sidebar-badge">{groups.all}</span>
        </button>

        <h3>SYSTEM GROUPS</h3>
        <button
          className={`sidebar-item ${activeGroup === 'opted_out' ? 'active' : ''}`}
          onClick={() => selectGroup('opted_out')}
        >
          <UserX size={14} />
          Opt-Outs
          <span className="sidebar-badge">{groups.opted_out}</span>
        </button>
        <button
          className={`sidebar-item ${activeGroup === 'blocked' ? 'active' : ''}`}
          onClick={() => selectGroup('blocked')}
        >
          <Ban size={14} />
          Blocked
          <span className="sidebar-badge">{groups.blocked}</span>
        </button>
        <button
          className={`sidebar-item ${activeGroup === 'invalid' ? 'active' : ''}`}
          onClick={() => selectGroup('invalid')}
        >
          <AlertCircle size={14} />
          Invalid
          <span className="sidebar-badge">{groups.invalid}</span>
        </button>
        <button
          className={`sidebar-item ${activeGroup === 'never_messaged' ? 'active' : ''}`}
          onClick={() => selectGroup('never_messaged')}
        >
          <Mail size={14} />
          Never Messaged
          <span className="sidebar-badge">{groups.never_messaged}</span>
        </button>

        <h3>TAGS</h3>
        {tags.length === 0 && (
          <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 13 }}>No tags yet</div>
        )}
        {tags.map(t => (
          <button
            key={t.name}
            className={`sidebar-item ${activeTag === t.name ? 'active' : ''}`}
            onClick={() => selectTag(t.name)}
          >
            {t.name}
            <span className="sidebar-badge">{t.count}</span>
          </button>
        ))}

        <h3>IMPORT HISTORY</h3>
        {importHistory.length === 0 && (
          <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 13 }}>No imports yet</div>
        )}
        {importHistory.slice(0, 10).map(imp => (
          <div key={imp.id} className="sidebar-item" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={12} />
              <span style={{ fontWeight: 500, fontSize: 13 }}>{imp.filename}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 18 }}>
              {new Date(imp.created_at).toLocaleDateString()} &middot; {imp.created_count} contacts
            </div>
          </div>
        ))}
      </div>

      {/* RIGHT CONTENT */}
      <div className="page-content">
        <div className="page-header">
          <h1>Contacts</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={handleExport}>
              <Download size={14} /> Export CSV
            </button>
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} /> CSV Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              hidden
            />
            <button className="btn btn-primary" onClick={openNew}>
              <Plus size={14} /> Add Contact
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 16, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Search contacts by name, phone, business, or tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Business</th>
                <th>Tags</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <Users size={32} />
                      <p>No contacts found</p>
                    </div>
                  </td>
                </tr>
              )}
              {contacts.map(c => {
                const status = getStatusLabel(c)
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{contactName(c)}</td>
                    <td>{c.phone}</td>
                    <td>{c.email}</td>
                    <td>{c.business}</td>
                    <td>
                      {(c.tags || []).map(t => (
                        <span key={t} className="tag">{t}</span>
                      ))}
                    </td>
                    <td>
                      <span style={{ color: status.color, fontSize: 12, fontWeight: 600 }}>
                        {status.text}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>
                          <Edit2 size={12} />
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONTACT MODAL */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Contact' : 'New Contact'}</h2>
            <div className="form-group">
              <label>First Name</label>
              <input
                className="input"
                value={form.first_name}
                onChange={e => setForm({ ...form, first_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                className="input"
                value={form.last_name}
                onChange={e => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                className="input"
                placeholder="+1234567890"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                className="input"
                placeholder="name@example.com"
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Business</label>
              <input
                className="input"
                value={form.business}
                onChange={e => setForm({ ...form, business: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Tags (comma-separated)</label>
              <input
                className="input"
                placeholder="vip, leads, demo"
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV UPLOAD MODAL */}
      {showCSVModal && (
        <div className="modal-overlay" onClick={closeCSVModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
            {/* Upload result view */}
            {uploadResult ? (
              <>
                <h2>Import Complete</h2>
                <div className="card" style={{ textAlign: 'center', padding: 24 }}>
                  <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
                    {uploadResult.created_count} created, {uploadResult.skipped_count} skipped, {uploadResult.duplicate_count} duplicates
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    Total rows processed: {uploadResult.total_rows}
                  </p>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-primary" onClick={closeCSVModal}>Done</button>
                </div>
              </>
            ) : csvPreview ? (
              <>
                <h2>Map CSV Columns</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                  Map your CSV columns to contact fields. We auto-detected what we could.
                </p>

                {/* Column mapping */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 20 }}>
                  {FIELD_TARGETS.map(target => (
                    <div key={target.key} className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 13 }}>{target.label}</label>
                      <select
                        className="input"
                        value={csvMapping[target.key] || ''}
                        onChange={e => {
                          const val = e.target.value
                          setCsvMapping(prev => {
                            const next = { ...prev }
                            if (val) {
                              next[target.key] = val
                            } else {
                              delete next[target.key]
                            }
                            return next
                          })
                        }}
                      >
                        <option value="">-- Skip --</option>
                        {csvPreview.columns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Preview table */}
                <div className="table-wrap" style={{ marginBottom: 16 }}>
                  <table>
                    <thead>
                      <tr>
                        {csvPreview.columns.map(col => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.rows.slice(0, 3).map((row, i) => (
                        <tr key={i}>
                          {csvPreview.columns.map((col, j) => (
                            <td key={j}>{row[col] ?? row[j] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={closeCSVModal}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleCSVImport}
                    disabled={csvUploading || !csvMapping.phone}
                  >
                    {csvUploading ? 'Importing...' : 'Import'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                Loading preview...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
