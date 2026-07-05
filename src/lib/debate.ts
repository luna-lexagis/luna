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
