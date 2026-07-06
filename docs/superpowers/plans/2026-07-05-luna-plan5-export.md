# Luna — Plan 5: Exportar informe + pulido (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let the user export a case as a readable report (for the alegato / archive) and as JSON. A pure, unit-tested `buildReportText` assembles the report from case state; an Export modal offers Copy, Download .txt, and Download .json.

**Architecture:** Report generation is a pure function reusing the tested selección/debate helpers; the UI is a small modal opened from the case header. No backend.

**Tech Stack:** React 19/TS, Vitest. Builds on Plans 1–4.

**Spec:** `docs/superpowers/specs/2026-07-05-luna-design.md` §6, §15.

---

## Task 1: Report builder (TDD)

**Files:** Create `src/lib/report.ts`; Test `tests/report.test.ts`.

- [ ] **Step 1: Failing tests**

```ts
// tests/report.test.ts
import { describe, it, expect } from 'vitest'
import { buildReportText } from '../src/lib/report'
import type { Case } from '../src/shared/types'
import { nuevoCaseData } from '../src/shared/types'
import { generarAspirantes } from '../src/lib/seleccion'

function sample(): Case {
  const d = nuevoCaseData()
  d.teoriaDelCaso.teoria = 'Legítima defensa'
  d.seleccion.aspirantes = generarAspirantes(48)
  d.seleccion.aspirantes[0].estado = 'en_el_jurado'; d.seleccion.aspirantes[0].genero = 'F'; d.seleccion.aspirantes[0].nombre = 'Ana'
  d.seleccion.aspirantes[1].estado = 'recusado_sin_causa'
  d.debate.testigos = [{
    id: 't1', nombre: 'Gómez', ofrecidoPor: 'acusacion', tipo: 'presencial', credibilidad: 'baja',
    notas: [
      { id: 'n1', timestamp: '2026-07-05T10:00:00.000Z', texto: 'ubicación contradictoria', etiqueta: 'contradiccion', etapa: 'contraexamen' },
      { id: 'n2', timestamp: '2026-07-05T10:05:00.000Z', texto: 'sin lentes', etiqueta: 'alegato', etapa: 'contraexamen' },
    ],
  }]
  return {
    id: 'c1', creado: '2026-07-05T09:00:00.000Z', ultimaEdicion: '2026-07-05T11:00:00.000Z',
    identificacion: { caratula: 'F c/ Pérez', delito: 'homicidio', rol: 'defensa', departamentoJudicial: 'San Martín', faseActual: 'debate' },
    teoriaDelCaso: d.teoriaDelCaso, perfiles: d.perfiles, seleccion: d.seleccion, debate: d.debate, chatsLuna: d.chatsLuna,
  }
}

describe('buildReportText', () => {
  it('includes identification and theory', () => {
    const r = buildReportText(sample())
    expect(r).toContain('F c/ Pérez')
    expect(r).toContain('Defensa')
    expect(r).toContain('Legítima defensa')
  })

  it('includes the seated juror and peremptory usage', () => {
    const r = buildReportText(sample())
    expect(r).toContain('Ana')
    expect(r).toMatch(/Recusaciones sin causa usadas:\s*1/i)
  })

  it('includes witnesses, contradictions and alegato points', () => {
    const r = buildReportText(sample())
    expect(r).toContain('Gómez')
    expect(r).toContain('ubicación contradictoria')
    expect(r).toContain('sin lentes')
  })
})
```

- [ ] **Step 2: Run → FAIL** (`npm test -- tests/report.test.ts`).

- [ ] **Step 3: Implement**

```ts
// src/lib/report.ts
import type { Case } from '../shared/types'
import { perentoriasUsadas, enElJurado, conteoParidad, contarPorEstado } from './seleccion'
import { contradicciones, puntosAlegato } from './debate'

const ROL_LABEL = { defensa: 'Defensa', fiscalia_querella: 'Fiscalía/Querella' } as const

export function buildReportText(caso: Case): string {
  const id = caso.identificacion
  const s = caso.seleccion
  const L: string[] = []

  L.push('LUNA — INFORME DEL CASO')
  L.push('='.repeat(40))
  L.push(`Carátula: ${id.caratula || '—'}`)
  L.push(`Delito: ${id.delito || '—'}`)
  L.push(`Represento a: ${ROL_LABEL[id.rol]}`)
  if (id.departamentoJudicial) L.push(`Departamento judicial: ${id.departamentoJudicial}`)
  L.push('')

  L.push('TEORÍA DEL CASO')
  L.push(caso.teoriaDelCaso.teoria.trim() || '(no cargada)')
  L.push('')
  L.push('DATOS DEL EXPEDIENTE')
  L.push(caso.teoriaDelCaso.expediente.trim() || '(no cargados)')
  L.push('')
  L.push('PERFILES')
  L.push(`Perfil buscado: ${caso.perfiles.buscado.trim() || '(no especificado)'}`)
  L.push(`Perfil a evitar: ${caso.perfiles.evitar.trim() || '(no especificado)'}`)
  L.push('')

  L.push('AUDIENCIA DE SELECCIÓN')
  L.push(`Aspirantes: ${s.aspirantes.length}`)
  L.push(`Recusaciones sin causa usadas: ${perentoriasUsadas(s.aspirantes)} de ${s.config.perentoriasPorParte}`)
  L.push(`Recusaciones con causa: ${contarPorEstado(s.aspirantes, 'recusado_con_causa')}`)
  const seated = enElJurado(s.aspirantes)
  const par = conteoParidad(s.aspirantes)
  L.push(`Jurado (${seated.length}): ${seated.map(a => `#${a.numero}${a.nombre ? ' ' + a.nombre : ''}`).join(', ') || '—'}`)
  L.push(`Paridad del jurado: ♂ ${par.M} / ♀ ${par.F}${par.X ? ` / X ${par.X}` : ''}${par.sinDato ? ` (· ${par.sinDato} sin género)` : ''}`)
  L.push('')

  L.push('TESTIGOS')
  if (caso.debate.testigos.length === 0) {
    L.push('(sin testigos)')
  } else {
    for (const t of caso.debate.testigos) {
      L.push(`• ${t.nombre} — ofrecido por ${t.ofrecidoPor}${t.credibilidad ? `, credibilidad ${t.credibilidad}` : ''}`)
      for (const n of t.notas) L.push(`    [${n.etiqueta}/${n.etapa}] ${n.texto}`)
    }
  }
  L.push('')

  const cs = contradicciones(caso.debate.testigos)
  L.push('CONTRADICCIONES')
  L.push(cs.length ? cs.map(({ testigo, nota }) => `• ${nota.texto} (${testigo.nombre})`).join('\n') : '(ninguna marcada)')
  L.push('')

  const al = puntosAlegato(caso.debate.testigos)
  L.push('PUNTOS PARA EL ALEGATO')
  L.push(al.length ? al.map(({ testigo, nota }) => `• ${nota.texto} (${testigo.nombre})`).join('\n') : '(ninguno marcado)')

  return L.join('\n')
}
```

