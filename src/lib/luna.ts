// src/lib/luna.ts
import { supabase } from './supabase'

export interface LunaMsg { role: 'user' | 'assistant'; content: string }

export async function askLuna(system: string, messages: LunaMsg[], maxTokens = 1024): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('No hay sesión activa.')
  const res = await fetch('/api/luna', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ system, messages, max_tokens: maxTokens }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Error ${res.status}`)
  }
  const { text } = await res.json()
  return (text as string) || '(sin respuesta)'
}
