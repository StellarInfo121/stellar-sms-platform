import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { MessageSquare, Megaphone, Users, BarChart3, Settings as SettingsIcon, ChevronDown, Zap } from 'lucide-react'
import { getProvider, setProvider as setProviderApi, getDailyCount } from './api'
import Inbox from './pages/Inbox'
import Campaigns from './pages/Campaigns'
import CampaignDetail from './pages/CampaignDetail'
import Contacts from './pages/Contacts'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import './App.css'

function App() {
  const [provider, setActiveProvider] = useState('twilio')
  const [providerOpen, setProviderOpen] = useState(false)
  const [dailyCount, setDailyCount] = useState({ count: 0, limit: 4000 })

  useEffect(() => {
    getProvider().then(r => setActiveProvider(r.provider))
    getDailyCount().then(setDailyCount).catch(() => {})
    const interval = setInterval(() => getDailyCount().then(setDailyCount).catch(() => {}), 30000)
    return () => clearInterval(interval)
  }, [])

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
          <div className="daily-counter">
            <Zap size={14} />
            <span>{dailyCount.count} / {dailyCount.limit} today</span>
          </div>
          <div className="provider-selector-wrap">
            <button className="provider-toggle" onClick={() => setProviderOpen(!providerOpen)}>
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
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Inbox provider={provider} />} />
          <Route path="/campaigns" element={<Campaigns provider={provider} />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings provider={provider} />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
