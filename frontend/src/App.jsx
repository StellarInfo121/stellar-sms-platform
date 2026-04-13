import { useState, useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { MessageSquare, Megaphone, Users, BarChart3, Settings as SettingsIcon, ChevronDown, Zap, LogOut, User } from 'lucide-react'
import { getMe, getUsers, getProvider, setProvider as setProviderApi, getDailyCount, setViewAsUser } from './api'
import Login from './pages/Login'
import Inbox from './pages/Inbox'
import Campaigns from './pages/Campaigns'
import CampaignDetail from './pages/CampaignDetail'
import Contacts from './pages/Contacts'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import './App.css'

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState(null)
  const [provider, setActiveProvider] = useState('twilio')
  const [providerOpen, setProviderOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [dailyCount, setDailyCount] = useState({ count: 0, limit: 4000 })
  const [devMode, setDevMode] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [viewAs, setViewAs] = useState('all')
  const [viewAsOpen, setViewAsOpen] = useState(false)

  useEffect(() => {
    // Check URL for auth errors
    const params = new URLSearchParams(window.location.search)
    const err = params.get('auth_error')
    if (err) {
      setAuthError(err)
      window.history.replaceState({}, '', '/')
    }

    // Check auth
    getMe()
      .then(user => {
        setCurrentUser(user)
        setAuthLoading(false)
      })
      .catch(() => {
        setAuthLoading(false)
        // Check if dev mode (placeholder OAuth)
        fetch('/auth/dev-login/0').then(r => {
          if (r.status !== 403) setDevMode(true)
        }).catch(() => {})
      })
  }, [])

  useEffect(() => {
    if (!currentUser) return
    getProvider().then(r => setActiveProvider(r.provider))
    getDailyCount().then(setDailyCount).catch(() => {})
    if (currentUser.role === 'admin') {
      getUsers().then(setAllUsers).catch(() => {})
    }
    const interval = setInterval(() => getDailyCount().then(setDailyCount).catch(() => {}), 30000)
    return () => clearInterval(interval)
  }, [currentUser])

  const handleViewAs = (userId) => {
    setViewAs(userId)
    setViewAsUser(userId === 'all' ? null : userId)
    setViewAsOpen(false)
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F5F5' }}>
        <div style={{ textAlign: 'center', color: '#999' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#9B7FBF', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 18 }}>S</div>
          Loading...
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return <Login error={authError} devMode={devMode} />
  }

  const switchProvider = async (p) => {
    await setProviderApi(p)
    setActiveProvider(p)
    setProviderOpen(false)
  }

  const navItems = [
    { to: '/', icon: <MessageSquare size={18} />, label: 'INBOX' },
    { to: '/campaigns', icon: <Megaphone size={18} />, label: 'CAMPAIGNS' },
    { to: '/contacts', icon: <Users size={18} />, label: 'CONTACTS' },
    { to: '/analytics', icon: <BarChart3 size={18} />, label: 'ANALYTICS' },
    { to: '/settings', icon: <SettingsIcon size={18} />, label: 'SETTINGS' },
  ]

  const initials = currentUser.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <div className="app-layout">
      <header className="top-nav">
        <div className="top-nav-left">
          <div className="brand">
            <div className="brand-icon">S</div>
            <span className="brand-text">Stellar SMS</span>
          </div>
          <nav className="nav-tabs">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="top-nav-right">
          {currentUser.role === 'admin' && (
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-sm"
                onClick={() => { setViewAsOpen(!viewAsOpen); setProviderOpen(false); setUserMenuOpen(false) }}
                style={{
                  background: viewAs !== 'all' ? '#EDE5F5' : '#F5F5F5',
                  color: viewAs !== 'all' ? '#7C5CAF' : '#666',
                  border: '1px solid #E5E5E5', fontSize: 12, fontWeight: 500,
                }}
              >
                Viewing: {viewAs === 'all' ? 'All Reps' : allUsers.find(u => u.id === viewAs)?.name || 'All'}
                <ChevronDown size={12} />
              </button>
              {viewAsOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 34, minWidth: 180,
                  background: '#FFF', border: '1px solid #E5E5E5', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200, overflow: 'hidden',
                }}>
                  <div onClick={() => handleViewAs('all')} style={{
                    padding: '8px 14px', cursor: 'pointer', fontSize: 13, fontWeight: viewAs === 'all' ? 600 : 400,
                    background: viewAs === 'all' ? '#EDE5F5' : 'transparent', color: viewAs === 'all' ? '#7C5CAF' : '#1A1A1A',
                    borderBottom: '1px solid #E5E5E5',
                  }}>All Reps</div>
                  {allUsers.map(u => (
                    <div key={u.id} onClick={() => handleViewAs(u.id)} style={{
                      padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                      fontWeight: viewAs === u.id ? 600 : 400,
                      background: viewAs === u.id ? '#EDE5F5' : 'transparent',
                      color: viewAs === u.id ? '#7C5CAF' : '#1A1A1A',
                    }}
                      onMouseEnter={e => { if (viewAs !== u.id) e.currentTarget.style.background = '#FAFAFA' }}
                      onMouseLeave={e => { if (viewAs !== u.id) e.currentTarget.style.background = 'transparent' }}
                    >{u.name}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="daily-counter">
            <Zap size={14} />
            <span>{dailyCount.count} / {dailyCount.limit} today</span>
          </div>
          <div className="provider-selector-wrap">
            <button className="provider-toggle" onClick={() => { setProviderOpen(!providerOpen); setUserMenuOpen(false) }}>
              <span className={`dot ${provider}`} />
              {provider === 'twilio' ? 'Twilio' : 'SignalWire'}
              <ChevronDown size={14} />
            </button>
            {providerOpen && (
              <div className="provider-dropdown">
                <button className={`prov-opt ${provider === 'twilio' ? 'active' : ''}`} onClick={() => switchProvider('twilio')}>
                  <span className="dot twilio" /> Twilio <span className="prov-phone">+1 (561) 468-3646</span>
                </button>
                <button className={`prov-opt ${provider === 'signalwire' ? 'active' : ''}`} onClick={() => switchProvider('signalwire')}>
                  <span className="dot signalwire" /> SignalWire <span className="prov-phone">+1 (954) 501-2597</span>
                </button>
              </div>
            )}
          </div>
          {/* User menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setUserMenuOpen(!userMenuOpen); setProviderOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 8px', borderRadius: 6, border: 'none',
                background: 'none', cursor: 'pointer', color: '#1A1A1A',
              }}
            >
              {currentUser.avatar_url ? (
                <img src={currentUser.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%' }} />
              ) : (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', background: '#9B7FBF',
                  color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                }}>
                  {initials}
                </div>
              )}
              <span style={{ fontSize: 13, fontWeight: 500, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.name}
              </span>
              <ChevronDown size={12} />
            </button>
            {userMenuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 42, minWidth: 200,
                background: '#FFFFFF', border: '1px solid #E5E5E5',
                borderRadius: 8, overflow: 'hidden', zIndex: 200,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #E5E5E5' }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{currentUser.name}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{currentUser.email}</div>
                  <div style={{ fontSize: 11, color: '#9B7FBF', marginTop: 2, textTransform: 'uppercase', fontWeight: 600 }}>{currentUser.role}</div>
                </div>
                <a
                  href="/auth/logout"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', color: '#EF4444', fontSize: 13,
                    textDecoration: 'none', fontWeight: 500,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={14} /> Sign Out
                </a>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="app-main" onClick={() => { setProviderOpen(false); setUserMenuOpen(false) }}>
        <Routes>
          <Route path="/" element={<Inbox provider={provider} currentUser={currentUser} />} />
          <Route path="/campaigns" element={<Campaigns provider={provider} />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings provider={provider} currentUser={currentUser} />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
