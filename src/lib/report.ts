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
