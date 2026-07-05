# Luna — Plan 2: Audiencia de selección (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build Fase 2 (Audiencia de selección): a 48-aspirant grid with per-aspirant status/notes, live counters, the 4-per-side peremptory-challenge limit, the 12+6 final-panel capacity, and a gender-parity meter — all backed by pure, unit-tested logic.

**Architecture:** All selection RULES live in a framework-free, unit-tested module `src/lib/seleccion.ts` (challenge counting, capacity, parity, validated status transitions). The React component `src/phases/Seleccion.tsx` is a thin view that reads case state and calls `update()` from `useCase`, guarded by the logic module. Replaces `SeleccionPlaceholder` in `CaseView`.

**Tech Stack:** React 19, TypeScript, Vitest. Builds on Plan 1 (types, useCase, theme).

**Spec:** `docs/superpowers/specs/2026-07-05-luna-design.md` §3, §8.

**Legal invariants enforced (spec §3):** 48 aspirants default; **4 peremptory (sin causa) challenges per side, blocked at 0**; con-causa challenges unlimited; final jury **12 titulares + 6 suplentes = 18**; gender parity target; non-discrimination reminder on con-causa.

---

## Task 1: Selection logic module (TDD)

**Files:** Create `src/lib/seleccion.ts`; Test `tests/seleccion.test.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/seleccion.test.ts
import { describe, it, expect } from 'vitest'
import {
  generarAspirantes, perentoriasUsadas, perentoriasRestantes,
  enElJurado, hayCupoJurado, conteoParidad, validarCambioEstado,
  JURADO_TITULARES, JURADO_SUPLENTES, JURADO_TOTAL,
} from '../src/lib/seleccion'
import type { Aspirante } from '../src/shared/types'

const cfg = { aspirantesConvocados: 48, perentoriasPorParte: 4 }

function conEstados(estados: Partial<Record<number, Aspirante['estado']>>, n = 48): Aspirante[] {
  const a = generarAspirantes(n)
  for (const [num, est] of Object.entries(estados)) a[Number(num) - 1].estado = est!
  return a
}

describe('seleccion', () => {
  it('constants: 12 + 6 = 18', () => {
    expect(JURADO_TITULARES).toBe(12)
    expect(JURADO_SUPLENTES).toBe(6)
    expect(JURADO_TOTAL).toBe(18)
  })

  it('generarAspirantes numbers 1..n, all pendiente, unique ids', () => {
    const a = generarAspirantes(48)
    expect(a).toHaveLength(48)
    expect(a[0].numero).toBe(1)
    expect(a[47].numero).toBe(48)
    expect(a.every(x => x.estado === 'pendiente' && x.notas === '')).toBe(true)
    expect(new Set(a.map(x => x.id)).size).toBe(48)
  })

  it('counts peremptory challenges and remaining', () => {
    const a = conEstados({ 1: 'recusado_sin_causa', 2: 'recusado_sin_causa' })
    expect(perentoriasUsadas(a)).toBe(2)
    expect(perentoriasRestantes(cfg, a)).toBe(2)
  })

  it('blocks the 5th peremptory challenge', () => {
    const a = conEstados({ 1: 'recusado_sin_causa', 2: 'recusado_sin_causa', 3: 'recusado_sin_causa', 4: 'recusado_sin_causa' })
    expect(perentoriasRestantes(cfg, a)).toBe(0)
    const r = validarCambioEstado(a, a[4].id, 'recusado_sin_causa', cfg)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/perentoria|sin causa/i)
  })

  it('allows freeing a peremptory by changing away from recusado_sin_causa', () => {
    const a = conEstados({ 1: 'recusado_sin_causa', 2: 'recusado_sin_causa', 3: 'recusado_sin_causa', 4: 'recusado_sin_causa' })
    const r = validarCambioEstado(a, a[0].id, 'favorable', cfg)
    expect(r.ok).toBe(true)
  })

  it('enforces final-jury capacity of 18', () => {
    const full: Record<number, Aspirante['estado']> = {}
    for (let i = 1; i <= 18; i++) full[i] = 'en_el_jurado'
    const a = conEstados(full)
    expect(enElJurado(a)).toHaveLength(18)
    expect(hayCupoJurado(a)).toBe(false)
    const r = validarCambioEstado(a, a[18].id, 'en_el_jurado', cfg)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/jurado|completo|18/i)
  })

  it('allows seating when there is room', () => {
    const a = conEstados({ 1: 'en_el_jurado' })
    expect(hayCupoJurado(a)).toBe(true)
    expect(validarCambioEstado(a, a[1].id, 'en_el_jurado', cfg).ok).toBe(true)
  })

  it('counts gender parity among seated jurors only', () => {
    const a = generarAspirantes(48)
    a[0].estado = 'en_el_jurado'; a[0].genero = 'M'
    a[1].estado = 'en_el_jurado'; a[1].genero = 'F'
    a[2].estado = 'en_el_jurado'; a[2].genero = 'F'
    a[3].estado = 'favorable'; a[3].genero = 'M' // not seated → excluded
    a[4].estado = 'en_el_jurado' // no genero → sinDato
    const p = conteoParidad(a)
    expect(p).toEqual({ M: 1, F: 2, X: 0, sinDato: 1 })
  })

  it('returns ok:false for unknown aspirant id', () => {
    const a = generarAspirantes(4)
    expect(validarCambioEstado(a, 'nope', 'favorable', cfg).ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test -- tests/seleccion.test.ts`
