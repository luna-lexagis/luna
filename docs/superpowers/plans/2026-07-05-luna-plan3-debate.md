# Luna — Plan 3: Debate / perfilado de testigos (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build Fase 3 (Debate): profile each witness in real time — roster of witnesses, per-witness tagged note timeline (contradicción / alegato / dato) split by examen directo vs contraexamen, credibility, and two cross-cutting views (Contradicciones, Alegato) aggregated across all witnesses.

**Architecture:** Pure aggregation logic in a unit-tested `src/lib/debate.ts` (filter/collect notes by tag across witnesses, counts). The component `src/phases/Debate.tsx` reads/writes case state via `useCase`'s `update()`. Note creation (ids, timestamps) happens in the component (browser `crypto.randomUUID()` / `new Date()`), not in the pure module. Replaces `DebatePlaceholder` in `CaseView`.

**Tech Stack:** React 19, TypeScript, Vitest. Builds on Plan 1 (types `Testigo`, `NotaTestigo`, `NotaEtiqueta`, `EtapaExamen`; `useCase`; theme).

**Spec:** `docs/superpowers/specs/2026-07-05-luna-design.md` §9.

Data recap (`shared/types.ts`): `Testigo = { id, nombre, ofrecidoPor: 'acusacion'|'defensa', tipo, credibilidad?: 'alta'|'media'|'baja', notas: NotaTestigo[] }`; `NotaTestigo = { id, timestamp, texto, etiqueta: 'dato'|'contradiccion'|'alegato', etapa: 'directo'|'contraexamen' }`.

---

## Task 1: Debate logic module (TDD)

**Files:** Create `src/lib/debate.ts`; Test `tests/debate.test.ts`.

- [ ] **Step 1: Failing tests**

```ts
// tests/debate.test.ts
import { describe, it, expect } from 'vitest'
import { nuevoTestigo, notasPorEtiqueta, contradicciones, puntosAlegato, contarEtiqueta } from '../src/lib/debate'
import type { Testigo, NotaTestigo } from '../src/shared/types'

function nota(texto: string, etiqueta: NotaTestigo['etiqueta']): NotaTestigo {
  return { id: 'n-' + texto, timestamp: '2026-07-05T10:00:00.000Z', texto, etiqueta, etapa: 'contraexamen' }
}

describe('debate', () => {
  it('nuevoTestigo has empty notes and given fields', () => {
    const t = nuevoTestigo('t1', 'Gómez', 'acusacion', 'presencial')
    expect(t).toEqual({ id: 't1', nombre: 'Gómez', ofrecidoPor: 'acusacion', tipo: 'presencial', notas: [] })
  })

  it('notasPorEtiqueta collects across witnesses with their witness attached', () => {
    const a: Testigo = { ...nuevoTestigo('a', 'A', 'acusacion', 'x'), notas: [nota('c1', 'contradiccion'), nota('d1', 'dato')] }
    const b: Testigo = { ...nuevoTestigo('b', 'B', 'defensa', 'x'), notas: [nota('c2', 'contradiccion'), nota('al1', 'alegato')] }
    const cs = contradicciones([a, b])
    expect(cs.map(x => x.nota.texto)).toEqual(['c1', 'c2'])
    expect(cs.map(x => x.testigo.nombre)).toEqual(['A', 'B'])
    expect(puntosAlegato([a, b]).map(x => x.nota.texto)).toEqual(['al1'])
    expect(notasPorEtiqueta([a, b], 'dato').map(x => x.nota.texto)).toEqual(['d1'])
  })

  it('contarEtiqueta counts one witness by tag', () => {
    const a: Testigo = { ...nuevoTestigo('a', 'A', 'acusacion', 'x'), notas: [nota('c1', 'contradiccion'), nota('c2', 'contradiccion'), nota('al', 'alegato')] }
    expect(contarEtiqueta(a, 'contradiccion')).toBe(2)
    expect(contarEtiqueta(a, 'alegato')).toBe(1)
    expect(contarEtiqueta(a, 'dato')).toBe(0)
  })
})
```

