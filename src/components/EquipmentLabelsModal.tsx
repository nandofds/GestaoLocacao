import { type CSSProperties, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { EquipmentItem } from '../lib/equipment'

type PrintMode = 'a4' | 'label'
const presets = [[50, 30], [60, 35], [60, 40], [90, 30]] as const

export function EquipmentLabelsModal({ items, onClose }: { items: EquipmentItem[]; onClose: () => void }) {
  const [mode, setMode] = useState<PrintMode>('a4')
  const [width, setWidth] = useState(60)
  const [height, setHeight] = useState(35)
  const qrMillimeters = Math.max(18, Math.min(height - 8, width * .42, 30))
  const labelStyle = { '--label-width': `${width}mm`, '--label-height': `${height}mm`, '--qr-size': `${qrMillimeters}mm` } as CSSProperties
  const printCss = mode === 'a4'
    ? '@media print { @page { size: A4; margin: 10mm; } }'
    : `@media print { @page { size: ${width}mm ${height}mm; margin: 0; } .qr-print-area { display: block !important; width: ${width}mm !important; } .equipment-label { page-break-after: always; break-after: page; border: 0 !important; } .equipment-label:last-child { page-break-after: auto; break-after: auto; } }`

  function choosePreset(nextWidth: number, nextHeight: number) { setWidth(nextWidth); setHeight(nextHeight) }

  return <div className="modal-backdrop qr-modal"><style>{printCss}</style><section className="client-modal qr-label-modal" role="dialog" aria-modal="true" aria-labelledby="qr-label-title"><header><div><span><Printer /></span><div><h2 id="qr-label-title">Etiquetas de equipamentos</h2><p>{items.length} {items.length === 1 ? 'etiqueta pronta' : 'etiquetas prontas'} para impressão.</p></div></div><button aria-label="Fechar" onClick={onClose}><X /></button></header>
    <div className="print-settings"><fieldset><legend>Modelo de impressão</legend><label><input type="radio" name="print-mode" checked={mode === 'a4'} onChange={() => setMode('a4')} /> Folha A4</label><label><input type="radio" name="print-mode" checked={mode === 'label'} onChange={() => setMode('label')} /> Impressora de etiqueta</label></fieldset><div className="label-presets"><strong>Tamanho da etiqueta</strong><span>{presets.map(([presetWidth, presetHeight]) => <button className={width === presetWidth && height === presetHeight ? 'label-preset label-preset--active' : 'label-preset'} key={`${presetWidth}x${presetHeight}`} onClick={() => choosePreset(presetWidth, presetHeight)}>{presetWidth} × {presetHeight}</button>)}</span></div><div className="custom-label-size"><label className="field">Largura (mm)<input type="number" min="30" max="150" value={width} onChange={(event) => setWidth(Math.max(30, Math.min(150, Number(event.target.value))))} /></label><label className="field">Altura (mm)<input type="number" min="20" max="100" value={height} onChange={(event) => setHeight(Math.max(20, Math.min(100, Number(event.target.value))))} /></label></div><p>{mode === 'a4' ? 'As etiquetas serão distribuídas automaticamente em folhas A4.' : 'Cada equipamento será enviado como uma página no tamanho exato da etiqueta.'}</p></div>
    <div className={`qr-print-area qr-print-area--${mode}`} style={labelStyle}>{items.map((item) => <article className="equipment-label" key={item.id}><QRCodeSVG value={item.qr_value} size={120} level="M" marginSize={1} /><div><small>{item.organization_name}</small><strong>{item.internal_code}</strong><span>{item.description}</span><em>{item.category_name}</em></div></article>)}</div>
    <footer><button className="secondary" onClick={onClose}>Fechar</button><button className="primary" onClick={() => window.print()}><Printer size={17} /> Imprimir · {mode === 'a4' ? 'A4' : `${width} × ${height} mm`}</button></footer>
  </section></div>
}
