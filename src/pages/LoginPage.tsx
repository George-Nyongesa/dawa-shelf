import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../features/auth/AuthProvider'

export default function LoginPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <main style={{ maxWidth: 360, margin: '15vh auto', padding: 24, fontFamily: 'system-ui' }}>
      <h1>Dawa Shelf</h1>
      <p>Sign in to your pharmacy.</p>
      <form onSubmit={onSubmit}>
        <label>Email<br />
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                 required autoComplete="email" style={{ width: '100%', padding: 10 }} />
        </label>
        <br /><br />
        <label>Password<br />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                 required autoComplete="current-password" style={{ width: '100%', padding: 10 }} />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ marginTop: 16, padding: '10px 16px' }}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}