- [ ] **Step 2: Run → FAIL** (`npm test -- tests/debate.test.ts`; module missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/debate.ts
import type { Testigo, NotaTestigo, NotaEtiqueta } from '../shared/types'

export function nuevoTestigo(
  id: string, nombre: string, ofrecidoPor: 'acusacion' | 'defensa', tipo: string,
): Testigo {
  return { id, nombre, ofrecidoPor, tipo, notas: [] }
}

export interface NotaConTestigo { testigo: Testigo; nota: NotaTestigo }

export function notasPorEtiqueta(testigos: Testigo[], etiqueta: NotaEtiqueta): NotaConTestigo[] {
  const out: NotaConTestigo[] = []
  for (const t of testigos) {
    for (const n of t.notas) {
      if (n.etiqueta === etiqueta) out.push({ testigo: t, nota: n })
    }
  }
  return out
}

export const contradicciones = (ts: Testigo[]): NotaConTestigo[] => notasPorEtiqueta(ts, 'contradiccion')
export const puntosAlegato = (ts: Testigo[]): NotaConTestigo[] => notasPorEtiqueta(ts, 'alegato')

export function contarEtiqueta(t: Testigo, etiqueta: NotaEtiqueta): number {
  return t.notas.filter(n => n.etiqueta === etiqueta).length
}
```

- [ ] **Step 4: Run → PASS** (3 tests). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/debate.ts tests/debate.test.ts
git commit -m "feat: debate aggregation logic (contradictions, alegato) with tests"
```

---

## Task 2: Debate.tsx UI + wire into CaseView

**Files:** Create `src/phases/Debate.tsx`; Modify `src/screens/CaseView.tsx`; Delete `src/phases/DebatePlaceholder.tsx`.

- [ ] **Step 1: Create the component**

```tsx
// src/phases/Debate.tsx
import { useState } from 'react'
import type { Case, Testigo, NotaEtiqueta, EtapaExamen } from '../shared/types'
import { nuevoTestigo, contradicciones, puntosAlegato, contarEtiqueta, type NotaConTestigo } from '../lib/debate'

const ETIQUETA_COLOR: Record<NotaEtiqueta, string> = {
  dato: 'var(--pend)', contradiccion: 'var(--rec-causa)', alegato: 'var(--accent)',
}
type Vista = 'testigo' | 'contradicciones' | 'alegato'

export function Debate({ caso, update }: { caso: Case; update: (m: (d: Case) => void) => void }) {
  const testigos = caso.debate.testigos
  const [activeId, setActiveId] = useState<string | null>(testigos[0]?.id ?? null)
  const [vista, setVista] = useState<Vista>('testigo')
  const [etapa, setEtapa] = useState<EtapaExamen>('directo')
  const [draft, setDraft] = useState('')
  const [addingNombre, setAddingNombre] = useState('')
  const [addingOfrecido, setAddingOfrecido] = useState<'acusacion' | 'defensa'>('acusacion')
  const [addingTipo, setAddingTipo] = useState('presencial')

  const active = testigos.find(t => t.id === activeId) ?? null

  function addTestigo() {
    if (!addingNombre.trim()) return
    const id = crypto.randomUUID()
    update(d => { d.debate.testigos.push(nuevoTestigo(id, addingNombre.trim(), addingOfrecido, addingTipo)) })
    setAddingNombre(''); setActiveId(id); setVista('testigo')
  }

  function addNota(etiqueta: NotaEtiqueta) {
    if (!active || !draft.trim()) return
    const nota = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), texto: draft.trim(), etiqueta, etapa }
    update(d => { d.debate.testigos.find(t => t.id === active.id)!.notas.push(nota) })
    setDraft('')
  }

  const hhmm = (iso: string) => { const d = new Date(iso); return d.toTimeString().slice(0, 5) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* roster + add */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--panel)', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--dim)' }}>TESTIGOS</span>
        {testigos.map(t => (
          <button key={t.id} onClick={() => { setActiveId(t.id); setVista('testigo') }}
            style={{ border: `1px solid ${activeId === t.id && vista === 'testigo' ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 16, padding: '4px 10px', fontSize: 11, color: 'var(--text)', background: 'var(--bg)' }}>
            {t.nombre} <span style={{ color: 'var(--dim)' }}>· {t.ofrecidoPor === 'acusacion' ? 'acus.' : 'def.'} · {t.notas.length}n</span>
          </button>
        ))}
        <span style={{ display: 'flex', gap: 4 }}>
          <input className="inp" style={{ width: 130, padding: '5px 8px' }} placeholder="+ testigo" value={addingNombre}
            onChange={e => setAddingNombre(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTestigo() }} />
          <select className="inp" style={{ width: 84, padding: '5px 8px' }} value={addingOfrecido} onChange={e => setAddingOfrecido(e.target.value as any)}>
            <option value="acusacion">Acus.</option><option value="defensa">Def.</option>
          </select>
          <input className="inp" style={{ width: 90, padding: '5px 8px' }} placeholder="tipo" value={addingTipo} onChange={e => setAddingTipo(e.target.value)} />
          <button className="ghost-btn" onClick={addTestigo}>Agregar</button>
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <Tab on={vista === 'contradicciones'} onClick={() => setVista('contradicciones')}>Contradicciones ({contradicciones(testigos).length})</Tab>
          <Tab on={vista === 'alegato'} onClick={() => setVista('alegato')}>Alegato ({puntosAlegato(testigos).length})</Tab>
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {vista === 'contradicciones' && <ListaNotas titulo="Contradicciones detectadas" items={contradicciones(testigos)} color={ETIQUETA_COLOR.contradiccion} hhmm={hhmm} />}
        {vista === 'alegato' && <ListaNotas titulo="Puntos para el alegato" items={puntosAlegato(testigos)} color={ETIQUETA_COLOR.alegato} hhmm={hhmm} />}
        {vista === 'testigo' && (!active ? (
          <p style={{ color: 'var(--faint)', textAlign: 'center', marginTop: 32 }}>Agregá un testigo para empezar a perfilar.</p>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {/* identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{active.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                  <span className="mono" style={{ fontSize: 9, letterSpacing: '.5px', padding: '2px 7px', borderRadius: 5, background: active.ofrecidoPor === 'acusacion' ? 'rgba(224,108,94,.15)' : 'rgba(63,182,139,.15)', color: active.ofrecidoPor === 'acusacion' ? 'var(--hostil)' : 'var(--favorable)' }}>
                    OFRECIDO POR {active.ofrecidoPor === 'acusacion' ? 'ACUSACIÓN' : 'DEFENSA'}
                  </span> · {active.tipo}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--dim)' }}>Credibilidad:</span>
                <select className="inp" style={{ width: 90, padding: '5px 8px' }} value={active.credibilidad ?? ''}
                  onChange={e => update(d => { d.debate.testigos.find(t => t.id === active.id)!.credibilidad = (e.target.value || undefined) as any })}>
                  <option value="">—</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                </select>
              </div>
            </div>

            {/* directo / contra */}
            <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: 3, marginBottom: 10 }}>
              {(['directo', 'contraexamen'] as EtapaExamen[]).map(x => (
                <button key={x} onClick={() => setEtapa(x)}
                  style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: etapa === x ? '#1a1206' : 'var(--dim)', background: etapa === x ? 'var(--accent)' : 'transparent' }}>
                  {x === 'directo' ? 'Examen directo' : 'Contraexamen'}
                </button>
              ))}
            </div>

            {/* quick add */}
            <div style={{ marginBottom: 12 }}>
              <textarea className="inp" style={{ minHeight: 54, resize: 'vertical' }} placeholder="Anotá lo que dijo…"
                value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNota('dato') }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="ghost-btn" onClick={() => addNota('dato')}>+ Nota</button>
                <button className="ghost-btn" style={{ borderColor: 'var(--rec-causa)', color: 'var(--hostil)' }} onClick={() => addNota('contradiccion')}>⚑ Contradicción</button>
                <button className="ghost-btn" style={{ borderColor: 'var(--accent-d)', color: 'var(--accent)' }} onClick={() => addNota('alegato')}>★ Alegato</button>
              </div>
            </div>

            {/* timeline */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {active.notas.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 12 }}>Sin notas todavía.</p>}
              {active.notas.map(n => (
                <div key={n.id} style={{ display: 'flex', gap: 9, borderLeft: `2px solid ${ETIQUETA_COLOR[n.etiqueta]}`, padding: '7px 11px', background: n.etiqueta === 'dato' ? 'var(--panel)' : n.etiqueta === 'contradiccion' ? 'rgba(178,59,59,.08)' : 'rgba(224,164,76,.07)', borderRadius: '0 8px 8px 0' }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--faint)' }}>{hhmm(n.timestamp)}</span>
                  <span style={{ fontSize: 12.5, color: '#d5d5c8' }}>
                    {n.etiqueta === 'contradiccion' && <b style={{ color: 'var(--hostil)' }}>⚑ </b>}
                    {n.etiqueta === 'alegato' && <b style={{ color: 'var(--accent)' }}>★ </b>}
                    {n.texto}
                    <span style={{ color: 'var(--faint)', fontSize: 10 }}> · {n.etapa === 'directo' ? 'directo' : 'contra'}</span>
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: 'var(--dim)' }}>
              <span>⚑ {contarEtiqueta(active, 'contradiccion')} contradicciones</span>
              <span>★ {contarEtiqueta(active, 'alegato')} para alegato</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, color: on ? 'var(--accent)' : 'var(--dim)', background: on ? 'rgba(224,164,76,.08)' : 'transparent', border: `1px solid ${on ? 'var(--accent-d)' : 'var(--line)'}` }}>
      {children}
    </button>
  )
}

