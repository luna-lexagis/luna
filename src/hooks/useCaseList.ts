// src/hooks/useCaseList.ts
import { useCallback, useEffect, useState } from 'react'
import type { CaseMeta } from '../shared/types'
import { listCases, createCase, deleteCase } from '../lib/casesRepo'

export function useCaseList() {
  const [cases, setCases] = useState<CaseMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try { setCases(await listCases()) }
    catch (e: any) { setError(e.message ?? 'Error al cargar casos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const create = useCallback(async () => {
    const c = await createCase(); await refresh(); return c.id
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await deleteCase(id); await refresh()
  }, [refresh])

  return { cases, loading, error, refresh, create, remove }
}
