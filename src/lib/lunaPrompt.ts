// src/lib/lunaPrompt.ts
import type { Case, Fase } from '../shared/types'
import { perentoriasRestantes } from './seleccion'

export function buildSystemPrompt(caso: Case, fase: Fase): string {
  const esDefensa = caso.identificacion.rol === 'defensa'
  const rol = esDefensa
    ? 'la DEFENSA (preservás la duda razonable y filtrás jurados con sesgo punitivista o pre-juicio de culpabilidad)'
    : 'la FISCALÍA/QUERELLA (buscás firmeza y un jurado que sostenga el estándar probatorio sin sobre-empatizar indebidamente con el imputado)'

  const base = `Sos "Luna", asistente estratégico de una PARTE en un JUICIO POR JURADOS de la Provincia de Buenos Aires (Ley 14.543). Asistís a ${rol}.

Reglas:
- Español rioplatense, directo, sin preámbulo, breve y accionable.
- Respondé SOLO con tu conclusión final. No escribas tu razonamiento paso a paso ni frases como "voy a analizar".
- Distinguí SIEMPRE recusación con causa (fundada, ilimitada, requiere motivo concreto de parcialidad) de recusación sin causa / perentoria (limitada, sin fundar).
- No inventes hechos del expediente ni datos de un aspirante o testigo: usá solo lo cargado. Si falta info, decí qué preguntar.
- Nunca sugieras recusar por motivos discriminatorios (está prohibido por el art. 338 quáter).

=== CASO ===
Carátula: ${caso.identificacion.caratula || '—'}
Delito: ${caso.identificacion.delito || '—'}
Represento a: ${esDefensa ? 'Defensa' : 'Fiscalía/Querella'}
Teoría del caso: ${caso.teoriaDelCaso.teoria || '(no cargada)'}
Expediente: ${caso.teoriaDelCaso.expediente || '(no cargado)'}
Perfil buscado: ${caso.perfiles.buscado || '(no especificado)'}
Perfil a evitar: ${caso.perfiles.evitar || '(no especificado)'}`

  if (fase === 'seleccion') {
    const a = caso.seleccion.aspirantes
    const rest = perentoriasRestantes(caso.seleccion.config, a)
    const panel = a.length === 0
      ? 'El panel todavía no se generó.'
      : a.map(x => `#${x.numero} [${x.estado}]${x.notas.trim() ? ' — ' + x.notas.trim() : ''}`).join('\n')
    return `${base}

=== AUDIENCIA DE SELECCIÓN ===
Recusaciones sin causa restantes: ${rest} de ${caso.seleccion.config.perentoriasPorParte}
PANEL:
${panel}`
  }

  if (fase === 'debate') {
    const ts = caso.debate.testigos
    const bloque = ts.length === 0
      ? 'Sin testigos cargados.'
      : ts.map(x =>
          `TESTIGO ${x.nombre} (ofrecido por ${x.ofrecidoPor}${x.credibilidad ? ', credibilidad ' + x.credibilidad : ''}):\n` +
          (x.notas.length ? x.notas.map(n => `  - [${n.etiqueta}/${n.etapa}] ${n.texto}`).join('\n') : '  (sin notas)')
        ).join('\n')
    return `${base}

=== DEBATE / TESTIGOS ===
${bloque}`
  }

  return base
}
