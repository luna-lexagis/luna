// tests/mapping.test.ts
import { describe, it, expect } from 'vitest'
import { caseToRow, rowToCase, type CaseRow } from '../src/lib/mapping'
import type { Case } from '../src/shared/types'
import { nuevoCaseData } from '../src/shared/types'

function sampleCase(): Case {
  const d = nuevoCaseData()
  d.teoriaDelCaso.teoria = 'Legítima defensa'
  return {
    id: 'c1',
    creado: '2026-07-05T10:00:00.000Z',
    ultimaEdicion: '2026-07-05T10:00:00.000Z',
    identificacion: {
      caratula: 'F. c/ Pérez', delito: 'homicidio', rol: 'defensa',
      departamentoJudicial: 'San Martín', faseActual: 'preparacion',
    },
    teoriaDelCaso: d.teoriaDelCaso, perfiles: d.perfiles,
    seleccion: d.seleccion, debate: d.debate, chatsLuna: d.chatsLuna,
  }
}

describe('mapping', () => {
  it('round-trips Case -> row -> Case', () => {
    const c = sampleCase()
    const partialRow = caseToRow(c)
    const row: CaseRow = { ...partialRow, created_at: c.creado, updated_at: c.ultimaEdicion }
    expect(rowToCase(row)).toEqual(c)
  })

  it('maps null departamento_judicial to undefined', () => {
    const c = sampleCase()
    c.identificacion.departamentoJudicial = undefined
    const row: CaseRow = { ...caseToRow(c), created_at: c.creado, updated_at: c.ultimaEdicion }
    expect(row.departamento_judicial).toBeNull()
    expect(rowToCase(row).identificacion.departamentoJudicial).toBeUndefined()
  })

  it('preserves default panel config (48 / 4)', () => {
    const c = sampleCase()
    const row: CaseRow = { ...caseToRow(c), created_at: c.creado, updated_at: c.ultimaEdicion }
    expect(row.data.seleccion.config).toEqual({ aspirantesConvocados: 48, perentoriasPorParte: 4 })
  })
})