- [ ] **Step 4: Run → PASS** (3 tests). `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/report.ts tests/report.test.ts
git commit -m "feat: case report builder (alegato/archive) with tests"
```

---

## Task 2: Export modal + button in CaseView

**Files:** Create `src/components/ExportModal.tsx`; Modify `src/screens/CaseView.tsx` (Exportar button in the header).

- [ ] **Step 1: ExportModal**

```tsx
// src/components/ExportModal.tsx
import { useState } from 'react'
import type { Case } from '../shared/types'
import { buildReportText } from '../lib/report'

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

function slug(s: string) {
  return (s || 'caso').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'caso'
}

export function ExportModal({ caso, onClose }: { caso: Case; onClose: () => void }) {
  const report = buildReportText(caso)
  const [copied, setCopied] = useState(false)
  const base = slug(caso.identificacion.caratula)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(760px, 92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <b style={{ fontSize: 14 }}>Exportar caso</b>
          <button className="ghost-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>Cerrar</button>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <button className="primary-btn" onClick={() => { navigator.clipboard.writeText(report).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>
            {copied ? '✓ Copiado' : 'Copiar informe'}
          </button>
          <button className="ghost-btn" onClick={() => download(`${base}.txt`, report, 'text/plain;charset=utf-8')}>Descargar .txt</button>
          <button className="ghost-btn" onClick={() => download(`${base}.json`, JSON.stringify(caso, null, 2), 'application/json')}>Descargar .json</button>
        </div>
        <pre style={{ margin: 0, padding: 16, overflow: 'auto', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{report}</pre>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire into `src/screens/CaseView.tsx`**

Add imports at top:
```tsx
import { useState } from 'react'
import { ExportModal } from '../components/ExportModal'
```
> If `CaseView.tsx` already imports `useState` from React, do not duplicate the import — just ensure `useState` is imported.

Inside `CaseView`, after the `const { caso, saveState, update } = useCase(id)` line (and the `if (!caso) return ...` guard), add:
```tsx
const [showExport, setShowExport] = useState(false)
```
In the header, add an "Exportar" button just before the tabs `<div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>` — change that div to not consume all the left margin, and insert the button. Concretely, add this button immediately before the phase-tabs container:
```tsx
<button className="ghost-btn" style={{ marginLeft: 'auto' }} onClick={() => setShowExport(true)}>Exportar</button>
```
and remove `marginLeft: 'auto'` from the tabs container's style (so the Exportar button owns the left margin and the tabs sit to its right). If simpler, wrap the Exportar button + tabs + save indicator in one flex row with `marginLeft: 'auto'`.

At the end of the returned JSX (before the closing `</div>` of the root), render the modal:
```tsx
{showExport && caso && <ExportModal caso={caso} onClose={() => setShowExport(false)} />}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npm run build
npm test
```
All green (report suite + the previous 5 suites).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: export modal (copy report, download .txt/.json)"
```

---

## Self-Review (planner)
- **Spec §6 coverage:** export a case as readable report + JSON → Task 1 `buildReportText`, Task 2 download buttons. Report includes identificación, teoría, perfiles, panel/paridad/recusaciones, testigos, contradicciones, alegato → Task 1.
- **Placeholder scan:** none.
- **Type consistency:** reuses `perentoriasUsadas/enElJurado/conteoParidad/contarPorEstado` (seleccion.ts) and `contradicciones/puntosAlegato` (debate.ts); `buildReportText` consumed by `ExportModal`; `Case` from shared/types.

## Roadmap complete
Plans 1–5 delivered: foundation, selección, debate, Luna IA, export. Post-launch polish (keyboard shortcuts refinements, PWA/offline, more provinces, PDF upload in Preparación) can be scoped as follow-ups.
