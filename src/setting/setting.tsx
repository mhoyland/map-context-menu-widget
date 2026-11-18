import { React, ReactRedux, Immutable, css, hooks, type IMState } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import { Button, NumericInput, Option, Select, Switch, TextInput } from 'jimu-ui'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import { DownOutlined } from 'jimu-icons/outlined/directional/down'
import { RightOutlined } from 'jimu-icons/outlined/directional/right'
import { HandleDotVerticalOutlined } from 'jimu-icons/outlined/application/handle-dot-vertical'
import { TrashOutlined } from 'jimu-icons/outlined/editor/trash'
import { PlusOutlined } from 'jimu-icons/outlined/editor/plus'
import type { Config, IMConfig, MenuAction, MenuItemConfig } from '../config'
import defaultMessages from './translations/default'

interface WidgetOption {
  id: string
  label: string
  /** The widget's type name, e.g. "Print" for an instance labelled "Print 2"; used to fill in a menu label. */
  defaultLabel: string
  isCoordinatePoint: boolean
  isWhatsHere: boolean
  isAttributeLabel: boolean
}

const widgetName = (widget: any): string =>
  widget?.manifest?.name ?? String(widget?.uri ?? '').replace(/\/$/, '').split('/').pop() ?? ''

/**
 * Only widgets a user can sensibly open: not layout containers or controllers, not another
 * context menu, and actually placed somewhere in the app (widgets left in the config after
 * being removed from every layout have no parent).
 */
const isTargetWidget = (widget: any): boolean => {
  const manifest = widget?.manifest
  if (manifest?.widgetType === 'LAYOUT') return false
  if (manifest?.properties?.hasEmbeddedLayout || manifest?.properties?.isWidgetController) return false
  // Fallback for when the manifest is not loaded: built-in layout widgets live under widgets/layout/.
  if (String(widget?.uri ?? '').includes('widgets/layout/')) return false
  if (['map-context-menu', 'controller'].includes(widgetName(widget))) return false
  const parent = widget?.parent
  if (parent && !Object.values(parent).some((infos: any) => infos?.length > 0)) return false
  return true
}

const ACTION_LABEL_KEYS: Record<MenuAction, string> = {
  'copy-coordinate': 'mcmActionCopy',
  'open-widget': 'mcmActionOpenWidget',
  'add-to-coordinate-widget': 'mcmActionAddToCoordinate',
  'whats-here': 'mcmActionWhatsHere',
  'add-label': 'mcmActionAddLabel',
  'add-text': 'mcmActionAddText',
  'center-map': 'mcmActionCenter',
  'zoom-in': 'mcmActionZoomIn',
  'zoom-out': 'mcmActionZoomOut',
  separator: 'mcmSeparator'
}

// Labels that are treated as "not customised" and so follow the selected action.
const GENERIC_LABELS = ['', 'New menu item', 'Menu item', 'Copy Coordinates', 'Open Widget', 'Add to Coordinate Widget',
  "What's here?", 'Add label here', 'Add text here', 'Centre Map Here', 'Zoom In Here', 'Zoom Out Here']

const makeId = () => `menu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const style = css`
  width: 100%;

  .mcm-hint {
    color: var(--sys-color-surface-paper-hint);
    font-size: 0.75rem;
    line-height: 1.4;
  }
  .mcm-list {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-2);
    margin-top: var(--sys-spacing-2);
  }
  .mcm-item {
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape2);
    background: var(--sys-color-surface-paper);
    transition: border-color 120ms ease, opacity 120ms ease;
  }
  .mcm-item.is-expanded {
    border-color: var(--sys-color-divider-primary);
  }
  .mcm-item.is-disabled .mcm-item-title {
    color: var(--sys-color-surface-paper-hint);
  }
  .mcm-item.is-dragging {
    opacity: 0.5;
  }
  .mcm-item.is-drag-over {
    box-shadow: 0 -2px 0 0 var(--sys-color-primary-main);
  }
  .mcm-item-header {
    min-height: 36px;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-1);
    padding: var(--sys-spacing-1) var(--sys-spacing-2) var(--sys-spacing-1) var(--sys-spacing-1);
  }
  .mcm-drag-handle {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 28px;
    border-radius: var(--sys-shape-shape1);
    color: var(--sys-color-surface-paper-hint);
    cursor: grab;
  }
  .mcm-drag-handle:hover {
    background: var(--sys-color-action-hover);
  }
  .mcm-drag-handle:active {
    cursor: grabbing;
  }
  .mcm-expand-button {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-1);
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }
  .mcm-item-title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mcm-item-title.is-separator {
    font-style: italic;
    color: var(--sys-color-surface-paper-hint);
  }
  .mcm-expand-button:focus-visible,
  .mcm-drag-handle:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: 1px;
  }
  .mcm-item-body {
    padding: 0 var(--sys-spacing-3) var(--sys-spacing-3);
    border-top: 1px solid var(--sys-color-divider-tertiary);
  }
  .mcm-item-body .jimu-widget-setting--row {
    margin-top: var(--sys-spacing-3);
  }
  .mcm-item-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: var(--sys-spacing-3);
  }
