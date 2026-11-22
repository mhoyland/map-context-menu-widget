import Graphic from 'esri/Graphic'
import TextSymbol from 'esri/symbols/TextSymbol'
import GraphicsLayer from 'esri/layers/GraphicsLayer'
import type { JimuMapView } from 'jimu-arcgis'

/*
 * What Map Context Menu shares with the Attribute Label widget, so "Add text here" can place free text without
 * opening Attribute Label. Keep this in step with attribute-label (see "Shared with Map Context Menu" in both
 * READMEs):
 *  - saved choices in localStorage under `exb-attribute-label:<appId or page path>:<widgetId>`, of which only
 *    `freeText` and `style` are read here, and `freeText` is written back;
 *  - the label style (attribute-label/src/runtime/label.ts LabelStyle) and how it becomes a TextSymbol;
 *  - the tag attributes `alSource: 'attribute-label'`, `alKind`, `alKey`, so Attribute Label lists the label;
 *  - layers: the Draw widget's `jimu-draw-layer-<mapViewId>-…`, else Attribute Label's holding layer
 *    `attribute-label-<widgetId>` (Save Experience State saves both; Attribute Label moves the holding layer's
 *    labels onto Draw when Draw opens);
 *  - `mutableStateProps.freeTextUpdate` tells an Attribute Label that is already running about new text;
 *  - `labelRequest` with `mode: 'edit-text'` and `labelId` (the label's `alId` attribute) opens that label in
 *    Attribute Label's editor.
 * Anything missing falls back to defaults, so either widget works without the other.
 */

export interface LabelStyle {
  fontFamily: string
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
  halo: boolean
  haloColor: string
  haloSize: number
  background: boolean
  backgroundColor: string
  align: 'left' | 'center' | 'right'
  angle: number
}

const DEFAULT_STYLE: LabelStyle = {
  fontFamily: 'Arial',
  fontSize: 12,
  bold: false,
  italic: false,
  underline: false,
  color: '#000000',
  halo: true,
  haloColor: '#ffffff',
  haloSize: 1,
  background: false,
  backgroundColor: '#ffffff',
  align: 'center',
  angle: 0
}

const num = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export const normaliseStyle = (style: Partial<LabelStyle> | null | undefined): LabelStyle => {
  const s = { ...DEFAULT_STYLE, ...(style ?? {}) }
  return {
    fontFamily: typeof s.fontFamily === 'string' && s.fontFamily.trim() ? s.fontFamily : DEFAULT_STYLE.fontFamily,
    fontSize: num(s.fontSize, 6, 72, DEFAULT_STYLE.fontSize),
    bold: !!s.bold,
    italic: !!s.italic,
    underline: !!s.underline,
    color: s.color || DEFAULT_STYLE.color,
    halo: !!s.halo,
    haloColor: s.haloColor || DEFAULT_STYLE.haloColor,
    haloSize: num(s.haloSize, 0, 4, DEFAULT_STYLE.haloSize),
    background: !!s.background,
    backgroundColor: s.backgroundColor || DEFAULT_STYLE.backgroundColor,
    align: ['left', 'center', 'right'].includes(s.align) ? s.align : 'center',
    angle: num(s.angle, -180, 180, 0)
  }
}

const parseColor = (color: string): [number, number, number, number] => {
  const c = String(color ?? '').trim()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(c)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h.split('').map(x => x + x).join('')
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a]
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])]
  return [0, 0, 0, 1]
}

const withOpacity = (color: string, opacity: number): number[] => {
  const [r, g, b, a] = parseColor(color)
  return [r, g, b, a * opacity]
}

/** The same TextSymbol Attribute Label makes from a style (attribute-label/src/runtime/label.ts). */
export const makeTextSymbol = (style: LabelStyle, text: string, opacity = 1): TextSymbol => {
  const s = normaliseStyle(style)
  return new TextSymbol({
    text,
    color: withOpacity(s.color, opacity) as any,
    haloColor: s.halo && s.haloSize > 0 ? withOpacity(s.haloColor, opacity) as any : null,
    haloSize: s.halo ? s.haloSize : 0,
    backgroundColor: s.background ? withOpacity(s.backgroundColor, opacity) as any : null,
    borderLineColor: s.background ? withOpacity('rgba(0,0,0,0.25)', opacity) as any : null,
    borderLineSize: s.background ? 0.75 : null,
    horizontalAlignment: s.align,
    verticalAlignment: 'middle',
    angle: s.angle,
    font: {
      family: s.fontFamily,
      size: s.fontSize,
      weight: s.bold ? 'bold' : 'normal',
      style: s.italic ? 'italic' : 'normal',
      decoration: s.underline ? 'underline' : 'none'
    }
  } as any)
}

const storageKey = (widgetId: string, appId?: string | null) =>
  `exb-attribute-label:${appId || (typeof location !== 'undefined' ? location.pathname : '')}:${widgetId}`

/** Attribute Label's last free text and style, falling back to its builder default style, then Arial 12. */
export const readSaved = (widgetId: string, appId: string | null, builderStyle: Partial<LabelStyle> | null): { text: string, style: LabelStyle } => {
  let saved: any = {}
  try {
    saved = JSON.parse(window.localStorage.getItem(storageKey(widgetId, appId)) ?? '{}') ?? {}
  } catch {
    saved = {}
  }
  return {
    text: typeof saved.freeText === 'string' ? saved.freeText : '',
    style: normaliseStyle(saved.style ?? builderStyle)
  }
}

/** Keeps the text as Attribute Label's free text, so it is offered again next time (here and in the widget). */
export const saveText = (widgetId: string, appId: string | null, text: string) => {
  try {
    const key = storageKey(widgetId, appId)
    const saved = JSON.parse(window.localStorage.getItem(key) ?? '{}') ?? {}
    window.localStorage.setItem(key, JSON.stringify({ ...saved, freeText: text }))
  } catch {
    // Storage can be full or blocked; remembering is only a convenience.
  }
}

/** Puts free text on the Draw layer (or Attribute Label's holding layer), tagged so Attribute Label lists it. */
export const placeText = (
  jimuMapView: JimuMapView, widgetId: string, point: __esri.Point, text: string, style: LabelStyle, holdingTitle: string, labelId?: string
): __esri.Graphic => {
  const map = jimuMapView.view.map
  const drawLayer = map.allLayers.find((l: any) => l.type === 'graphics' && String(l.id).startsWith(`jimu-draw-layer-${jimuMapView.id}-`)) as __esri.GraphicsLayer
  let layer = drawLayer
  if (!layer) {
    layer = map.findLayerById(`attribute-label-${widgetId}`) as __esri.GraphicsLayer
    if (!layer) {
      layer = new GraphicsLayer({ id: `attribute-label-${widgetId}`, title: holdingTitle, listMode: 'hide' })
      map.add(layer)
    }
  }
  const graphic = new Graphic({
    geometry: point.clone(),
    symbol: makeTextSymbol(style, text),
    // alId lets Attribute Label find this label to open it for editing.
    attributes: { alSource: 'attribute-label', alKind: 'text', alKey: null, ...(labelId ? { alId: labelId } : {}) }
  })
  layer.add(graphic)
  return graphic
}
