import { React, ReactDOM, ReactRedux, css, hooks, MutableStoreManager, type AllWidgetProps, type IMState, type IMThemeVariables } from 'jimu-core'
import { Icon } from 'jimu-ui'
import { useTheme } from 'jimu-theme'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import { CopyOutlined } from 'jimu-icons/outlined/editor/copy'
import { LaunchOutlined } from 'jimu-icons/outlined/editor/launch'
import { ZoomInOutlined } from 'jimu-icons/outlined/editor/zoom-in'
import { ZoomOutOutlined } from 'jimu-icons/outlined/editor/zoom-out'
import { LocateOutlined } from 'jimu-icons/outlined/application/locate'
import { PinOutlined } from 'jimu-icons/outlined/application/pin'
import { CheckOutlined } from 'jimu-icons/outlined/application/check'
import { SelectPointOutlined } from 'jimu-icons/outlined/gis/select-point'
import { TextLeftOutlined } from 'jimu-icons/outlined/editor/text-left'
import { TextOutlined } from 'jimu-icons/outlined/data/text'
import SpatialReference from 'esri/geometry/SpatialReference'
import * as webMercatorUtils from 'esri/geometry/support/webMercatorUtils'
import type Point from 'esri/geometry/Point'
import type { IMConfig, MenuAction, MenuItemConfig } from '../config'
import AddTextDialog from './add-text-dialog'
import { revealWidget } from './reveal-widget'
import { placeText, readSaved, saveText, type LabelStyle } from './attribute-label-bridge'
import defaultMessages from './translations/default'

interface ContextLocation {
  mapX: number
  mapY: number
  wkid?: number
  latitude: number
  longitude: number
}

interface PopupState {
  visible: boolean
  left: number
  top: number
  location?: ContextLocation
}

const EMPTY_POPUP: PopupState = { visible: false, left: 0, top: 0 }
const TOAST_MS = 5000

/** The "Add text here" dialog: where, for which Attribute Label widget, and what to start with. */
interface AddTextState {
  item: MenuItemConfig
  location: ContextLocation
  point: Point
  text: string
  style: LabelStyle
}

interface Toast {
  message: string
  undo?: () => void
}
const WGS84 = new SpatialReference({ wkid: 4326 })
const COPY_FEEDBACK_MS = 650

const ACTION_ICONS: Partial<Record<MenuAction, React.ComponentType<any>>> = {
  'copy-coordinate': CopyOutlined,
  'open-widget': LaunchOutlined,
  'add-to-coordinate-widget': PinOutlined,
  'whats-here': SelectPointOutlined,
  'add-label': TextLeftOutlined,
  'add-text': TextOutlined,
  'center-map': LocateOutlined,
  'zoom-in': ZoomInOutlined,
  'zoom-out': ZoomOutOutlined
}

