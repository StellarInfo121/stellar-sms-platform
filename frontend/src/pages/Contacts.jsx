import { useState, useEffect } from 'react'
import { Users, Plus, Search, Upload, Edit2, Trash2, X } from 'lucide-react'
import { getContacts, createContact, updateContact, deleteContact, uploadContacts, getTags } from '../api'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '', business: '', tags: '' })
  const [uploadResult, setUploadResult] = useState(null)

  useEffect(() => {
    loadContacts()
  }, [search])

  const loadContacts = async () => {
    const data = await getContacts(search)
    setContacts(data)
  }

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', phone: '', business: '', tags: '' })
    setShowModal(true)
  }

  const openEdit = (c) => {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone, business: c.business, tags: c.tags.join(', ') })
    setShowModal(true)
  }

  const handleSave = async () => {
    const data = {
      name: form.name,
      phone: form.phone,
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
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this contact?')) return
    await deleteContact(id)
    loadContacts()
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const result = await uploadContacts(file)
    setUploadResult(result)
    loadContacts()
    e.target.value = ''
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Contacts</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> CSV Upload
            <input type="file" accept=".csv" onChange={handleUpload} hidden />
          </label>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={14} /> Add Contact
          </button>
        </div>
      </div>

      {uploadResult && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            CSV imported: <strong>{uploadResult.created}</strong> created, <strong>{uploadResult.skipped}</strong> skipped
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setUploadResult(null)}><X size={12} /></button>
        </div>
      )}

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
              <th>Business</th>
              <th>Tags</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No contacts found</td></tr>
            )}
            {contacts.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td>{c.phone}</td>
                <td>{c.business}</td>
                <td>{c.tags.map(t => <span key={t} className="tag">{t}</span>)}</td>
                <td>
                  {c.opted_out
                    ? <span style={{ color: 'var(--error)', fontSize: 12, fontWeight: 600 }}>Opted Out</span>
                    : <span style={{ color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>Active</span>
                  }
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}><Edit2 size={12} /></button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}><Trash2 size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing ? 'Edit Contact' : 'New Contact'}</h2>
            <div className="form-group">
              <label>Name</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="input" placeholder="+1234567890" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Business</label>
              <input className="input" value={form.business} onChange={e => setForm({ ...form, business: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Tags (comma-separated)</label>
              <input className="input" placeholder="vip, leads, demo" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