`

export default function Setting (props: AllWidgetSettingProps<IMConfig>) {
  const translate = hooks.useTranslation(defaultMessages)
  const config = ((props.config as unknown) as Config) || { decimalPlaces: 6, showCoordinateHeader: true, menuItems: [] }
  const items = config.menuItems || []

  // Expansion is Builder-only UI state; it is intentionally not written to config.
  const [expandedItems, setExpandedItems] = React.useState<Record<string, boolean>>({})
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = React.useState<string | null>(null)

  // appStateInBuilder.appConfig is the Experience being edited (not the Builder shell) and includes
  // widgets nested inside Widget Controllers. Selecting it keeps the list current as widgets are added.
  const experienceWidgets = ReactRedux.useSelector((state: IMState) => (state as any).appStateInBuilder?.appConfig?.widgets)

  const widgetOptions = React.useMemo<WidgetOption[]>(() => {
    const widgets: Record<string, any> = experienceWidgets?.asMutable
      ? experienceWidgets.asMutable({ deep: true })
      : (experienceWidgets || {})

    return Object.keys(widgets)
      .filter(id => id !== props.id && isTargetWidget(widgets[id]))
      .map(id => ({
        id,
        label: widgets[id]?.label || widgets[id]?.manifest?.label || id,
        defaultLabel: widgets[id]?.manifest?.i18nMessages?._widgetLabel || widgets[id]?.manifest?.label ||
          String(widgets[id]?.label || id).replace(/\s+\d+$/, ''),
        isCoordinatePoint: widgetName(widgets[id]) === 'coordinate-point',
        isWhatsHere: widgetName(widgets[id]) === 'whats-here',
        isAttributeLabel: widgetName(widgets[id]) === 'attribute-label'
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  }, [experienceWidgets, props.id])

  const targetOptions = (item: MenuItemConfig): WidgetOption[] => {
    const options = item.action === 'add-to-coordinate-widget'
      ? widgetOptions.filter(w => w.isCoordinatePoint)
      : item.action === 'whats-here'
        ? widgetOptions.filter(w => w.isWhatsHere)
        : item.action === 'add-label' || item.action === 'add-text'
          ? widgetOptions.filter(w => w.isAttributeLabel)
          : widgetOptions
    if (item.targetWidgetId && !options.some(w => w.id === item.targetWidgetId)) {
      const label = experienceWidgets?.[item.targetWidgetId]?.label ?? item.targetWidgetId
      return [...options, { id: item.targetWidgetId, label, defaultLabel: label, isCoordinatePoint: false, isWhatsHere: false, isAttributeLabel: false }]
    }
    return options
  }

  const updateConfig = (patch: Partial<Config>) => {
    props.onSettingChange({
      id: props.id,
      config: Immutable({ ...config, ...patch }) as IMConfig
    })
  }

  const updateItems = (nextItems: MenuItemConfig[]) => { updateConfig({ menuItems: nextItems }) }

  const updateItem = (index: number, patch: Partial<MenuItemConfig>) => {
    updateItems(items.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(previous => ({ ...previous, [itemId]: !previous[itemId] }))
  }

  const moveItemTo = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return
    const sourceIndex = items.findIndex(item => item.id === sourceId)
    const targetIndex = items.findIndex(item => item.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) return

    const next = [...items]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(targetIndex, 0, moved)
    updateItems(next)
  }

  const moveItemBy = (index: number, delta: number) => {
    const target = items[index + delta]
    if (target) moveItemTo(items[index].id, target.id)
  }

  const handleDragStart = (event: React.DragEvent<HTMLElement>, itemId: string) => {
    setDraggedItemId(itemId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>, itemId: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dragOverItemId !== itemId) setDragOverItemId(itemId)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault()
    const sourceId = event.dataTransfer.getData('text/plain') || draggedItemId
    if (sourceId) moveItemTo(sourceId, targetId)
    setDraggedItemId(null)
    setDragOverItemId(null)
  }

  const handleDragEnd = () => {
    setDraggedItemId(null)
    setDragOverItemId(null)
  }

  const addItem = () => {
    const id = makeId()
    updateItems([
      ...items,
      { id, label: translate('mcmActionCopy'), action: 'copy-coordinate', enabled: true, sendCoordinateToWidget: true }
    ])
    setExpandedItems(previous => ({ ...previous, [id]: true }))
  }

  const removeItem = (index: number, itemId: string) => {
    updateItems(items.filter((_, i) => i !== index))
    setExpandedItems(previous => {
      const next = { ...previous }
      delete next[itemId]
      return next
    })
  }

  /** True when the label was filled in automatically, so it may follow the action or target. */
  const isAutoLabel = (item: MenuItemConfig) => {
    const label = item.label ?? ''
    if (GENERIC_LABELS.includes(label)) return true
    if (Object.values(ACTION_LABEL_KEYS).some(key => translate(key) === label)) return true
    const target = widgetOptions.find(w => w.id === item.targetWidgetId)
    return !!target && (label === target.defaultLabel || label === target.label)
  }

  const selectTarget = (index: number, item: MenuItemConfig, targetWidgetId: string | undefined) => {
    const target = widgetOptions.find(w => w.id === targetWidgetId)
    const patch: Partial<MenuItemConfig> = { targetWidgetId }
    if (item.action === 'open-widget' && target && isAutoLabel(item)) patch.label = target.defaultLabel
    updateItem(index, patch)
  }

  const changeAction = (index: number, item: MenuItemConfig, action: MenuAction) => {
    const currentIsGeneric = isAutoLabel(item)
    const patch: Partial<MenuItemConfig> = {
      action,
      label: action === 'separator' ? '' : (currentIsGeneric ? translate(ACTION_LABEL_KEYS[action]) : item.label)
    }
    // Pre-select the only What's Here or Attribute Label widget so the common case needs no extra step.
    const candidates = action === 'whats-here'
      ? widgetOptions.filter(w => w.isWhatsHere)
      : action === 'add-label' || action === 'add-text' ? widgetOptions.filter(w => w.isAttributeLabel) : []
    if (candidates.length === 1 && !candidates.some(w => w.id === item.targetWidgetId)) {
      patch.targetWidgetId = candidates[0].id
    }
    updateItem(index, patch)
  }

  return (
    <div css={style} className='map-context-menu-setting'>
      <SettingSection title={translate('mcmMap')}>
        <SettingRow>
          <MapWidgetSelector
            useMapWidgetIds={props.useMapWidgetIds}
            onSelect={(useMapWidgetIds: string[]) => { props.onSettingChange({ id: props.id, useMapWidgetIds }) }}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('mcmCoordinateHeader')}>
        <SettingRow label={translate('mcmShowCoordinateHeader')}>
          <Switch
            checked={config.showCoordinateHeader !== false}
            onChange={(event) => { updateConfig({ showCoordinateHeader: event.target.checked }) }}
            aria-label={translate('mcmShowCoordinateHeader')}
          />
        </SettingRow>
        <SettingRow label={translate('mcmDecimalPlaces')}>
          <NumericInput
            size='sm'
            min={0}
            max={10}
            style={{ width: 72 }}
            value={config.decimalPlaces ?? 6}
            onChange={(value) => { updateConfig({ decimalPlaces: Math.min(10, Math.max(0, Number(value) || 0)) }) }}
            aria-label={translate('mcmDecimalPlaces')}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('mcmMenuItems')}>
        <div className='mcm-hint'>{translate('mcmReorderHint')}</div>

        <div className='mcm-list'>
          {items.map((item, index) => {
            const expanded = expandedItems[item.id] === true
            const isSeparator = item.action === 'separator'
            const title = isSeparator ? translate('mcmSeparator') : (item.label || translate('mcmMenuItem'))
            const classes = ['mcm-item',
              expanded && 'is-expanded',
              item.enabled === false && 'is-disabled',
              draggedItemId === item.id && 'is-dragging',
              dragOverItemId === item.id && draggedItemId !== item.id && 'is-drag-over'
            ].filter(Boolean).join(' ')

            return (
              <div
                className={classes}
                key={item.id}
                onDragOver={(event) => { handleDragOver(event, item.id) }}
                onDrop={(event) => { handleDrop(event, item.id) }}
              >
                <div className='mcm-item-header'>
                  <span
                    className='mcm-drag-handle'
                    draggable
                    role='button'
                    tabIndex={0}
                    title={translate('mcmDragToReorder', { label: title })}
                    aria-label={translate('mcmDragToReorder', { label: title })}
                    onDragStart={(event) => { handleDragStart(event, item.id) }}
                    onDragEnd={handleDragEnd}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                        event.preventDefault()
                        moveItemBy(index, event.key === 'ArrowUp' ? -1 : 1)
                      }
                    }}
                  >
                    <HandleDotVerticalOutlined size={14} />
                  </span>

                  <button
                    className='mcm-expand-button'
                    type='button'
                    aria-expanded={expanded}
                    aria-label={`${translate(expanded ? 'mcmCollapseItem' : 'mcmExpandItem')}: ${title}`}
                    onClick={() => { toggleExpanded(item.id) }}
                  >
                    {expanded ? <DownOutlined size={12} /> : <RightOutlined size={12} />}
                    <span className={`mcm-item-title${isSeparator ? ' is-separator' : ''}`}>{title}</span>
                  </button>

                  <Switch
                    checked={item.enabled !== false}
                    onChange={(event) => { updateItem(index, { enabled: event.target.checked }) }}
                    title={translate('mcmEnableItem')}
                    aria-label={`${translate('mcmEnableItem')}: ${title}`}
                  />
                </div>

                {expanded && (
                  <div className='mcm-item-body'>
                    <SettingRow label={translate('mcmAction')} flow='wrap'>
                      <Select
                        size='sm'
                        value={item.action}
                        onChange={(event) => { changeAction(index, item, event.target.value as MenuAction) }}
                        aria-label={translate('mcmAction')}
                      >
                        {(Object.keys(ACTION_LABEL_KEYS) as MenuAction[]).map(action => (
                          <Option key={action} value={action}>{translate(ACTION_LABEL_KEYS[action])}</Option>
                        ))}
                      </Select>
                    </SettingRow>

                    {!isSeparator && (
                      <SettingRow label={translate('mcmLabel')} flow='wrap'>
                        <TextInput
                          size='sm'
                          className='w-100'
                          value={item.label || ''}
                          onChange={(event) => { updateItem(index, { label: event.target.value }) }}
                          aria-label={translate('mcmLabel')}
                        />
                      </SettingRow>
                    )}

                    {(item.action === 'open-widget' || item.action === 'add-to-coordinate-widget' || item.action === 'whats-here' || item.action === 'add-label' || item.action === 'add-text') && (
                      <>
                        <SettingRow
                          label={translate(item.action === 'add-to-coordinate-widget'
                            ? 'mcmCoordinateWidget'
                            : item.action === 'whats-here'
                              ? 'mcmWhatsHereWidget'
                              : item.action === 'add-label' || item.action === 'add-text' ? 'mcmAttributeLabelWidget' : 'mcmWidgetToOpen')}
                          flow='wrap'
                        >
                          <Select
                            size='sm'
                            value={item.targetWidgetId || ''}
                            onChange={(event) => { selectTarget(index, item, event.target.value || undefined) }}
                          >
                            <Option value=''>{translate('mcmSelectWidget')}</Option>
                            {targetOptions(item).map(widget => (
                              <Option key={widget.id} value={widget.id}>{widget.label}</Option>
                            ))}
                          </Select>
                        </SettingRow>

                        {item.action === 'add-to-coordinate-widget' && !widgetOptions.some(w => w.isCoordinatePoint) && (
                          <div className='mcm-hint mt-2'>{translate('mcmNoCoordinateWidget')}</div>
                        )}

                        {item.action === 'whats-here' && !widgetOptions.some(w => w.isWhatsHere) && (
                          <div className='mcm-hint mt-2'>{translate('mcmNoWhatsHereWidget')}</div>
                        )}

                        {(item.action === 'add-label' || item.action === 'add-text') && !widgetOptions.some(w => w.isAttributeLabel) && (
                          <div className='mcm-hint mt-2'>{translate('mcmNoAttributeLabelWidget')}</div>
                        )}

                        {item.action === 'open-widget' && (
                          <SettingRow label={translate('mcmSendCoordinate')}>
                            <Switch
                              checked={item.sendCoordinateToWidget !== false}
                              onChange={(event) => { updateItem(index, { sendCoordinateToWidget: event.target.checked }) }}
                              aria-label={translate('mcmSendCoordinate')}
                            />
                          </SettingRow>
                        )}
                        <div className='mcm-hint mt-2'>
                          {translate(item.action === 'open-widget'
                            ? 'mcmOpenWidgetHint'
                            : item.action === 'whats-here'
                              ? 'mcmWhatsHereHint'
                              : item.action === 'add-label'
                                ? 'mcmAttributeLabelHint'
                                : item.action === 'add-text' ? 'mcmAttributeTextHint' : 'mcmAddToCoordinateHint')}
                        </div>
                      </>
                    )}

                    <div className='mcm-item-actions'>
                      <Button size='sm' type='tertiary' onClick={() => { removeItem(index, item.id) }}>
                        <TrashOutlined size={14} className='mr-1' />
                        {translate('mcmRemove')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <SettingRow>
          <Button className='w-100' size='sm' type='primary' onClick={addItem}>
            <PlusOutlined size={14} className='mr-1' />
            {translate('mcmAddMenuItem')}
          </Button>
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('mcmRuntimeBehaviour')}>
        <div className='mcm-hint'>{translate('mcmRuntimeInfo')}</div>
      </SettingSection>
    </div>
  )
}
