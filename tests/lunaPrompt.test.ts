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
