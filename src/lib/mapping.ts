// src/lib/mapping.ts
import type { Case, CaseData, CaseMeta, Rol, Fase } from '../shared/types'

export interface CaseRow {
  id: string
  created_at: string
  updated_at: string
  caratula: string
  delito: string
  rol: Rol
  departamento_judicial: string | null
  fase_actual: Fase
  data: CaseData
}

export function rowToCase(r: CaseRow): Case {
  return {
    id: r.id,
    creado: r.created_at,
    ultimaEdicion: r.updated_at,
    identificacion: {
      caratula: r.caratula,
      delito: r.delito,
      rol: r.rol,
      departamentoJudicial: r.departamento_judicial ?? undefined,
      faseActual: r.fase_actual,
    },
    teoriaDelCaso: r.data.teoriaDelCaso,
    perfiles: r.data.perfiles,
    seleccion: r.data.seleccion,
    debate: r.data.debate,
    chatsLuna: r.data.chatsLuna,
  }
}

export function caseToRow(c: Case): Omit<CaseRow, 'created_at' | 'updated_at'> {
  return {
    id: c.id,
    caratula: c.identificacion.caratula,
    delito: c.identificacion.delito,
    rol: c.identificacion.rol,
    departamento_judicial: c.identificacion.departamentoJudicial ?? null,
    fase_actual: c.identificacion.faseActual,
    data: {
      teoriaDelCaso: c.teoriaDelCaso,
      perfiles: c.perfiles,
      seleccion: c.seleccion,
      debate: c.debate,
      chatsLuna: c.chatsLuna,
    },
  }
}

export function rowToMeta(r: Pick<CaseRow,
  'id' | 'caratula' | 'delito' | 'rol' | 'fase_actual' | 'updated_at'>): CaseMeta {
  return {
    id: r.id,
    caratula: r.caratula,
    delito: r.delito,
    rol: r.rol,
    faseActual: r.fase_actual,
    ultimaEdicion: r.updated_at,
  }
}
