// src/phases/Seleccion.tsx
import { useState } from 'react'
import type { Case, Aspirante, AspiranteEstado, Genero } from '../shared/types'
import {
  generarAspirantes, perentoriasRestantes, enElJurado, conteoParidad,
  validarCambioEstado, contarPorEstado, JURADO_TOTAL, JURADO_TITULARES, JURADO_SUPLENTES,
} from '../lib/seleccion'

const ESTADOS: { key: AspiranteEstado; label: string; color: string; struck?: boolean }[] = [
  { key: 'favorable', label: 'Favorable', color: 'var(--favorable)' },
  { key: 'en_el_jurado', label: 'En el jurado', color: 'var(--aceptado)' },
  { key: 'pendiente', label: 'Pendiente', color: 'var(--pend)' },
  { key: 'en_observacion', label: 'En observación', color: 'var(--obs)' },
  { key: 'desfavorable', label: 'Desfavorable', color: 'var(--hostil)' },
  { key: 'recusado_con_causa', label: 'Rec. c/causa', color: 'var(--rec-causa)', struck: true },
  { key: 'recusado_sin_causa', label: 'Rec. s/causa', color: 'var(--rec-sin)', struck: true },
]
const ESTADO_MAP = Object.fromEntries(ESTADOS.map(e => [e.key, e])) as Record<AspiranteEstado, typeof ESTADOS[number]>

