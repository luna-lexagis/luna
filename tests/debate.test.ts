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
