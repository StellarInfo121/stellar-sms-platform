import { useState, useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { MessageSquare, Users, Megaphone, Rocket, BarChart3, ChevronDown } from 'lucide-react'
import { getProvider, setProvider } from './api'
import Messages from './pages/Messages'
import Contacts from './pages/Contacts'
import Campaigns from './pages/Campaigns'
import Blasts from './pages/Blasts'
import Analytics from './pages/Analytics'
import './App.css'

function App() {
  const [provider, setActiveProvider] = useState('twilio')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    getProvider().then(r => setActiveProvider(r.provider))
  }, [])

  const switchProvider = async (p) => {
    await setProvider(p)
    setActiveProvider(p)
    setDropdownOpen(false)
  }

  const navItems = [
    { to: '/', icon: <MessageSquare size={18} />, label: 'Messages' },
    { to: '/contacts', icon: <Users size={18} />, label: 'Contacts' },
    { to: '/campaigns', icon: <Megaphone size={18} />, label: 'Campaigns' },
    { to: '/blasts', icon: <Rocket size={18} />, label: 'Blasts' },
    { to: '/analytics', icon: <BarChart3 size={18} />, label: 'Analytics' },
  ]

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">S</div>
          <span>Stellar SMS</span>
        </div>

        <div className="provider-selector">
          <button
            className="provider-btn"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span className={`provider-dot ${provider}`} />
            <span className="provider-label">
              {provider === 'twilio' ? 'Twilio' : 'SignalWire'}
            </span>
            <ChevronDown size={14} />
          </button>
          {dropdownOpen && (
            <div className="provider-dropdown">
              <button
                className={`provider-option ${provider === 'twilio' ? 'active' : ''}`}
                onClick={() => switchProvider('twilio')}
              >
                <span className="provider-dot twilio" />
                Twilio
                <span className="provider-phone">+1 (561) 468-3646</span>
              </button>
              <button
                className={`provider-option ${provider === 'signalwire' ? 'active' : ''}`}
                onClick={() => switchProvider('signalwire')}
              >
                <span className="provider-dot signalwire" />
                SignalWire
                <span className="provider-phone">+1 (954) 501-2597</span>
              </button>
            </div>
          )}
        </div>

        <div className="nav-links">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="active-badge">
            <span className={`provider-dot ${provider}`} />
            Active: {provider === 'twilio' ? 'Twilio' : 'SignalWire'}
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Messages provider={provider} />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/campaigns" element={<Campaigns provider={provider} />} />
          <Route path="/blasts" element={<Blasts provider={provider} />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </>
  )
}

export default App
