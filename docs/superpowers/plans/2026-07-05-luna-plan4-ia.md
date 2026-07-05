# Luna — Plan 4: Luna (IA) (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Wire the AI assistant "Luna" end to end: a Vercel serverless function proxies to Anthropic with the API key kept server-side and the user's Supabase session validated; a client sends a per-phase system prompt + chat; a Luna panel (chat + quick actions) lives in the case view; and Preparación gets a working "Detectar perfiles con Luna".

**Architecture:** The **system prompt is built on the client** from case state (pure, unit-tested `buildSystemPrompt`), so all prompt logic is testable and the serverless function stays generic. The function `/api/luna.ts` (Vercel Node function) verifies the caller's Supabase JWT, then calls Anthropic via the official SDK with a capped `max_tokens`. Chat history persists per phase in `caso.chatsLuna`.

**Tech Stack:** `@anthropic-ai/sdk`, `@supabase/supabase-js`, `@vercel/node` (types), React 19/TS, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-05-luna-design.md` §10.

**Model:** `claude-opus-4-8` by default, overridable via `ANTHROPIC_MODEL` env var. No `thinking` param (omitted → runs without thinking on Opus 4.8, lower latency) + a "final answer only" instruction in the system prompt to avoid leaked reasoning. Non-streaming, `max_tokens` ≤ 2048.

**Server env vars (Vercel):** `ANTHROPIC_API_KEY` (secret, server-side — NOT `VITE_`-prefixed), plus the existing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (readable in the function via `process.env`).

> **Local note:** `vite` alone does not run `/api` functions. Test the AI on the Vercel deployment/preview, or run `vercel dev` locally with the env vars set. The rest of the app runs under `npm run dev` as before.

---

## Task 1: Prompt builder (TDD) + client + serverless function

**Files:** Create `src/lib/lunaPrompt.ts` (+ test `tests/lunaPrompt.test.ts`), `src/lib/luna.ts`, `api/luna.ts`; add dev dep `@vercel/node`.

- [ ] **Step 1: Failing tests for the prompt builder**

```ts
// tests/lunaPrompt.test.ts
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from '../src/lib/lunaPrompt'
import type { Case } from '../src/shared/types'
import { nuevoCaseData } from '../src/shared/types'
import { generarAspirantes } from '../src/lib/seleccion'

function baseCase(): Case {
  const d = nuevoCaseData()
  d.teoriaDelCaso.teoria = 'Legítima defensa'
  return {
    id: 'c1', creado: 'x', ultimaEdicion: 'x',
    identificacion: { caratula: 'F c/ Pérez', delito: 'homicidio', rol: 'defensa', faseActual: 'preparacion' },
    teoriaDelCaso: d.teoriaDelCaso, perfiles: d.perfiles, seleccion: d.seleccion, debate: d.debate, chatsLuna: d.chatsLuna,
  }
}

