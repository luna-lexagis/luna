// src/screens/Login.tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const fn = mode === 'in'
      ? supabase.auth.signInWithPassword({ email, password: pass })
      : supabase.auth.signUp({ email, password: pass })
    const { error } = await fn
    if (error) setMsg(error.message)
    else if (mode === 'up') setMsg('Cuenta creada. Revisá tu email si pide confirmación, o iniciá sesión.')
    setBusy(false)
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <form onSubmit={submit} style={{
        width: 340, background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 14, padding: 24,
      }}>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 2 }}>Luna</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 18 }}>
          {mode === 'in' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
        </div>
        <label>Email</label>
        <input className="inp" type="email" value={email} required
          onChange={e => setEmail(e.target.value)} style={{ marginBottom: 12 }} />
        <label>Contraseña</label>
        <input className="inp" type="password" value={pass} required minLength={6}
          onChange={e => setPass(e.target.value)} style={{ marginBottom: 16 }} />
        <button className="primary-btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? '…' : mode === 'in' ? 'Entrar' : 'Registrarme'}
        </button>
        {msg && <p style={{ color: 'var(--obs)', fontSize: 12, marginTop: 12 }}>{msg}</p>}
        <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
          style={{ color: 'var(--dim)', fontSize: 12, marginTop: 14 }}>
          {mode === 'in' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </form>
    </div>
  )
}
