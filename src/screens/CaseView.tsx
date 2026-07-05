// src/screens/CaseView.tsx
import { useCase } from '../hooks/useCase'
import { Preparacion } from '../phases/Preparacion'
import { Seleccion } from '../phases/Seleccion'
import { Debate } from '../phases/Debate'
import { LunaPanel } from '../components/LunaPanel'
import type { Fase } from '../shared/types'

const TABS: { key: Fase; label: string }[] = [
  { key: 'preparacion', label: 'Preparación' },
  { key: 'seleccion', label: 'Audiencia de selección' },
  { key: 'debate', label: 'Debate' },
]

export function CaseView({ id, onBack }: { id: string; onBack: () => void }) {
  const { caso, saveState, update } = useCase(id)
  if (!caso) return <div style={{ padding: 24 }}>Cargando caso…</div>
  const fase = caso.identificacion.faseActual
  const setFase = (f: Fase) => update(d => { d.identificacion.faseActual = f })

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', height: 56,
        background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
        <button className="ghost-btn" onClick={onBack}>← Biblioteca</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
            {caso.identificacion.caratula || '(sin carátula)'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>
            {caso.identificacion.rol === 'defensa' ? 'Defensa' : 'Fiscalía/Querella'}
            {caso.identificacion.delito ? ` · ${caso.identificacion.delito}` : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setFase(t.key)}
              style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13,
                color: fase === t.key ? 'var(--accent)' : 'var(--dim)',
                background: fase === t.key ? 'rgba(224,164,76,.08)' : 'transparent',
                border: fase === t.key ? '1px solid var(--accent-d)' : '1px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: saveState === 'error' ? 'var(--hostil)' : 'var(--faint)', width: 72, textAlign: 'right' }}>
          {saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Guardado' : saveState === 'error' ? 'Error al guardar' : ''}
        </span>
      </header>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', minHeight: 0 }}>
        <main style={{ overflow: 'auto' }}>
          {fase === 'preparacion' && <Preparacion caso={caso} update={update} />}
          {fase === 'seleccion' && <Seleccion caso={caso} update={update} />}
          {fase === 'debate' && <Debate caso={caso} update={update} />}
        </main>
        <LunaPanel caso={caso} fase={fase} update={update} />
      </div>
    </div>
  )
}
