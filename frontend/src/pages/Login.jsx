import { useState, useEffect } from 'react'
import { getUsers } from '../api'

export default function Login({ error, devMode }) {
  const [devUsers, setDevUsers] = useState([])

  useEffect(() => {
    if (devMode) {
      getUsers().then(setDevUsers).catch(() => {})
    }
  }, [devMode])

  const errorMessages = {
    access_denied: 'Access denied. Your email is not in the system. Contact your administrator.',
    cancelled: 'Sign in was cancelled.',
    invalid_state: 'Invalid session state. Please try again.',
    token_failed: 'Authentication failed. Please try again.',
    userinfo_failed: 'Could not retrieve your account info. Please try again.',
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F5F5F5',
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 12, padding: '48px 40px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: 420, width: '100%',
        textAlign: 'center', border: '1px solid #E5E5E5',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
          background: '#9B7FBF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontSize: 24, fontWeight: 800,
        }}>
          S
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A1A', marginBottom: 4 }}>
          Stellar Advance
        </h1>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 32 }}>
          SMS Platform
        </p>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
            padding: '12px 16px', marginBottom: 24, fontSize: 13, color: '#991B1B',
            textAlign: 'left',
          }}>
            {errorMessages[error] || 'An error occurred. Please try again.'}
          </div>
        )}

        <a
          href="/auth/google"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '12px 24px', borderRadius: 8, border: '1px solid #E5E5E5',
            background: '#FFFFFF', color: '#1A1A1A', fontSize: 14, fontWeight: 600,
            textDecoration: 'none', transition: 'all 0.15s', cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#9B7FBF'; e.currentTarget.style.background = '#FAFAFA' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E5E5'; e.currentTarget.style.background = '#FFFFFF' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/>
            <path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" fill="#34A853"/>
            <path d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z" fill="#FBBC05"/>
            <path d="M8.98 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A8 8 0 0 0 1.83 5.41l2.67 2.07A4.8 4.8 0 0 1 8.98 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </a>

        {devMode && devUsers.length > 0 && (
          <div style={{ marginTop: 24, borderTop: '1px solid #E5E5E5', paddingTop: 20 }}>
            <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
              Dev Mode — Quick Login
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {devUsers.map(u => (
                <a
                  key={u.id}
                  href={`/auth/dev-login/${u.id}`}
                  style={{
                    padding: '8px 12px', borderRadius: 6, border: '1px solid #E5E5E5',
                    fontSize: 13, color: '#1A1A1A', textDecoration: 'none', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F5F0FA'}
                  onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                >
                  <span>{u.name}</span>
                  <span style={{ color: '#999', fontSize: 11 }}>{u.role}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <p style={{ marginTop: 32, fontSize: 12, color: '#999' }}>
          Only authorized team members can access this platform.
        </p>
      </div>
    </div>
  )
}
