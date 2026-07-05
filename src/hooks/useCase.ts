// src/hooks/useCase.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Case } from '../shared/types'
import { getCase, saveCase } from '../lib/casesRepo'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function useCase(id: string) {
  const [caso, setCaso] = useState<Case | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    void getCase(id).then(c => { if (alive) setCaso(c) })
    return () => { alive = false }
  }, [id])

  const update = useCallback((mutator: (draft: Case) => void) => {
    setCaso(prev => {
      if (!prev) return prev
      const next: Case = structuredClone(prev)
      mutator(next)
      if (timer.current) clearTimeout(timer.current)
      setSaveState('saving')
      timer.current = setTimeout(async () => {
        try {
          const stamp = await saveCase(next)
          setCaso(cur => (cur ? { ...cur, ultimaEdicion: stamp } : cur))
          setSaveState('saved')
        } catch {
          setSaveState('error')
        }
      }, 600)
      return next
    })
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { caso, saveState, update }
}
