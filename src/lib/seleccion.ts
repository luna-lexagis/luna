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