const getStyle = (theme: IMThemeVariables) => {
  const sys = theme?.sys
  return css`
    position: fixed;
    z-index: 100000;
    min-width: 232px;
    max-width: 320px;
    padding: 4px;
    background: ${sys?.color?.surface?.overlay ?? '#fff'};
    color: ${sys?.color?.surface?.overlayText ?? '#1f1f1f'};
    border: 1px solid ${sys?.color?.divider?.secondary ?? 'rgba(0,0,0,.12)'};
    border-radius: 8px;
    box-shadow: ${sys?.shadow?.shadow3 ?? '0 8px 24px rgba(0,0,0,.18)'};
    font-family: ${sys?.typography?.fontFamily ?? 'inherit'};
    font-size: 0.8125rem;
    line-height: 1.25;
    transform-origin: top left;
    animation: mcm-enter 120ms ease-out;
    user-select: none;

    @keyframes mcm-enter {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      animation: none;
    }

    .mcm-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
      padding: 8px 6px 8px 10px;
      border-radius: 6px;
      background: ${sys?.color?.action?.hover ?? 'rgba(0,0,0,.04)'};
    }
    .mcm-header-icon {
      flex: 0 0 auto;
      color: ${sys?.color?.primary?.main ?? '#076fe5'};
    }
    .mcm-coords {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .mcm-coords-label {
      font-size: 0.6875rem;
      color: ${sys?.color?.surface?.overlayHint ?? '#6a6a6a'};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .mcm-coords-value {
      font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: text;
    }
    .mcm-icon-button {
      flex: 0 0 auto;
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      cursor: pointer;
    }
    .mcm-icon-button:hover {
      background: ${sys?.color?.action?.pressed ?? 'rgba(0,0,0,.08)'};
    }
    .mcm-icon-button.is-copied,
    .mcm-item.is-copied .mcm-item-icon {
      color: ${sys?.color?.success?.main ?? '#2e7d32'};
    }
    .mcm-item {
      width: 100%;
      min-height: 32px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 10px;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      text-align: start;
      cursor: pointer;
    }
    .mcm-item:hover,
    .mcm-item:focus-visible {
      background: ${sys?.color?.action?.hover ?? 'rgba(0,0,0,.06)'};
    }
    .mcm-item-icon {
      flex: 0 0 16px;
      color: ${sys?.color?.surface?.overlayHint ?? '#6a6a6a'};
    }
    .mcm-item:hover .mcm-item-icon,
    .mcm-item:focus-visible .mcm-item-icon {
      color: inherit;
    }
    .mcm-item-label {
      flex: 1 1 auto;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mcm-item:focus-visible,
    .mcm-icon-button:focus-visible {
      outline: 2px solid ${sys?.color?.primary?.main ?? '#076fe5'};
      outline-offset: -2px;
    }
    .mcm-separator {
      height: 1px;
      margin: 4px 6px;
      background: ${sys?.color?.divider?.tertiary ?? 'rgba(0,0,0,.08)'};
    }
  `
}

/** A widget's icon is its icon.svg URL by default, or an { svg } object when a custom icon was chosen. */
const widgetIconSource = (widget: any): string | null => {
  const icon = widget?.icon
  if (!icon) return null
  return typeof icon === 'string' ? icon : (icon.svg ?? null)
}

/** A short message near the bottom of the map, with Undo. */
const toastStyle = (theme: IMThemeVariables) => css`
  position: fixed;
  z-index: 100000;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100vw - 24px);
  padding: 7px 8px 7px 14px;
  border-radius: 6px;
  background: ${theme?.sys?.color?.surface?.overlay ?? '#fff'};
  color: ${theme?.sys?.color?.surface?.overlayText ?? '#1f1f1f'};
  box-shadow: ${theme?.sys?.shadow?.shadow3 ?? '0 8px 24px rgba(0,0,0,.18)'};
  font-family: ${theme?.sys?.typography?.fontFamily ?? 'inherit'};
  font-size: 0.8125rem;

  button {
    padding: 2px 6px;
    border: 0;
    background: transparent;
    color: ${theme?.sys?.color?.primary?.main ?? '#076fe5'};
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
`

const toastPosition = (jimuMapView: JimuMapView): React.CSSProperties => {
  const rect = (jimuMapView?.view?.container as HTMLElement)?.getBoundingClientRect()
  return rect ? { left: rect.left + rect.width / 2, top: rect.bottom - 56 } : { left: '50%', bottom: 24 }
}

const hostStyle = css`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
`

