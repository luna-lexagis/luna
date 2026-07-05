// src/phases/Debate.tsx
import { useState } from 'react'
import type { Case, NotaEtiqueta, EtapaExamen } from '../shared/types'
import { nuevoTestigo, contradicciones, puntosAlegato, contarEtiqueta, type NotaConTestigo } from '../lib/debate'

const ETIQUETA_COLOR: Record<NotaEtiqueta, string> = {
  dato: 'var(--pend)', contradiccion: 'var(--rec-causa)', alegato: 'var(--accent)',
}
type Vista = 'testigo' | 'contradicciones' | 'alegato'

export function Debate({ caso, update }: { caso: Case; update: (m: (d: Case) => void) => void }) {
  const testigos = caso.debate.testigos
  const [activeId, setActiveId] = useState<string | null>(testigos[0]?.id ?? null)
  const [vista, setVista] = useState<Vista>('testigo')
  const [etapa, setEtapa] = useState<EtapaExamen>('directo')
  const [draft, setDraft] = useState('')
  const [addingNombre, setAddingNombre] = useState('')
  const [addingOfrecido, setAddingOfrecido] = useState<'acusacion' | 'defensa'>('acusacion')
  const [addingTipo, setAddingTipo] = useState('presencial')

  const active = testigos.find(t => t.id === activeId) ?? null

  function addTestigo() {
    if (!addingNombre.trim()) return
    const id = crypto.randomUUID()
    update(d => { d.debate.testigos.push(nuevoTestigo(id, addingNombre.trim(), addingOfrecido, addingTipo)) })
    setAddingNombre(''); setActiveId(id); setVista('testigo')
  }

  function addNota(etiqueta: NotaEtiqueta) {
    if (!active || !draft.trim()) return
    const nota = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), texto: draft.trim(), etiqueta, etapa }
    update(d => { d.debate.testigos.find(t => t.id === active.id)!.notas.push(nota) })
    setDraft('')
  }

  const hhmm = (iso: string) => { const d = new Date(iso); return d.toTimeString().slice(0, 5) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--panel)', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--dim)' }}>TESTIGOS</span>
        {testigos.map(t => (
          <button key={t.id} onClick={() => { setActiveId(t.id); setVista('testigo') }}
            style={{ border: `1px solid ${activeId === t.id && vista === 'testigo' ? 'var(--accent)' : 'var(--line)'}`, borderRadius: 16, padding: '4px 10px', fontSize: 11, color: 'var(--text)', background: 'var(--bg)' }}>
            {t.nombre} <span style={{ color: 'var(--dim)' }}>· {t.ofrecidoPor === 'acusacion' ? 'acus.' : 'def.'} · {t.notas.length}n</span>
          </button>
        ))}
        <span style={{ display: 'flex', gap: 4 }}>
          <input className="inp" style={{ width: 130, padding: '5px 8px' }} placeholder="+ testigo" value={addingNombre}
            onChange={e => setAddingNombre(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addTestigo() }} />
          <select className="inp" style={{ width: 84, padding: '5px 8px' }} value={addingOfrecido} onChange={e => setAddingOfrecido(e.target.value as any)}>
            <option value="acusacion">Acus.</option><option value="defensa">Def.</option>
          </select>
          <input className="inp" style={{ width: 90, padding: '5px 8px' }} placeholder="tipo" value={addingTipo} onChange={e => setAddingTipo(e.target.value)} />
          <button className="ghost-btn" onClick={addTestigo}>Agregar</button>
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <Tab on={vista === 'contradicciones'} onClick={() => setVista('contradicciones')}>Contradicciones ({contradicciones(testigos).length})</Tab>
          <Tab on={vista === 'alegato'} onClick={() => setVista('alegato')}>Alegato ({puntosAlegato(testigos).length})</Tab>
        </span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {vista === 'contradicciones' && <ListaNotas titulo="Contradicciones detectadas" items={contradicciones(testigos)} color={ETIQUETA_COLOR.contradiccion} hhmm={hhmm} />}
        {vista === 'alegato' && <ListaNotas titulo="Puntos para el alegato" items={puntosAlegato(testigos)} color={ETIQUETA_COLOR.alegato} hhmm={hhmm} />}
        {vista === 'testigo' && (!active ? (
          <p style={{ color: 'var(--faint)', textAlign: 'center', marginTop: 32 }}>Agregá un testigo para empezar a perfilar.</p>
        ) : (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{active.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                  <span className="mono" style={{ fontSize: 9, letterSpacing: '.5px', padding: '2px 7px', borderRadius: 5, background: active.ofrecidoPor === 'acusacion' ? 'rgba(224,108,94,.15)' : 'rgba(63,182,139,.15)', color: active.ofrecidoPor === 'acusacion' ? 'var(--hostil)' : 'var(--favorable)' }}>
                    OFRECIDO POR {active.ofrecidoPor === 'acusacion' ? 'ACUSACIÓN' : 'DEFENSA'}
                  </span> · {active.tipo}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--dim)' }}>Credibilidad:</span>
                <select className="inp" style={{ width: 90, padding: '5px 8px' }} value={active.credibilidad ?? ''}
                  onChange={e => update(d => { d.debate.testigos.find(t => t.id === active.id)!.credibilidad = (e.target.value || undefined) as any })}>
                  <option value="">—</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 8, padding: 3, marginBottom: 10 }}>
              {(['directo', 'contraexamen'] as EtapaExamen[]).map(x => (
                <button key={x} onClick={() => setEtapa(x)}
                  style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, color: etapa === x ? '#1a1206' : 'var(--dim)', background: etapa === x ? 'var(--accent)' : 'transparent' }}>
                  {x === 'directo' ? 'Examen directo' : 'Contraexamen'}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <textarea className="inp" style={{ minHeight: 54, resize: 'vertical' }} placeholder="Anotá lo que dijo…"
                value={draft} onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNota('dato') }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button className="ghost-btn" onClick={() => addNota('dato')}>+ Nota</button>
                <button className="ghost-btn" style={{ borderColor: 'var(--rec-causa)', color: 'var(--hostil)' }} onClick={() => addNota('contradiccion')}>⚑ Contradicción</button>
                <button className="ghost-btn" style={{ borderColor: 'var(--accent-d)', color: 'var(--accent)' }} onClick={() => addNota('alegato')}>★ Alegato</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {active.notas.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 12 }}>Sin notas todavía.</p>}
              {active.notas.map(n => (
                <div key={n.id} style={{ display: 'flex', gap: 9, borderLeft: `2px solid ${ETIQUETA_COLOR[n.etiqueta]}`, padding: '7px 11px', background: n.etiqueta === 'dato' ? 'var(--panel)' : n.etiqueta === 'contradiccion' ? 'rgba(178,59,59,.08)' : 'rgba(224,164,76,.07)', borderRadius: '0 8px 8px 0' }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--faint)' }}>{hhmm(n.timestamp)}</span>
                  <span style={{ fontSize: 12.5, color: '#d5d5c8' }}>
                    {n.etiqueta === 'contradiccion' && <b style={{ color: 'var(--hostil)' }}>⚑ </b>}
                    {n.etiqueta === 'alegato' && <b style={{ color: 'var(--accent)' }}>★ </b>}
                    {n.texto}
                    <span style={{ color: 'var(--faint)', fontSize: 10 }}> · {n.etapa === 'directo' ? 'directo' : 'contra'}</span>
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: 'var(--dim)' }}>
              <span>⚑ {contarEtiqueta(active, 'contradiccion')} contradicciones</span>
              <span>★ {contarEtiqueta(active, 'alegato')} para alegato</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, color: on ? 'var(--accent)' : 'var(--dim)', background: on ? 'rgba(224,164,76,.08)' : 'transparent', border: `1px solid ${on ? 'var(--accent-d)' : 'var(--line)'}` }}>
      {children}
    </button>
  )
}

function ListaNotas({ titulo, items, color, hhmm }: { titulo: string; items: NotaConTestigo[]; color: string; hhmm: (s: string) => string }) {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--accent)', marginBottom: 12 }}>{titulo.toUpperCase()} ({items.length})</div>
      {items.length === 0 && <p style={{ color: 'var(--faint)', fontSize: 12 }}>Nada marcado todavía.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(({ testigo, nota }) => (
          <div key={nota.id} style={{ borderLeft: `2px solid ${color}`, padding: '8px 12px', background: 'var(--panel)', borderRadius: '0 8px 8px 0' }}>
            <div style={{ fontSize: 12.5, color: '#d5d5c8' }}>{nota.texto}</div>
            <div style={{ fontSize: 10, color: 'var(--faint)', marginTop: 3 }}>{testigo.nombre} · {testigo.ofrecidoPor === 'acusacion' ? 'acusación' : 'defensa'} · {nota.etapa} · {hhmm(nota.timestamp)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