function ListaNotas({ titulo, items, color, hhmm }: { titulo: string; items: NotaConTestigo[]; color: string; hhmm: (s: string) => string }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--accent)', marginBottom: 12 }}>{titulo.toUpperCase()} ({items.length})</div>
      {items.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 12 }}>Nada marcado todavía.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(({ testigo, nota }) => (
          <div key={nota.id} style={{ borderLeft: `2px solid ${color}`, padding: '8px 12px', background: 'var(--panel)', borderRadius: '0 8px 8px 0' }}>
            <div style={{ fontSize: 12.5, color: '#d5d5c8' }}>{nota.texto}</div>
            <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 3 }}>{testigo.nombre} · {testigo.ofrecidoPor === 'acusacion' ? 'acusación' : 'defensa'} · {nota.etapa} · {hhmm(nota.timestamp)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `src/screens/CaseView.tsx`**
- Replace `import { DebatePlaceholder } from '../phases/DebatePlaceholder'` with `import { Debate } from '../phases/Debate'`.
- Replace `{fase === 'debate' && <DebatePlaceholder />}` with `{fase === 'debate' && <Debate caso={caso} update={update} />}`.
- Delete `src/phases/DebatePlaceholder.tsx` (`rm src/phases/DebatePlaceholder.tsx`).

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npm run build
npm test
```
All must pass (smoke + mapping + seleccion + debate suites).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Debate / witness profiling UI (timeline, tags, contradictions, alegato)"
```

---

## Self-Review (planner)
- **Spec §9 coverage:** roster + add witness → Task 2. Identity + ofrecido-por badge + tipo → Task 2. Directo/contra toggle tagging notes → Task 2 (`etapa`). Tagged timeline (contradicción/alegato/dato) + timestamps → Task 2. Credibility → Task 2. Cross-cutting Contradicciones + Alegato views → Task 1 (`contradicciones`/`puntosAlegato`) + Task 2 `ListaNotas`. Per-witness counts → Task 1 `contarEtiqueta`.
- **Placeholder scan:** none.
- **Type consistency:** `Testigo`, `NotaTestigo`, `NotaEtiqueta`, `EtapaExamen` from `shared/types`. `nuevoTestigo`, `notasPorEtiqueta`, `contradicciones`, `puntosAlegato`, `contarEtiqueta`, `NotaConTestigo` from Task 1, consumed in Task 2. `update` matches `useCase`.

## Next
Plan 4 — Luna (IA): serverless proxy on Vercel holding ANTHROPIC_API_KEY (needs the key), per-phase assistant. Then Plan 5 — export report + polish.
