// api/luna.ts — Vercel serverless function (Node runtime). Not part of the Vite build.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' })

  const auth = req.headers.authorization
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autenticado' })

  const supaUrl = process.env.VITE_SUPABASE_URL
  const supaAnon = process.env.VITE_SUPABASE_ANON_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!supaUrl || !supaAnon || !anthropicKey) {
    return res.status(500).json({ error: 'Faltan variables de entorno en el servidor.' })
  }

  const supabase = createClient(supaUrl, supaAnon)
  const { data: userData, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !userData.user) return res.status(401).json({ error: 'Sesión inválida' })

  const { system, messages, max_tokens } = (req.body ?? {}) as {
    system?: unknown; messages?: unknown; max_tokens?: unknown
  }
  if (typeof system !== 'string' || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Payload inválido' })
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey })
  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'
  const cap = Math.min(Math.max(Number(max_tokens) || 1024, 1), 2048)

  try {
    const resp = await anthropic.messages.create({
      model,
      max_tokens: cap,
      system,
      messages: messages as Anthropic.MessageParam[],
    })
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim()
    return res.status(200).json({ text })
  } catch (e: any) {
    return res.status(502).json({ error: 'Error consultando a Luna', detail: e?.message ?? String(e) })
  }
}
