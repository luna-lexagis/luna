// src/screens/Library.tsx
import { useCaseList } from '../hooks/useCaseList'
import { supabase } from '../lib/supabase'

const ROL_LABEL: Record<string, string> = { defensa: 'Defensa', fiscalia_querella: 'Fiscalía/Querella' }
const FASE_LABEL: Record<string, string> = { preparacion: 'Preparación', seleccion: 'Selección', debate: 'Debate' }

export function Library({ onOpen }: { onOpen: (id: string) => void }) {
  const { cases, loading, error, create, remove } = useCaseList()
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Luna</h1>
          <div className="mono" style={{ color: 'var(--dim)', fontSize: 12 }}>BIBLIOTECA DE CASOS</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="ghost-btn" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
          <button className="primary-btn" onClick={async () => onOpen(await create())}>+ Nuevo caso</button>
        </div>
      </div>
      {error && <p style={{ color: 'var(--hostil)' }}>{error}</p>}
      {loading ? <p style={{ color: 'var(--faint)' }}>Cargando…</p>
        : cases.length === 0 ? <p style={{ color: 'var(--faint)' }}>Todavía no hay casos. Creá el primero.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cases.map(c => (
              <div key={c.id} onClick={() => onOpen(c.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{c.caratula || '(sin carátula)'}</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {ROL_LABEL[c.rol]} · {c.delito || 'sin delito'} · {FASE_LABEL[c.faseActual]}
                  </div>
                </div>
                <button className="ghost-btn" style={{ marginLeft: 'auto' }}
                  onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar este caso?')) void remove(c.id) }}>
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
