import { React, css, type IMThemeVariables } from 'jimu-core'
import type { JimuMapView } from 'jimu-arcgis'
import Graphic from 'esri/Graphic'
import * as reactiveUtils from 'esri/core/reactiveUtils'
import { CloseOutlined } from 'jimu-icons/outlined/editor/close'
import { TextOutlined } from 'jimu-icons/outlined/data/text'
import { makeTextSymbol, type LabelStyle } from './attribute-label-bridge'

interface AddTextDialogProps {
  theme: IMThemeVariables
  jimuMapView: JimuMapView
  point: __esri.Point
  initialText: string
  style: LabelStyle
  translate: (id: string, values?: any) => string
  onAdd: (text: string) => void
  onMoreOptions: (text: string) => void
  onClose: () => void
}

const GAP = 16
const MARGIN = 8
const PREVIEW_OPACITY = 0.5

const getStyle = (theme: IMThemeVariables) => {
  const sys = theme?.sys
  const surface = sys?.color?.surface?.overlay ?? '#fff'
  const border = sys?.color?.divider?.secondary ?? 'rgba(0,0,0,.12)'
  const primary = sys?.color?.primary?.main ?? '#076fe5'
  return css`
    position: fixed;
    z-index: 100000;
    width: 300px;
    max-width: calc(100vw - 16px);
    display: flex;
    flex-direction: column;
    background: ${surface};
    color: ${sys?.color?.surface?.overlayText ?? '#1f1f1f'};
    border: 1px solid ${border};
    border-radius: 8px;
    box-shadow: ${sys?.shadow?.shadow3 ?? '0 8px 24px rgba(0,0,0,.18)'};
    font-family: ${sys?.typography?.fontFamily ?? 'inherit'};
    font-size: 0.8125rem;
    animation: mcm-dialog-enter 120ms ease-out;

    @keyframes mcm-dialog-enter {
      from { opacity: 0; transform: translateY(-3px); }
      to { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    /* the arrow pointing at the spot */
    &::after {
      content: '';
      position: absolute;
      left: var(--mcm-arrow-left, 22px);
      width: 12px;
      height: 12px;
      background: ${surface};
      border-right: 1px solid ${border};
      border-bottom: 1px solid ${border};
    }
    &.is-above::after {
      bottom: -7px;
      transform: rotate(45deg);
    }
    &.is-below::after {
      top: -7px;
      transform: rotate(225deg);
    }

    .mcm-dlg-head {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 6px 6px 12px;
      font-weight: 600;
    }
    .mcm-dlg-close {
      margin-left: auto;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: ${sys?.color?.surface?.overlayHint ?? '#6a6a6a'};
      cursor: pointer;
    }
    .mcm-dlg-close:hover {
      background: ${sys?.color?.action?.hover ?? 'rgba(0,0,0,.06)'};
    }
    .mcm-dlg-body {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 0 12px 8px;
    }
    textarea {
      width: 100%;
      min-height: 72px;
      resize: vertical;
      padding: 6px 8px;
      border: 1px solid ${border};
      border-radius: 4px;
      background: ${sys?.color?.surface?.paper ?? surface};
      color: inherit;
      font: inherit;
    }
    .mcm-dlg-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 0.6875rem;
      color: ${sys?.color?.surface?.overlayHint ?? '#6a6a6a'};
    }
    .mcm-dlg-aa {
      display: inline-block;
      margin: 0 4px;
      padding: 0 5px;
      border: 1px solid ${border};
      border-radius: 3px;
    }
    .mcm-dlg-foot {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px 12px;
    }
    .mcm-dlg-more {
      margin-right: auto;
      padding: 0;
      border: 0;
      background: none;
      color: ${primary};
      font: inherit;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .mcm-dlg-more:hover:not(:disabled) {
      text-decoration: underline;
    }
    .mcm-dlg-more:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .mcm-dlg-btn {
      height: 32px;
      padding: 0 14px;
      border: 1px solid ${border};
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
    }
    .mcm-dlg-btn.is-primary {
      background: ${primary};
      border-color: ${primary};
      color: ${sys?.color?.primary?.text ?? '#fff'};
    }
    .mcm-dlg-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    textarea:focus-visible,
    button:focus-visible {
      outline: 2px solid ${primary};
      outline-offset: 1px;
    }
  `
}

/**
 * "Add text here": a small card next to the right-clicked spot for typing free text. A faded preview follows the
 * text on the map. Enter adds, Shift+Enter starts a new line, Esc closes.
 */
