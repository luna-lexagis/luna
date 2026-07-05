// src/lib/casesRepo.ts
import { supabase } from './supabase'
import { caseToRow, rowToCase, rowToMeta, type CaseRow } from './mapping'
import { nuevoCaseData, type Case, type CaseMeta } from '../shared/types'

const META_COLS = 'id,caratula,delito,rol,fase_actual,updated_at'

export async function listCases(): Promise<CaseMeta[]> {
  const { data, error } = await supabase
    .from('cases')
    .select(META_COLS)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToMeta as any)
}

export async function getCase(id: string): Promise<Case | null> {
  const { data, error } = await supabase.from('cases').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToCase(data as CaseRow) : null
}

export async function createCase(): Promise<Case> {
  const insert = {
    caratula: '',
    delito: '',
    rol: 'defensa',
    departamento_judicial: null,
    fase_actual: 'preparacion',
    data: nuevoCaseData(),
  }
  const { data, error } = await supabase.from('cases').insert(insert).select('*').single()
  if (error) throw error
  return rowToCase(data as CaseRow)
}

export async function saveCase(c: Case): Promise<string> {
  const row = caseToRow(c)
  const patch = { ...row, updated_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('cases')
    .update(patch)
    .eq('id', c.id)
    .select('updated_at')
    .single()
  if (error) throw error
  return (data as { updated_at: string }).updated_at
}

export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase.from('cases').delete().eq('id', id)
  if (error) throw error
}
