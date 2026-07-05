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
