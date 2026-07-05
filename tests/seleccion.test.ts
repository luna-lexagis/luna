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
    a[3].estado = 'favorable'; a[3].genero = 'M'
    a[4].estado = 'en_el_jurado'
    const p = conteoParidad(a)
    expect(p).toEqual({ M: 1, F: 2, X: 0, sinDato: 1 })
  })

  it('returns ok:false for unknown aspirant id', () => {
    const a = generarAspirantes(4)
    expect(validarCambioEstado(a, 'nope', 'favorable', cfg).ok).toBe(false)
  })
})