Expected: FAIL — module `src/lib/seleccion` not found.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/seleccion.ts
import type { Aspirante, AspiranteEstado } from '../shared/types'

export const JURADO_TITULARES = 12
export const JURADO_SUPLENTES = 6
export const JURADO_TOTAL = JURADO_TITULARES + JURADO_SUPLENTES // 18

interface Config { aspirantesConvocados: number; perentoriasPorParte: number }

export function generarAspirantes(n: number): Aspirante[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `asp-${i + 1}`,
    numero: i + 1,
    estado: 'pendiente' as AspiranteEstado,
    notas: '',
  }))
}

export function contarPorEstado(aspirantes: Aspirante[], estado: AspiranteEstado): number {
  return aspirantes.filter(a => a.estado === estado).length
}

export function perentoriasUsadas(aspirantes: Aspirante[]): number {
  return contarPorEstado(aspirantes, 'recusado_sin_causa')
}

export function perentoriasRestantes(config: Config, aspirantes: Aspirante[]): number {
  return Math.max(0, config.perentoriasPorParte - perentoriasUsadas(aspirantes))
}

export function enElJurado(aspirantes: Aspirante[]): Aspirante[] {
  return aspirantes.filter(a => a.estado === 'en_el_jurado')
}

export function hayCupoJurado(aspirantes: Aspirante[]): boolean {
  return enElJurado(aspirantes).length < JURADO_TOTAL
}

export interface ParidadConteo { M: number; F: number; X: number; sinDato: number }

export function conteoParidad(aspirantes: Aspirante[]): ParidadConteo {
  const r: ParidadConteo = { M: 0, F: 0, X: 0, sinDato: 0 }
  for (const a of enElJurado(aspirantes)) {
    if (a.genero === 'M') r.M++
    else if (a.genero === 'F') r.F++
    else if (a.genero === 'X') r.X++
    else r.sinDato++
  }
  return r
}

export interface CambioEstadoResult { ok: boolean; error?: string }