describe('buildSystemPrompt', () => {
  it('includes role, theory, and the non-discrimination rule', () => {
    const p = buildSystemPrompt(baseCase(), 'preparacion')
    expect(p).toMatch(/DEFENSA/)
    expect(p).toContain('Legítima defensa')
    expect(p.toLowerCase()).toContain('discriminatorios')
  })

  it('for seleccion includes the panel and remaining peremptory challenges', () => {
    const c = baseCase()
    c.seleccion.aspirantes = generarAspirantes(48)
    c.seleccion.aspirantes[0].estado = 'recusado_sin_causa'
    c.seleccion.aspirantes[1].estado = 'favorable'
    c.seleccion.aspirantes[1].notas = 'hermano policía'
    const p = buildSystemPrompt(c, 'seleccion')
    expect(p).toMatch(/restantes:\s*3/i)
    expect(p).toContain('hermano policía')
    expect(p).toMatch(/#2 \[favorable\]/)
  })

  it('for debate includes witness notes with their tags', () => {
    const c = baseCase()
    c.debate.testigos = [{
      id: 't1', nombre: 'Gómez', ofrecidoPor: 'acusacion', tipo: 'presencial',
      notas: [{ id: 'n1', timestamp: 'x', texto: 'no tenía lentes', etiqueta: 'alegato', etapa: 'contraexamen' }],
    }]
    const p = buildSystemPrompt(c, 'debate')
    expect(p).toContain('Gómez')
    expect(p).toContain('no tenía lentes')
    expect(p.toLowerCase()).toContain('alegato')
  })

  it('for fiscalia role reflects the prosecution stance', () => {
    const c = baseCase(); c.identificacion.rol = 'fiscalia_querella'
    expect(buildSystemPrompt(c, 'preparacion')).toMatch(/FISCAL[IÍ]A/)
  })
})
```

- [ ] **Step 2: Run → FAIL** (`npm test -- tests/lunaPrompt.test.ts`).

- [ ] **Step 3: Implement the prompt builder**

```ts
// src/lib/lunaPrompt.ts
import type { Case, Fase } from '../shared/types'
import { perentoriasRestantes } from './seleccion'

export function buildSystemPrompt(caso: Case, fase: Fase): string {
  const esDefensa = caso.identificacion.rol === 'defensa'
  const rol = esDefensa
    ? 'la DEFENSA (preservás la duda razonable y filtrás jurados con sesgo punitivista o pre-juicio de culpabilidad)'
    : 'la FISCALÍA/QUERELLA (buscás firmeza y un jurado que sostenga el estándar probatorio sin sobre-empatizar indebidamente con el imputado)'

  const base = `Sos "Luna", asistente estratégico de una PARTE en un JUICIO POR JURADOS de la Provincia de Buenos Aires (Ley 14.543). Asistís a ${rol}.

Reglas:
- Español rioplatense, directo, sin preámbulo, breve y accionable.
- Respondé SOLO con tu conclusión final. No escribas tu razonamiento paso a paso ni frases como "voy a analizar".
- Distinguí SIEMPRE recusación con causa (fundada, ilimitada, requiere motivo concreto de parcialidad) de recusación sin causa / perentoria (limitada, sin fundar).
- No inventes hechos del expediente ni datos de un aspirante o testigo: usá solo lo cargado. Si falta info, decí qué preguntar.
- Nunca sugieras recusar por motivos discriminatorios (está prohibido por el art. 338 quáter).

=== CASO ===
Carátula: ${caso.identificacion.caratula || '—'}
Delito: ${caso.identificacion.delito || '—'}
Represento a: ${esDefensa ? 'Defensa' : 'Fiscalía/Querella'}
Teoría del caso: ${caso.teoriaDelCaso.teoria || '(no cargada)'}
Expediente: ${caso.teoriaDelCaso.expediente || '(no cargado)'}
Perfil buscado: ${caso.perfiles.buscado || '(no especificado)'}
Perfil a evitar: ${caso.perfiles.evitar || '(no especificado)'}`

  if (fase === 'seleccion') {
    const a = caso.seleccion.aspirantes
    const rest = perentoriasRestantes(caso.seleccion.config, a)
    const panel = a.length === 0
      ? 'El panel todavía no se generó.'
      : a.map(x => `#${x.numero} [${x.estado}]${x.notas.trim() ? ' — ' + x.notas.trim() : ''}`).join('\n')
    return `${base}

=== AUDIENCIA DE SELECCIÓN ===
Recusaciones sin causa restantes: ${rest} de ${caso.seleccion.config.perentoriasPorParte}
PANEL:
${panel}`
  }

  if (fase === 'debate') {
    const ts = caso.debate.testigos
    const bloque = ts.length === 0
      ? 'Sin testigos cargados.'
      : ts.map(x =>
          `TESTIGO ${x.nombre} (ofrecido por ${x.ofrecidoPor}${x.credibilidad ? ', credibilidad ' + x.credibilidad : ''}):\n` +
          (x.notas.length ? x.notas.map(n => `  - [${n.etiqueta}/${n.etapa}] ${n.texto}`).join('\n') : '  (sin notas)')
        ).join('\n')
    return `${base}

=== DEBATE / TESTIGOS ===
${bloque}`
  }

  return base
}
```

- [ ] **Step 4: Run → PASS** (`npm test -- tests/lunaPrompt.test.ts`). `npx tsc --noEmit` clean.

- [ ] **Step 5: Client caller**

```ts
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
```

- [ ] **Step 6: Serverless function**

Install types:
```bash
npm install -D @vercel/node
```

Create `api/luna.ts`:
```ts
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

  // Validate the Supabase session so the API key can't be used anonymously.
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
```

- [ ] **Step 7: Verify build + commit** (the Vite build excludes `api/` because `tsconfig.app.json` includes only `src`; Vercel compiles the function separately)

```bash
npx tsc --noEmit
npm run build
npm test
git add -A
git commit -m "feat: Luna AI — prompt builder (tested), client, and serverless proxy"
```

---

## Task 2: Luna panel + wire into CaseView + Detectar perfiles

**Files:** Create `src/components/LunaPanel.tsx`; Modify `src/screens/CaseView.tsx` (add the panel column); Modify `src/phases/Preparacion.tsx` (Detectar perfiles button).

- [ ] **Step 1: LunaPanel**

```tsx
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
```

- [ ] **Step 2: Add the Luna column in `src/screens/CaseView.tsx`**

Import at top:
```tsx
import { LunaPanel } from '../components/LunaPanel'
```
Wrap the `<main>` content and the panel in a 2-column layout. Replace the existing `<main>...</main>` block with:
```tsx
<div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', minHeight: 0 }}>
  <main style={{ overflow: 'auto' }}>
    {fase === 'preparacion' && <Preparacion caso={caso} update={update} />}
    {fase === 'seleccion' && <Seleccion caso={caso} update={update} />}
    {fase === 'debate' && <Debate caso={caso} update={update} />}
  </main>
  <LunaPanel caso={caso} fase={fase} update={update} />
</div>
```

- [ ] **Step 3: "Detectar perfiles con Luna" in `src/phases/Preparacion.tsx`**

Add imports:
```tsx
import { useState } from 'react'
import { askLuna } from '../lib/luna'
import { buildSystemPrompt } from '../lib/lunaPrompt'
```
Add a new `<section style={card}>` after the "Teoría del caso" / "Datos clave" sections (before "Panel"):
```tsx
<section style={card}>
  <div style={title}>Perfiles de jurado</div>
  <DetectarPerfiles caso={caso} update={update} />
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
    <div>
      <label>Perfil que busco</label>
      <textarea className="inp" style={{ minHeight: 70, resize: 'vertical' }} value={caso.perfiles.buscado}
        onChange={e => update(d => { d.perfiles.buscado = e.target.value })} placeholder="(lo completa Luna, editable)" />
    </div>
    <div>
      <label>Perfil a evitar</label>
      <textarea className="inp" style={{ minHeight: 70, resize: 'vertical' }} value={caso.perfiles.evitar}
        onChange={e => update(d => { d.perfiles.evitar = e.target.value })} placeholder="(lo completa Luna, editable)" />
    </div>
  </div>
</section>
```
And define `DetectarPerfiles` at the bottom of the file:
```tsx
function DetectarPerfiles({ caso, update }: { caso: Case; update: (m: (d: Case) => void) => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function run() {
    if (!caso.teoriaDelCaso.teoria.trim() && !caso.teoriaDelCaso.expediente.trim()) {
      setErr('Cargá primero la teoría del caso o los datos del expediente.'); return
    }
    setBusy(true); setErr(null)
    try {
      const system = buildSystemPrompt(caso, 'preparacion')
      const instruccion = 'A partir de la teoría del caso y el expediente, definí qué PERFIL de jurado conviene buscar y cuál evitar (rasgos, actitudes, sesgos previsibles). Respondé SOLO con un objeto JSON válido, sin markdown, con esta forma exacta: {"buscado":"...","evitar":"..."}. Cada valor: 2-4 frases concretas.'
      const raw = await askLuna(system, [{ role: 'user', content: instruccion }], 700)
      const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
      const obj = JSON.parse(clean)
      update(d => { d.perfiles.buscado = obj.buscado || ''; d.perfiles.evitar = obj.evitar || '' })
    } catch (e: any) {
      setErr('No pude detectar los perfiles (' + (e?.message ?? 'error') + '). Reintentá.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <button className="ghost-btn" disabled={busy} onClick={run} style={{ borderColor: 'var(--accent-d)', color: 'var(--accent)' }}>
        {busy ? 'Analizando el caso…' : '✦ Detectar perfiles con Luna'}
      </button>
      {err && <div style={{ color: 'var(--hostil)', fontSize: 11.5, marginTop: 6 }}>{err}</div>}
    </div>
  )
}
```
> `Case` is already imported in Preparacion.tsx.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npm run build
npm test
```
All green (build excludes `api/`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: Luna panel (chat + quick actions per phase) and Detectar perfiles"
```

---

## Self-Review (planner)
- **Spec §10 coverage:** serverless proxy holding the key + session validation → Task 1 `api/luna.ts`. Per-phase context (rol, teoría, expediente, perfiles, panel/testigos) → Task 1 `buildSystemPrompt` (tested). Spanish/rioplatense, con/sin causa distinction, no invented facts, non-discrimination → prompt rules. Offline/error handling → `askLuna` throw + panel error bubble. Model id (not `claude-sonnet-4-6`) → `claude-opus-4-8` default, `ANTHROPIC_MODEL` override. Chat per phase → `caso.chatsLuna`. Detectar perfiles → Task 2 Step 3.
- **Placeholder scan:** none.
- **Type consistency:** `Case`, `Fase`, `ChatMsg` from shared/types; `buildSystemPrompt` (Task 1) consumed by `LunaPanel` + `DetectarPerfiles`; `askLuna`/`LunaMsg` (Task 1) consumed in Task 2. Function reads `VITE_SUPABASE_URL/ANON_KEY` + `ANTHROPIC_API_KEY` from `process.env`.

## Deploy checklist (after merge/push)
- Vercel env var **`ANTHROPIC_API_KEY`** must be set (server-side, Production+Preview). If the user named it differently, rename to `ANTHROPIC_API_KEY`.
- Optional: `ANTHROPIC_MODEL` to override the model.
- The `/api/luna` function deploys automatically with the Vite app on Vercel.

## Next
Plan 5 — export report + polish.
