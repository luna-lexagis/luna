// src/components/LunaPanel.tsx
import { useState } from 'react'
import type { Case, Fase, ChatMsg } from '../shared/types'
import { askLuna } from '../lib/luna'
import { buildSystemPrompt } from '../lib/lunaPrompt'

const QUICK: Record<Fase, [string, string][]> = {
  preparacion: [
    ['Perfiles ideales', 'Según mi teoría del caso y el expediente, ¿qué perfil de jurado me conviene y cuál evitar? Fundamentá.'],
    ['¿Dónde flaquea mi teoría?', '¿Qué debilidades tiene mi teoría del caso ante un jurado lego y qué tipo de jurado las expondría?'],
    ['Preguntas de selección', 'Prepará preguntas de voir dire para el panel, alineadas a mi teoría del caso.'],
  ],
  seleccion: [
    ['Prioridades de recusación', 'Ordename por prioridad a quién recusar y por qué, distinguiendo con causa vs. perentoria (me quedan pocas).'],
    ['¿Con o sin causa?', 'Para los aspirantes marcados desfavorables, ¿conviene recusar con causa (con qué fundamento) o gastar una perentoria?'],
    ['Resumen del panel', 'Dame un resumen táctico del estado del panel para mi teoría del caso.'],
  ],
  debate: [
    ['¿Qué contra-pregunto?', 'Para el testigo activo, dame 2-3 preguntas de contraexamen que aprovechen sus contradicciones o debilidades.'],
    ['Contradicciones del panel', 'Cruzá las notas de todos los testigos y listame las contradicciones más útiles para el alegato.'],
    ['Puntos para el alegato', 'Armá un borrador de los puntos fuertes para mi alegato a partir de lo marcado.'],
  ],
}

export function LunaPanel({ caso, fase, update }: { caso: Case; fase: Fase; update: (m: (d: Case) => void) => void }) {
  const [busy, setBusy] = useState(false)
  const chat = caso.chatsLuna[fase]

  async function send(text: string) {
    text = text.trim()
    if (!text || busy) return
    update(d => { d.chatsLuna[fase].push({ role: 'user', content: text }) })
    setBusy(true)
    try {
      const history: ChatMsg[] = [...chat, { role: 'user', content: text }]
      const reply = await askLuna(buildSystemPrompt(caso, fase), history.map(m => ({ role: m.role, content: m.content })))
      update(d => { d.chatsLuna[fase].push({ role: 'assistant', content: reply }) })
    } catch (e: any) {
      update(d => { d.chatsLuna[fase].push({ role: 'assistant', content: 'No pude consultar a Luna (' + (e?.message ?? 'error') + '). Reintentá.', error: true }) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--panel)', borderLeft: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--favorable)' }} />
        <b style={{ fontSize: 13 }}>Luna</b>
        <span className="mono" style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--faint)' }}>{fase}</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {chat.length === 0 && <div style={{ color: 'var(--faint)', fontSize: 12.5, lineHeight: 1.6 }}>Preguntá lo que necesites. Luna ve tu rol, teoría, expediente y el estado de esta fase.</div>}
        {chat.map((m, i) => m.role === 'user'
          ? <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '92%', background: 'var(--accent)', color: '#1a1206', padding: '8px 12px', borderRadius: '12px 12px 3px 12px', fontSize: 13, whiteSpace: 'pre-wrap' }}>{m.content}</div>
          : <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
              <div className="mono" style={{ fontSize: 9, color: 'var(--accent)', letterSpacing: '.1em', marginBottom: 4 }}>LUNA</div>
              <div style={{ background: 'var(--elev)', border: `1px solid ${m.error ? 'var(--hostil)' : 'var(--line)'}`, borderRadius: '3px 12px 12px 12px', padding: '10px 13px', fontSize: 13, whiteSpace: 'pre-wrap', color: m.error ? '#ffbdb5' : 'var(--text)' }}>{m.content}</div>
            </div>)}
        {busy && <div className="mono" style={{ fontSize: 11, color: 'var(--faint)' }}>Luna está pensando…</div>}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 12px 0' }}>
        {QUICK[fase].map(([label, prompt]) => (
          <button key={label} className="ghost-btn" disabled={busy} onClick={() => send(prompt)} style={{ borderRadius: 16, fontSize: 11 }}>{label}</button>
        ))}
      </div>

      <LunaInput busy={busy} onSend={send} />
    </div>
  )
}

function LunaInput({ busy, onSend }: { busy: boolean; onSend: (t: string) => void }) {
  const [text, setText] = useState('')
  return (
    <div style={{ display: 'flex', gap: 8, padding: '10px 12px 14px', alignItems: 'flex-end' }}>
      <textarea className="inp" rows={1} value={text} placeholder="Preguntá algo… (Enter envía)"
        style={{ resize: 'none', maxHeight: 120 }}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(text); setText('') } }} />
      <button className="primary-btn" disabled={busy} onClick={() => { onSend(text); setText('') }} style={{ padding: '9px 14px' }}>→</button>
    </div>
  )
}
