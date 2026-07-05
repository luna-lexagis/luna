// src/phases/Preparacion.tsx
import type { Case, Rol } from '../shared/types'

const card: React.CSSProperties = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, padding: 20, marginBottom: 16 }
const title: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16 }

export function Preparacion({ caso, update }: { caso: Case; update: (m: (d: Case) => void) => void }) {
  const id = caso.identificacion
  const roles: { key: Rol; t: string; d: string }[] = [
    { key: 'defensa', t: 'Defensa', d: 'Busco duda razonable · evito el punitivismo' },
    { key: 'fiscalia_querella', t: 'Fiscalía / Querella', d: 'Busco firmeza · evito la sobre-empatía con el reo' },
  ]
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '22px 24px' }}>
      <section style={card}>
        <div style={title}>Identificación</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label>Carátula</label>
            <input className="inp" value={id.caratula}
              onChange={e => update(d => { d.identificacion.caratula = e.target.value })}
              placeholder="Fiscalía c/ Pérez, Juan s/ homicidio simple" />
          </div>
          <div>
            <label>Delito imputado</label>
            <input className="inp" value={id.delito}
              onChange={e => update(d => { d.identificacion.delito = e.target.value })}
              placeholder="Homicidio agravado por el vínculo" />
          </div>
        </div>
        <label>Represento a la</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {roles.map(r => {
            const on = id.rol === r.key
            return (
              <button key={r.key} onClick={() => update(d => { d.identificacion.rol = r.key })}
                style={{ flex: 1, textAlign: 'left', borderRadius: 10, padding: '12px 14px',
                  background: on ? 'rgba(224,164,76,.08)' : 'var(--bg)',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}` }}>
                <div style={{ fontWeight: 700, color: on ? 'var(--accent)' : 'var(--text)' }}>{r.t}</div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 3 }}>{r.d}</div>
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 14 }}>
          <label>Departamento judicial (opcional)</label>
          <input className="inp" value={id.departamentoJudicial ?? ''}
            onChange={e => update(d => { d.identificacion.departamentoJudicial = e.target.value })}
            placeholder="San Martín" />
        </div>
      </section>

      <section style={card}>
        <div style={title}>Teoría del caso</div>
        <label>Tu línea de fuerza: qué vas a probar y con qué</label>
        <textarea className="inp" style={{ minHeight: 90, resize: 'vertical' }} value={caso.teoriaDelCaso.teoria}
          onChange={e => update(d => { d.teoriaDelCaso.teoria = e.target.value })} />
      </section>

      <section style={card}>
        <div style={title}>Datos clave del expediente</div>
        <label>Hechos, prueba, particularidades</label>
        <textarea className="inp" style={{ minHeight: 90, resize: 'vertical' }} value={caso.teoriaDelCaso.expediente}
          onChange={e => update(d => { d.teoriaDelCaso.expediente = e.target.value })} />
      </section>

      <section style={card}>
        <div style={title}>Panel</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label>Aspirantes convocados</label>
            <input className="inp" type="number" min={1} max={80}
              value={caso.seleccion.config.aspirantesConvocados}
              onChange={e => update(d => { d.seleccion.config.aspirantesConvocados = Number(e.target.value) })} />
          </div>
          <div>
            <label>Recusaciones sin causa por parte</label>
            <input className="inp" type="number" min={0} max={12}
              value={caso.seleccion.config.perentoriasPorParte}
              onChange={e => update(d => { d.seleccion.config.perentoriasPorParte = Number(e.target.value) })} />
          </div>
        </div>
      </section>
    </div>
  )
}