export default function Widget (props: AllWidgetProps<IMConfig>) {
  const theme = useTheme()
  const translate = hooks.useTranslation(defaultMessages)
  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const [popup, setPopup] = React.useState<PopupState>(EMPTY_POPUP)
  const [copied, setCopied] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const pointRef = React.useRef<Point>(null)
  const copyTimerRef = React.useRef<number>(null)

  const decimalPlaces = Math.min(10, Math.max(0, Number(props.config?.decimalPlaces ?? 6)))
  const menuItems = ((props.config?.menuItems as unknown) as MenuItemConfig[]) ?? []
  const visibleItems = menuItems.filter(item => item.enabled !== false)
  const showCoordinateHeader = props.config?.showCoordinateHeader !== false
  const style = React.useMemo(() => getStyle(theme), [theme])
  const appWidgets = ReactRedux.useSelector((state: IMState) => state.appConfig?.widgets)
  const appId = ReactRedux.useSelector((state: IMState) => (state as any).appId as string)
  const [addText, setAddText] = React.useState<AddTextState>(null)
  const [toast, setToast] = React.useState<Toast>(null)

  const closeMenu = React.useCallback((restoreFocus = false) => {
    window.clearTimeout(copyTimerRef.current)
    setPopup(EMPTY_POPUP)
    setCopied(false)
    if (restoreFocus) (jimuMapView?.view?.container as HTMLElement)?.querySelector<HTMLElement>('.esri-view-surface')?.focus()
  }, [jimuMapView])

  const pointToLatLon = React.useCallback((point: Point): { latitude: number, longitude: number } => {
    if (!point) return { latitude: NaN, longitude: NaN }

    // Geographic points expose longitude/latitude directly in the ArcGIS Maps SDK.
    if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
      return { latitude: point.latitude, longitude: point.longitude }
    }

    // Covers Web Mercator and other coordinate systems supported by webMercatorUtils.
    try {
      if (webMercatorUtils.canProject(point, WGS84)) {
        const projected = webMercatorUtils.project(point, WGS84) as Point
        if (projected && Number.isFinite(projected.y) && Number.isFinite(projected.x)) {
          return { latitude: projected.y, longitude: projected.x }
        }
      }
    } catch (err) {
      console.warn('MapContextMenu: coordinate conversion failed.', err)
    }

    // Fallback keeps the menu usable for an unsupported custom projected SR.
    return { latitude: point.y, longitude: point.x }
  }, [])

  const onContextMenu = React.useCallback((event: MouseEvent) => {
    if (!jimuMapView?.view) return

    event.preventDefault()
    event.stopPropagation()

    const container = jimuMapView.view.container as HTMLElement
    const rect = container.getBoundingClientRect()
    const point = jimuMapView.view.toMap({ x: event.clientX - rect.left, y: event.clientY - rect.top }) as Point
    if (!point) return

    pointRef.current = point
    setAddText(null)
    const ll = pointToLatLon(point)
    window.clearTimeout(copyTimerRef.current)
    setCopied(false)
    setPopup({
      visible: true,
      left: event.clientX + 2,
      top: event.clientY + 2,
      location: {
        mapX: point.x,
        mapY: point.y,
        wkid: point.spatialReference?.wkid,
        latitude: ll.latitude,
        longitude: ll.longitude
      }
    })
  }, [jimuMapView, pointToLatLon])

  React.useEffect(() => {
    const container = jimuMapView?.view?.container as HTMLElement
    if (!container) return

    container.addEventListener('contextmenu', onContextMenu, true)

    const view = jimuMapView.view
    const handles: __esri.Handle[] = [
      view.on('drag', () => { closeMenu() }),
      view.on('mouse-wheel', () => { closeMenu() })
    ]

    const onDocumentPointerDown = (event: PointerEvent) => {
      const menu = menuRef.current
      if (menu && !menu.contains(event.target as Node)) closeMenu()
    }
    const onWindowChange = () => { closeMenu() }
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    window.addEventListener('resize', onWindowChange)
    window.addEventListener('blur', onWindowChange)

    return () => {
      container.removeEventListener('contextmenu', onContextMenu, true)
      handles.forEach(h => h?.remove())
      document.removeEventListener('pointerdown', onDocumentPointerDown, true)
      window.removeEventListener('resize', onWindowChange)
      window.removeEventListener('blur', onWindowChange)
    }
  }, [jimuMapView, onContextMenu, closeMenu])

  // Keep the menu on-screen, then move focus into it for keyboard users.
  React.useLayoutEffect(() => {
    if (!popup.visible || !menuRef.current) return
    const box = menuRef.current.getBoundingClientRect()
    const margin = 8
    let left = popup.left
    let top = popup.top

    if (left + box.width > window.innerWidth - margin) left = Math.max(margin, popup.left - box.width - 4)
    if (top + box.height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - box.height - margin)

    if (left !== popup.left || top !== popup.top) {
      setPopup(prev => ({ ...prev, left, top }))
    }
  }, [popup.visible, popup.left, popup.top])

  React.useEffect(() => {
    if (!popup.visible) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true })
  }, [popup.visible, popup.location])

  React.useEffect(() => () => { window.clearTimeout(copyTimerRef.current) }, [])

  const coordinateText = React.useMemo(() => {
    if (!popup.location) return ''
    return `${popup.location.latitude.toFixed(decimalPlaces)}, ${popup.location.longitude.toFixed(decimalPlaces)}`
  }, [popup.location, decimalPlaces])

  const writeClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      textArea.remove()
    }
  }

  const copyCoordinates = async (closeAfter: boolean) => {
    if (!coordinateText) return
    await writeClipboard(coordinateText)
    setCopied(true)
    window.clearTimeout(copyTimerRef.current)
    copyTimerRef.current = window.setTimeout(() => {
      if (closeAfter) closeMenu(true)
      else setCopied(false)
    }, COPY_FEEDBACK_MS)
  }

  const openTargetWidget = (item: MenuItemConfig) => {
    if (!item.targetWidgetId || !popup.location) return

    if (item.sendCoordinateToWidget !== false) {
      // Plain JSON only. A receiving custom widget can read mutableStateProps.mapContext.
      MutableStoreManager.getInstance().updateStateValue(item.targetWidgetId, 'mapContext', {
        sourceWidgetId: props.id,
        source: 'map-context-menu',
        latitude: popup.location.latitude,
        longitude: popup.location.longitude,
        mapX: popup.location.mapX,
        mapY: popup.location.mapY,
        wkid: popup.location.wkid
      })
    }

    revealWidget(item.targetWidgetId)
  }

  const addToCoordinateWidget = (item: MenuItemConfig) => {
    if (!item.targetWidgetId || !popup.location) return

    const request = {
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sourceWidgetId: props.id,
      source: 'map-context-menu',
      action: 'add-coordinate',
      latitude: popup.location.latitude,
      longitude: popup.location.longitude,
      mapX: popup.location.mapX,
      mapY: popup.location.mapY,
      wkid: popup.location.wkid
    }

    // Write before opening because a widget inside a Widget Controller or an unvisited section view
    // may not be mounted until it is revealed.
    MutableStoreManager.getInstance().updateStateValue(item.targetWidgetId, 'coordinateAddRequest', request)
    // Also maintain the generic context payload for compatibility.
    MutableStoreManager.getInstance().updateStateValue(item.targetWidgetId, 'mapContext', request)

    revealWidget(item.targetWidgetId)
  }

  const sendToWhatsHere = (item: MenuItemConfig) => {
    if (!item.targetWidgetId || !popup.location) return

    // A fresh requestId per right-click lets What's Here search the same spot again.
    MutableStoreManager.getInstance().updateStateValue(item.targetWidgetId, 'whatsHereRequest', {
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sourceWidgetId: props.id,
      source: 'map-context-menu',
      latitude: popup.location.latitude,
      longitude: popup.location.longitude,
      mapX: popup.location.mapX,
      mapY: popup.location.mapY,
      wkid: popup.location.wkid
    })

    revealWidget(item.targetWidgetId)
  }

  /**
   * 'feature' labels the feature at the point; 'edit-text' opens the label just placed from the Add text dialog
   * (found by `labelId`) in Attribute Label's editor.
   */
  const sendToAttributeLabel = (item: MenuItemConfig, mode: 'feature' | 'edit-text', location: ContextLocation, text?: string, labelId?: string) => {
    if (!item.targetWidgetId || !location) return

    // Same shape as whatsHereRequest; a fresh requestId lets the same spot be labelled twice.
    MutableStoreManager.getInstance().updateStateValue(item.targetWidgetId, 'labelRequest', {
      requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      mode,
      text,
      labelId,
      sourceWidgetId: props.id,
      source: 'map-context-menu',
      latitude: location.latitude,
      longitude: location.longitude,
      mapX: location.mapX,
      mapY: location.mapY,
      wkid: location.wkid
    })

    revealWidget(item.targetWidgetId)
  }

  // ---------- "Add text here": type the text in a card at the spot, without opening Attribute Label ----------
  const openAddText = (item: MenuItemConfig) => {
    const point = pointRef.current
    if (!item.targetWidgetId || !popup.location || !point || !jimuMapView?.view) return
    const builderStyle = (appWidgets?.[item.targetWidgetId]?.config as any)?.defaultStyle
    const saved = readSaved(item.targetWidgetId, appId, builderStyle?.asMutable ? builderStyle.asMutable({ deep: true }) : builderStyle)
    setAddText({ item, location: popup.location, point, text: saved.text, style: saved.style })
  }

  const addTextNow = (text: string) => {
    if (!addText || !jimuMapView?.view) return
    const widgetId = addText.item.targetWidgetId
    const graphic = placeText(jimuMapView, widgetId, addText.point, text, addText.style, translate('mapContextMenuLabelsLayer'))
    saveText(widgetId, appId, text)
    // An Attribute Label that is already running keeps its Free text box in step.
    MutableStoreManager.getInstance().updateStateValue(widgetId, 'freeTextUpdate', { requestId: `${Date.now()}`, text })
    setAddText(null)
    setToast({
      message: translate('mapContextMenuTextAdded'),
      undo: () => {
        (graphic.layer as __esri.GraphicsLayer)?.remove(graphic)
        setToast(null)
      }
    })
  }

  // More options: place the text where it is, so it stays on the map, then open it in Attribute Label's editor
  // to restyle it. Cancel there removes it again.
  const moreTextOptions = (text: string) => {
    if (!addText || !jimuMapView?.view || !text.trim()) return
    const widgetId = addText.item.targetWidgetId
    const labelId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    placeText(jimuMapView, widgetId, addText.point, text, addText.style, translate('mapContextMenuLabelsLayer'), labelId)
    saveText(widgetId, appId, text)
    sendToAttributeLabel(addText.item, 'edit-text', addText.location, text, labelId)
    setAddText(null)
  }

  React.useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => { setToast(null) }, TOAST_MS)
    return () => { window.clearTimeout(timer) }
  }, [toast])

  const runAction = async (item: MenuItemConfig) => {
    if (!popup.location || item.action === 'separator') return
    const view = jimuMapView?.view
    const point = pointRef.current

    switch (item.action) {
      case 'copy-coordinate':
        await copyCoordinates(true)
        return // The copy timer closes the menu once the confirmation has been shown.
      case 'open-widget':
        openTargetWidget(item)
        break
      case 'add-to-coordinate-widget':
        addToCoordinateWidget(item)
        break
      case 'whats-here':
        sendToWhatsHere(item)
        break
      case 'add-label':
        sendToAttributeLabel(item, 'feature', popup.location)
        break
      case 'add-text':
        openAddText(item)
        break
      case 'center-map':
        if (point) void view?.goTo(point)
        break
      case 'zoom-in':
        if (point) void view?.goTo({ target: point, zoom: (view.zoom ?? 0) + 1 })
        break
      case 'zoom-out':
        if (point) void view?.goTo({ target: point, zoom: Math.max(0, (view.zoom ?? 0) - 1) })
        break
    }

    closeMenu()
  }

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const focusable = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const index = focusable.indexOf(document.activeElement as HTMLElement)
    let next: HTMLElement

    switch (event.key) {
      case 'ArrowDown': next = focusable[(index + 1) % focusable.length]; break
      case 'ArrowUp': next = focusable[(index - 1 + focusable.length) % focusable.length]; break
      case 'Home': next = focusable[0]; break
      case 'End': next = focusable[focusable.length - 1]; break
      case 'Escape':
      case 'Tab':
        event.preventDefault()
        closeMenu(true)
        return
      default:
        return
    }
    event.preventDefault()
    next?.focus()
  }

  const popupNode = popup.visible && popup.location
    ? (
      <div
        ref={menuRef}
        css={style}
        className='map-context-menu-popup'
        style={{ left: popup.left, top: popup.top }}
        role='menu'
        aria-label={translate('mapContextMenuAriaLabel')}
        onKeyDown={onMenuKeyDown}
        onContextMenu={(e) => { e.preventDefault() }}
      >
        {showCoordinateHeader && (
          <div className='mcm-header'>
            <PinOutlined className='mcm-header-icon' size={16} />
            <div className='mcm-coords'>
              <span className='mcm-coords-label'>{translate('mapContextMenuLatLon')}</span>
              <span className='mcm-coords-value' title={coordinateText}>{coordinateText}</span>
            </div>
            <button
              type='button'
              role='menuitem'
              className={`mcm-icon-button${copied ? ' is-copied' : ''}`}
              onClick={() => { void copyCoordinates(false) }}
              title={translate(copied ? 'mapContextMenuCopied' : 'mapContextMenuCopyCoordinates')}
              aria-label={translate(copied ? 'mapContextMenuCopied' : 'mapContextMenuCopyCoordinates')}
            >
              {copied ? <CheckOutlined size={16} /> : <CopyOutlined size={16} />}
            </button>
          </div>
        )}

        {visibleItems.map(item => {
          if (item.action === 'separator') {
            return <div key={item.id} className='mcm-separator' role='separator' />
          }
          const isCopyItem = item.action === 'copy-coordinate'
          const showCopied = isCopyItem && copied
          // Open widget items borrow the target widget's own icon, e.g. the Print icon for Print.
          const targetIcon = item.action === 'open-widget' && !showCopied ? widgetIconSource(appWidgets?.[item.targetWidgetId]) : null
          const ActionIcon = showCopied ? CheckOutlined : (ACTION_ICONS[item.action] ?? LaunchOutlined)
          return (
            <button
              key={item.id}
              type='button'
              role='menuitem'
              className={`mcm-item${showCopied ? ' is-copied' : ''}`}
              onClick={() => { void runAction(item) }}
            >
              {targetIcon
                ? <Icon className='mcm-item-icon' icon={targetIcon} size={16} />
                : <ActionIcon className='mcm-item-icon' size={16} />}
              <span className='mcm-item-label'>{showCopied ? translate('mapContextMenuCopied') : item.label}</span>
            </button>
          )
        })}

        <span className='sr-only' aria-live='polite'>{copied ? translate('mapContextMenuCopied') : ''}</span>
      </div>
      )
    : null

  return (
    <div css={hostStyle} className='map-context-menu-runtime' aria-hidden='true'>
      {props.useMapWidgetIds?.length > 0 && (
        <JimuMapViewComponent
          useMapWidgetId={props.useMapWidgetIds[0]}
          onActiveViewChange={setJimuMapView}
        />
      )}

      {popupNode ? ReactDOM.createPortal(popupNode, document.body) : null}

      {addText && jimuMapView && ReactDOM.createPortal(
        <AddTextDialog
          theme={theme}
          jimuMapView={jimuMapView}
          point={addText.point}
          initialText={addText.text}
          style={addText.style}
          translate={translate}
          onAdd={addTextNow}
          onMoreOptions={moreTextOptions}
          onClose={() => { setAddText(null) }}
        />,
        document.body
      )}

      {toast && ReactDOM.createPortal(
        <div css={toastStyle(theme)} style={toastPosition(jimuMapView)} role='status'>
          <span>{toast.message}</span>
          {toast.undo && <button type='button' onClick={toast.undo}>{translate('mapContextMenuUndo')}</button>}
        </div>,
        document.body
      )}
    </div>
  )
}