export function Seleccion({ caso, update }: { caso: Case; update: (m: (d: Case) => void) => void }) {
  const [selId, setSelId] = useState<string | null>(null)
  const asp = caso.seleccion.aspirantes
  const cfg = caso.seleccion.config

  if (asp.length === 0) {
    return (
      <div style={{ maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
        <p style={{ color: 'var(--dim)', marginBottom: 16 }}>
          Todavía no generaste el panel. Se crearán {cfg.aspirantesConvocados} aspirantes numerados.
        </p>
        <button className="primary-btn"
          onClick={() => update(d => { d.seleccion.aspirantes = generarAspirantes(cfg.aspirantesConvocados) })}>
          Generar panel de {cfg.aspirantesConvocados} aspirantes
        </button>
      </div>
    )
  }

  const restantes = perentoriasRestantes(cfg, asp)
  const seated = enElJurado(asp).length
  const par = conteoParidad(asp)
  const sel = asp.find(a => a.id === selId) ?? null

  function setEstado(a: Aspirante, nuevo: AspiranteEstado) {
    const r = validarCambioEstado(asp, a.id, nuevo, cfg)
    if (!r.ok) { alert(r.error); return }
    update(d => {
      const t = d.seleccion.aspirantes.find(x => x.id === a.id)!
      t.estado = nuevo
      t.recusadoPor = (nuevo === 'recusado_con_causa' || nuevo === 'recusado_sin_causa') ? d.identificacion.rol : undefined
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', height: '100%' }}>
      <div style={{ padding: 16, overflow: 'auto', borderRight: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <Counter n={asp.length} label="Aspirantes" />
          <Counter n={`${seated}/${JURADO_TOTAL}`} label={`En jurado (${JURADO_TITULARES}+${JURADO_SUPLENTES})`} />
          <Counter n={restantes} label={`Perent. (${cfg.perentoriasPorParte})`} warn={restantes <= 1} zero={restantes <= 0} />
          <Counter n={contarPorEstado(asp, 'recusado_con_causa')} label="Rec. c/causa" />
        </div>

        <div style={{ border: '1px dashed var(--line2)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, background: 'var(--panel)' }}>
          <div className="mono" style={{ fontSize: 10, letterSpacing: '.1em', color: 'var(--accent)', marginBottom: 6 }}>
            PANEL FINAL {JURADO_TITULARES} + {JURADO_SUPLENTES}
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)' }}>
            Paridad: ♂ {par.M} / ♀ {par.F}{par.X ? ` / X ${par.X}` : ''}{par.sinDato ? ` · ${par.sinDato} sin género` : ''}
            {seated > 0 && par.M !== par.F ? <span style={{ color: 'var(--obs)' }}> · falta equilibrar</span> : null}
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginBottom: 12, fontSize: 11, color: 'var(--dim)' }}>
          {ESTADOS.map(e => (
            <span key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: e.color }} /> {e.label}
            </span>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 10 }}>
          {asp.map(a => {
            const e = ESTADO_MAP[a.estado]
            const on = a.id === selId
            return (
              <button key={a.id} onClick={() => setSelId(a.id)}
                style={{
                  position: 'relative', background: 'var(--panel)',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                  borderTop: `3px solid ${e.color}`, borderRadius: 10, padding: '10px 4px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  opacity: e.struck ? 0.55 : 1,
                  boxShadow: on ? '0 0 0 2px rgba(224,164,76,.18)' : 'none',
                }}>
                {a.notas.trim() && <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 8 }} className="mono">✎</span>}
                <span className="mono" style={{ fontSize: 18, fontWeight: 700, textDecoration: e.struck ? 'line-through' : 'none' }}>
                  {String(a.numero).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 9, color: 'var(--dim)' }}>{e.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: 16, overflow: 'auto' }}>
        {!sel ? (
          <div style={{ color: 'var(--faint)', fontSize: 12.5, textAlign: 'center', marginTop: 24 }}>
            Seleccioná un aspirante para tomar notas y marcar su estado.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className="mono" style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', border: `1.5px solid ${ESTADO_MAP[sel.estado].color}`, borderRadius: 10, fontWeight: 700, fontSize: 18 }}>
                {String(sel.numero).padStart(2, '0')}
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
                ASPIRANTE<br /><span style={{ fontFamily: 'var(--font)', color: 'var(--text)', fontSize: 14 }}>{ESTADO_MAP[sel.estado].label}</span>
              </div>
            </div>

            <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--faint)', margin: '0 0 6px' }}>ESTADO</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
              {ESTADOS.map(e => (
                <button key={e.key} onClick={() => setEstado(sel, e.key)}
                  style={{
                    border: `1px solid ${sel.estado === e.key ? e.color : 'var(--line)'}`,
                    background: sel.estado === e.key ? 'color-mix(in srgb, ' + e.color + ' 14%, transparent)' : 'var(--bg)',
                    borderRadius: 8, padding: '7px 6px', fontSize: 11, color: sel.estado === e.key ? 'var(--text)' : 'var(--dim)',
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                  }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: e.color }} /> {e.label}
                </button>
              ))}
            </div>
            {sel.estado === 'recusado_con_causa' && (
              <div style={{ fontSize: 11, color: 'var(--obs)', marginBottom: 10 }}>
                ⚠ La recusación con causa no puede basarse en motivos discriminatorios (art. 338 quáter).
              </div>
            )}

            <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--faint)', margin: '4px 0 6px' }}>DATOS (para paridad)</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <input className="inp" placeholder="Nombre (opcional)" value={sel.nombre ?? ''}
                onChange={e => update(d => { d.seleccion.aspirantes.find(x => x.id === sel.id)!.nombre = e.target.value })} />
              <select className="inp" style={{ width: 90 }} value={sel.genero ?? ''}
                onChange={e => update(d => { d.seleccion.aspirantes.find(x => x.id === sel.id)!.genero = (e.target.value || undefined) as Genero })}>
                <option value="">—</option>
                <option value="M">♂</option>
                <option value="F">♀</option>
                <option value="X">X</option>
              </select>
            </div>

            <div className="mono" style={{ fontSize: 10, letterSpacing: '.12em', color: 'var(--faint)', margin: '4px 0 6px' }}>LO QUE DIJO</div>
            <textarea className="inp" style={{ minHeight: 120, resize: 'vertical' }}
              placeholder="Anotá textual lo que respondió: tono, dudas, contradicciones, vínculos…"
              value={sel.notas}
              onChange={e => update(d => { d.seleccion.aspirantes.find(x => x.id === sel.id)!.notas = e.target.value })} />
          </>
        )}
      </div>
    </div>
  )
}

function Counter({ n, label, warn, zero }: { n: number | string; label: string; warn?: boolean; zero?: boolean }) {
  return (
    <div style={{ background: 'var(--elev)', border: '1px solid var(--line)', borderRadius: 9, padding: '6px 13px', textAlign: 'center', minWidth: 74 }}>
      <div className="mono" style={{ fontWeight: 700, fontSize: 18, lineHeight: 1, color: zero ? 'var(--hostil)' : warn ? 'var(--obs)' : 'var(--text)' }}>{n}</div>
      <div style={{ fontSize: 9, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 3 }}>{label}</div>
    </div>
  )
}