export function validarCambioEstado(
  aspirantes: Aspirante[], id: string, nuevo: AspiranteEstado, config: Config,
): CambioEstadoResult {
  const a = aspirantes.find(x => x.id === id)
  if (!a) return { ok: false, error: 'Aspirante no encontrado.' }
  if (a.estado === nuevo) return { ok: true }
  if (nuevo === 'recusado_sin_causa' && perentoriasRestantes(config, aspirantes) <= 0) {
    return { ok: false, error: 'No quedan recusaciones sin causa (perentorias).' }
  }
  if (nuevo === 'en_el_jurado' && !hayCupoJurado(aspirantes)) {
    return { ok: false, error: `El jurado ya está completo (${JURADO_TOTAL}).` }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `npm test -- tests/seleccion.test.ts`
Expected: PASS (9 tests). Also `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/seleccion.ts tests/seleccion.test.ts
git commit -m "feat: selection audience logic (challenges, capacity, parity) with tests"
```

---

## Task 2: Seleccion.tsx UI + wire into CaseView

**Files:** Create `src/phases/Seleccion.tsx`; Modify `src/screens/CaseView.tsx` (use Seleccion instead of SeleccionPlaceholder); Delete `src/phases/SeleccionPlaceholder.tsx`.

- [ ] **Step 1: Build the Seleccion component**

```tsx
// src/phases/Seleccion.tsx
import { useState } from 'react'
import type { Case, Aspirante, AspiranteEstado, Genero } from '../shared/types'
import {
  generarAspirantes, perentoriasRestantes, enElJurado, conteoParidad,
  validarCambioEstado, contarPorEstado, JURADO_TOTAL, JURADO_TITULARES, JURADO_SUPLENTES,
} from '../lib/seleccion'

const ESTADOS: { key: AspiranteEstado; label: string; color: string; struck?: boolean }[] = [
  { key: 'favorable', label: 'Favorable', color: 'var(--favorable)' },
  { key: 'en_el_jurado', label: 'En el jurado', color: 'var(--aceptado)' },
  { key: 'pendiente', label: 'Pendiente', color: 'var(--pend)' },
  { key: 'en_observacion', label: 'En observación', color: 'var(--obs)' },
  { key: 'desfavorable', label: 'Desfavorable', color: 'var(--hostil)' },
  { key: 'recusado_con_causa', label: 'Rec. c/causa', color: 'var(--rec-causa)', struck: true },
  { key: 'recusado_sin_causa', label: 'Rec. s/causa', color: 'var(--rec-sin)', struck: true },
]
const ESTADO_MAP = Object.fromEntries(ESTADOS.map(e => [e.key, e])) as Record<AspiranteEstado, typeof ESTADOS[number]>

export function Seleccion({ caso, update }: { caso: Case; update: (m: (d: Case) => void) => void }) {
  const [selId, setSelId] = useState<string | null>(null)
  const asp = caso.seleccion.aspirantes
  const cfg = caso.seleccion.config

  if (asp.length === 0) {
    return (
      <div style={{ maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--dim)', marginBottom: 16 }}>
          Todavía no generaste el panel. Se crearán {cfg.aspirantesConvocados} aspirantes numerados.
        </p>
        <button className="primary-btn"
          onClick={() => update(d => { d.seleccion.aspirantes = generarAspirantes(cfg.aspirantesConvocados) })}>
          Generar panel de {cfg.aspirantesConvocados} aspirantes
        </button>
      </div>
    )
  }

  const restantes = perentoriasRestantes(cfg, asp)
  const seated = enElJurado(asp).length
  const par = conteoParidad(asp)
  const sel = asp.find(a => a.id === selId) ?? null

  function setEstado(a: Aspirante, nuevo: AspiranteEstado) {
    const r = validarCambioEstado(asp, a.id, nuevo, cfg)
    if (!r.ok) { alert(r.error); return }
    update(d => {
      const t = d.seleccion.aspirantes.find(x => x.id === a.id)!
      t.estado = nuevo
      t.recusadoPor = (nuevo === 'recusado_con_causa' || nuevo === 'recusado_sin_causa') ? d.identificacion.rol : undefined
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%' }}>
      <div style={{ padding: 16, overflow: 'auto', borderRight: '1px solid var(--line)' }}>
        {/* counters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <Counter n={asp.length} label="Aspirantes" />
          <Counter n={`${seated}/${JURADO_TOTAL}`} label={`En jurado (${JURADO_TITULARES}+${JURADO_SUPLENTES})`} />
          <Counter n={restantes} label={`Perent. (${cfg.perentoriasPorParte})`} warn={restantes <= 1} zero={restantes <= 0} />
          <Counter n={contarPorEstado(asp, 'recusado_con_causa')} label="Rec. c/causa" />
        </div>

        {/* parity / final panel */}
        <div style={{ border: '1px dashed var(--line2)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, background: 'var(--panel)' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--accent)', marginBottom: 6 }}>
            PANEL FINAL {JURADO_TITULARES} + {JURADO_SUPLENTES}
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>
            Paridad: ♂ {par.M} / ♀ {par.F}{par.X ? ` / X ${par.X}` : ''}{par.sinDato ? ` · ${par.sinDato} sin género` : ''}
            {seated > 0 && par.M !== par.F ? <span style={{ color: 'var(--obs)' }}> · falta equilibrar</span> : null}
          </div>
        </div>

        {/* legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginBottom: 12, fontSize: 11, color: 'var(--dim)' }}>
          {ESTADOS.map(e => (
            <span key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: e.color }} /> {e.label}
            </span>
          ))}
        </div>

        {/* grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 10 }}>
          {asp.map(a => {
            const e = ESTADO_MAP[a.estado]
            const on = a.id === selId
            return (
              <button key={a.id} onClick={() => setSelId(a.id)}
                style={{
                  position: 'relative', background: 'var(--panel)',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                  borderTop: `3px solid ${e.color}`, borderRadius: 10, padding: '10px 4px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  opacity: e.struck ? 0.55 : 1,
                  boxShadow: on ? '0 0 0 2px rgba(224,164,76,.18)' : 'none',
                }}>
                {a.notas.trim() && <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 8 }} className="mono">✎</span>}
                <span className="mono" style={{ fontSize: 18, fontWeight: 700, textDecoration: e.struck ? 'line-through' : 'none' }}>
                  {String(a.numero).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 9, color: 'var(--dim)' }}>{e.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* editor */}
      <div style={{ padding: 16, overflow: 'auto' }}>
        {!sel ? (
          <div style={{ color: 'var(--faint)', fontSize: 12.5, textAlign: 'center', marginTop: 24 }}>
            Seleccioná un aspirante para tomar notas y marcar su estado.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className="mono" style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', border: `1.5px solid ${ESTADO_MAP[sel.estado].color}`, borderRadius: 10, fontWeight: 700, fontSize: 18 }}>
                {String(sel.numero).padStart(2, '0')}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
                ASPIRANTE<br /><span style={{ fontFamily: 'var(--font)', color: 'var(--text)', fontSize: 14 }}>{ESTADO_MAP[sel.estado].label}</span>
              </div>
            </div>

            <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--faint)', margin: '0 0 6px' }}>ESTADO</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {ESTADOS.map(e => (
                <button key={e.key} onClick={() => setEstado(sel, e.key)}
                  style={{
                    border: `1px solid ${sel.estado === e.key ? e.color : 'var(--line)'}`,
                    background: sel.estado === e.key ? 'color-mix(in srgb, ' + e.color + ' 14%, transparent)' : 'var(--bg)',
                    borderRadius: 8, padding: '7px 6px', fontSize: 11, color: sel.estado === e.key ? 'var(--text)' : 'var(--dim)',
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                  }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color }} /> {e.label}
                </button>
              ))}
            </div>
            {sel.estado === 'recusado_con_causa' && (
              <div style={{ fontSize: 11, color: 'var(--obs)', marginBottom: 10 }}>
                ⚠ La recusación con causa no puede basarse en motivos discriminatorios (art. 338 quáter).
              </div>
            )}

            <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--faint)', margin: '4px 0 6px' }}>DATOS (para paridad)</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input className="inp" placeholder="Nombre (opcional)" value={sel.nombre ?? ''}
                onChange={e => update(d => { d.seleccion.aspirantes.find(x => x.id === sel.id)!.nombre = e.target.value })} />
              <select className="inp" style={{ width: 90 }} value={sel.genero ?? ''}
                onChange={e => update(d => { d.seleccion.aspirantes.find(x => x.id === sel.id)!.genero = (e.target.value || undefined) as Genero })}>
                <option value="">—</option>
                <option value="M">♂</option>
                <option value="F">♀</option>
                <option value="X">X</option>
              </select>
            </div>

            <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--faint)', margin: '4px 0 6px' }}>LO QUE DIJO</div>
            <textarea className="inp" style={{ minHeight: 120, resize: 'vertical' }}
              placeholder="Anotá textual lo que respondió: tono, dudas, contradicciones, vínculos…"
              value={sel.notas}
              onChange={e => update(d => { d.seleccion.aspirantes.find(x => x.id === sel.id)!.notas = e.target.value })} />
          </>
        )}
      </div>
    </div>
  )
}

function Counter({ n, label, warn, zero }: { n: number | string; label: string; warn?: boolean; zero?: boolean }) {
  return (
    <div style={{ background: 'var(--elev)', border: '1px solid var(--line)', borderRadius: 9, padding: '6px 13px', textAlign: 'center', minWidth: 74 }}>
      <div className="mono" style={{ fontWeight: 700, fontSize: 18, lineHeight: 1, color: zero ? 'var(--hostil)' : warn ? 'var(--obs)' : 'var(--text)' }}>{n}</div>
      <div style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 3 }}>{label}</div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into CaseView**

In `src/screens/CaseView.tsx`:
- Replace the import `import { SeleccionPlaceholder } from '../phases/SeleccionPlaceholder'` with `import { Seleccion } from '../phases/Seleccion'`.
- Replace the line `{fase === 'seleccion' && <SeleccionPlaceholder />}` with `{fase === 'seleccion' && <Seleccion caso={caso} update={update} />}`.

Then delete `src/phases/SeleccionPlaceholder.tsx`.

- [ ] **Step 3: Verify build**

Run:
```bash
npx tsc --noEmit
npm run build
npm test
```
Expected: tsc clean; build succeeds; all tests pass (smoke + mapping + seleccion).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Audiencia de selección UI (grid, counters, parity, challenges)"
```

---

## Self-Review (planner)
- **Spec §8 coverage:** 48 grid + generate → Task 2 Step 1. Statuses + notes → Task 2. Counters (aspirants, en jurado X/18, perentorias restantes, rec c/causa) → Task 2. 4-per-side block + unlimited con-causa → Task 1 `validarCambioEstado`/`perentoriasRestantes`. Final panel 12+6 capacity → Task 1 `hayCupoJurado`/`JURADO_TOTAL`. Parity meter → Task 1 `conteoParidad` + Task 2 display. Non-discrimination reminder → Task 2 (con-causa branch).
- **Placeholder scan:** none.
- **Type consistency:** `Aspirante`, `AspiranteEstado`, `Genero` from `shared/types` (Plan 1). `validarCambioEstado`, `perentoriasRestantes`, `enElJurado`, `conteoParidad`, `hayCupoJurado`, `generarAspirantes`, `contarPorEstado`, `JURADO_*` defined in Task 1 and consumed in Task 2. `update` signature matches `useCase`.

## Next
Plan 3 — Debate / perfilado de testigos.
