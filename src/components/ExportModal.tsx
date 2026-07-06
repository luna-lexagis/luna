// src/components/ExportModal.tsx
import { useState } from 'react'
import type { Case } from '../shared/types'
import { buildReportText } from '../lib/report'

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

function slug(s: string) {
  return (s || 'caso').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'caso'
}

export function ExportModal({ caso, onClose }: { caso: Case; onClose: () => void }) {
  const report = buildReportText(caso)
  const [copied, setCopied] = useState(false)
  const base = slug(caso.identificacion.caratula)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'grid', placeItems: 'center', zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(760px, 92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
          <b style={{ fontSize: 14 }}>Exportar caso</b>
          <button className="ghost-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>Cerrar</button>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <button className="primary-btn" onClick={() => { navigator.clipboard.writeText(report).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}>
            {copied ? '✓ Copiado' : 'Copiar informe'}
          </button>
          <button className="ghost-btn" onClick={() => download(`${base}.txt`, report, 'text/plain;charset=utf-8')}>Descargar .txt</button>
          <button className="ghost-btn" onClick={() => download(`${base}.json`, JSON.stringify(caso, null, 2), 'application/json')}>Descargar .json</button>
        </div>
        <pre style={{ margin: 0, padding: 16, overflow: 'auto', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{report}</pre>
      </div>
    </div>
  )
}