export default function AddTextDialog (props: AddTextDialogProps) {
  const { jimuMapView, point, style, translate } = props
  const view = jimuMapView?.view
  const [text, setText] = React.useState(props.initialText)
  const [screen, setScreen] = React.useState<{ x: number, y: number } | null>(null)
  const [size, setSize] = React.useState({ width: 300, height: 190 })
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const textRef = React.useRef<HTMLTextAreaElement>(null)
  const cssStyle = React.useMemo(() => getStyle(props.theme), [props.theme])

  // Follow the spot as the map pans and zooms (the card is fixed to the page, the spot to the map).
  React.useEffect(() => {
    if (!view || !point) return
    const update = () => {
      const s = view.toScreen(point)
      const rect = (view.container as HTMLElement)?.getBoundingClientRect()
      setScreen(s && rect ? { x: rect.left + s.x, y: rect.top + s.y } : null)
    }
    update()
    const handle = reactiveUtils.watch(() => [view.extent, view.width, view.height], update)
    window.addEventListener('scroll', update, true)
    return () => {
      handle.remove()
      window.removeEventListener('scroll', update, true)
    }
  }, [view, point])

  React.useLayoutEffect(() => {
    const box = dialogRef.current?.getBoundingClientRect()
    if (box && (Math.abs(box.width - size.width) > 1 || Math.abs(box.height - size.height) > 1)) {
      setSize({ width: box.width, height: box.height })
    }
  })

  // Start with the last text selected, so typing replaces it and Enter reuses it.
  React.useEffect(() => {
    textRef.current?.focus({ preventScroll: true })
    textRef.current?.select()
  }, [])

  // Faded preview of the text at the spot, or a dot while the box is empty.
  React.useEffect(() => {
    if (!view || !point) return
    const graphic = text.trim()
      ? new Graphic({ geometry: point, symbol: makeTextSymbol(style, text, PREVIEW_OPACITY) })
      : new Graphic({
        geometry: point,
        symbol: { type: 'simple-marker', style: 'circle', size: 8, color: [7, 111, 229, 1], outline: { color: [255, 255, 255, 1], width: 1.5 } } as any
      })
    view.graphics.add(graphic)
    return () => { if (!view.destroyed) view.graphics.remove(graphic) }
  }, [view, point, text, style])

  const canAdd = !!text.trim()
  const add = () => { if (canAdd) props.onAdd(text) }

  if (!screen) return null

  // Above the spot where there is room, otherwise below it; kept inside the window.
  const above = screen.y - GAP - size.height >= MARGIN
  const left = Math.max(MARGIN, Math.min(screen.x - 28, window.innerWidth - size.width - MARGIN))
  const top = above ? screen.y - GAP - size.height : Math.min(screen.y + GAP, window.innerHeight - size.height - MARGIN)
  const arrowLeft = Math.max(12, Math.min(screen.x - left - 6, size.width - 24))
  const styleSummary = `${style.fontFamily} ${style.fontSize} pt`

  return (
    <div
      ref={dialogRef}
      css={cssStyle}
      className={`map-context-menu-add-text ${above ? 'is-above' : 'is-below'}`}
      style={{ left, top, ['--mcm-arrow-left' as any]: `${arrowLeft}px` }}
      role='dialog'
      aria-labelledby='mcm-add-text-title'
      onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); props.onClose() } }}
      onContextMenu={(event) => { event.stopPropagation() }}
    >
      <div className='mcm-dlg-head'>
        <TextOutlined size={16} />
        <span id='mcm-add-text-title'>{translate('mcmAddTextTitle')}</span>
        <button type='button' className='mcm-dlg-close' aria-label={translate('mcmClose')} title={translate('mcmClose')} onClick={props.onClose}>
          <CloseOutlined size={14} />
        </button>
      </div>
      <div className='mcm-dlg-body'>
        <textarea
          ref={textRef}
          value={text}
          aria-label={translate('mcmAddTextLabel')}
          placeholder={translate('mcmAddTextPlaceholder')}
          onChange={(event) => { setText(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              add()
            }
          }}
        />
        <div className='mcm-dlg-meta'>
          <span>{translate('mcmAddTextKeys')}</span>
          <span title={translate('mcmAddTextStyleTitle')}>
            {translate('mcmAddTextStyle')}
            <span
              className='mcm-dlg-aa'
              aria-hidden='true'
              style={{ fontWeight: style.bold ? 700 : 400, fontStyle: style.italic ? 'italic' : 'normal' }}
            >
              Aa
            </span>
            {styleSummary}
          </span>
        </div>
      </div>
      <div className='mcm-dlg-foot'>
        <button type='button' className='mcm-dlg-more' disabled={!canAdd} onClick={() => { props.onMoreOptions(text) }}>{translate('mcmAddTextMore')}</button>
        <button type='button' className='mcm-dlg-btn' onClick={props.onClose}>{translate('mcmCancel')}</button>
        <button type='button' className='mcm-dlg-btn is-primary' disabled={!canAdd} onClick={add}>{translate('mcmAddTextAdd')}</button>
      </div>
    </div>
  )
}
