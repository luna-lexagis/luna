// src/shared/types.ts
export type Rol = 'defensa' | 'fiscalia_querella'

export type AspiranteEstado =
  | 'pendiente' | 'favorable' | 'en_observacion' | 'desfavorable'
  | 'recusado_con_causa' | 'recusado_sin_causa' | 'en_el_jurado'

export type Genero = 'M' | 'F' | 'X'

export interface Aspirante {
  id: string
  numero: number
  nombre?: string
  genero?: Genero
  estado: AspiranteEstado
  notas: string
  recusadoPor?: Rol
}

export type NotaEtiqueta = 'dato' | 'contradiccion' | 'alegato'
export type EtapaExamen = 'directo' | 'contraexamen'

export interface NotaTestigo {
  id: string
  timestamp: string
  texto: string
  etiqueta: NotaEtiqueta
  etapa: EtapaExamen
}

export interface Testigo {
  id: string
  nombre: string
  ofrecidoPor: 'acusacion' | 'defensa'
  tipo: string
  credibilidad?: 'alta' | 'media' | 'baja'
  notas: NotaTestigo[]
}

export type Fase = 'preparacion' | 'seleccion' | 'debate'

export interface ChatMsg { role: 'user' | 'assistant'; content: string; error?: boolean }

/** The nested part that lives in the JSONB `data` column. */
export interface CaseData {
  teoriaDelCaso: { teoria: string; expediente: string }
  perfiles: { buscado: string; evitar: string }
  seleccion: {
    config: { aspirantesConvocados: number; perentoriasPorParte: number }
    aspirantes: Aspirante[]
  }
  debate: { testigos: Testigo[] }
  chatsLuna: { preparacion: ChatMsg[]; seleccion: ChatMsg[]; debate: ChatMsg[] }
}

export interface Case {
  id: string
  creado: string
  ultimaEdicion: string
  identificacion: {
    caratula: string
    delito: string
    rol: Rol
    departamentoJudicial?: string
    faseActual: Fase
  }
  teoriaDelCaso: CaseData['teoriaDelCaso']
  perfiles: CaseData['perfiles']
  seleccion: CaseData['seleccion']
  debate: CaseData['debate']
  chatsLuna: CaseData['chatsLuna']
}

export interface CaseMeta {
  id: string
  caratula: string
  delito: string
  rol: Rol
  faseActual: Fase
  ultimaEdicion: string
}

/** Fresh case data with legally-correct defaults (48 aspirants, 4 peremptory challenges). */
export function nuevoCaseData(): CaseData {
  return {
    teoriaDelCaso: { teoria: '', expediente: '' },
    perfiles: { buscado: '', evitar: '' },
    seleccion: { config: { aspirantesConvocados: 48, perentoriasPorParte: 4 }, aspirantes: [] },
    debate: { testigos: [] },
    chatsLuna: { preparacion: [], seleccion: [], debate: [] },
  }
}
