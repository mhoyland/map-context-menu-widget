import { appActions, getAppStore, jimuHistory, type IMAppConfig } from 'jimu-core'

type Owner =
  | { kind: 'view', viewId: string, sectionId: string }
  | { kind: 'widget', widgetId: string, layoutName: string }

/** Layouts (any size mode) whose content holds the widget or section. */
const layoutsHolding = (appConfig: IMAppConfig, match: (item: any) => boolean): string[] =>
  Object.entries(appConfig.layouts ?? {})
    .filter(([, layout]: [string, any]) => Object.values(layout?.content ?? {}).some((item: any) => !item?.isPending && match(item)))
    .map(([layoutId]) => layoutId)

/**
 * The view or widget (Sidebar, Widget Controller, ...) a layout belongs to at the current screen size;
 * pages, windows, header and footer end the walk. Each screen size can use its own containers (the Tab
 * template has a different Sidebar per size), so a layout only counts if it is the one shown now, falling
 * back to the main size mode's layout as ExB does.
 */
const ownersOfLayout = (appConfig: IMAppConfig, layoutId: string, sizeMode: string): Owner[] => {
  const shown = (sizeModes: any): string => sizeModes?.[sizeMode] ?? sizeModes?.[appConfig.mainSizeMode]
  const owners: Owner[] = []
  Object.entries(appConfig.views ?? {}).forEach(([viewId, view]: [string, any]) => {
    if (shown(view?.layout) !== layoutId) return
    const sectionId = Object.keys(appConfig.sections ?? {}).find(id => appConfig.sections[id].views?.includes(viewId))
    if (sectionId) owners.push({ kind: 'view', viewId, sectionId })
  })
  Object.entries(appConfig.widgets ?? {}).forEach(([widgetId, widget]: [string, any]) => {
    Object.entries(widget?.layouts ?? {}).forEach(([layoutName, sizeModes]: [string, any]) => {
      if (shown(sizeModes) === layoutId) owners.push({ kind: 'widget', widgetId, layoutName })
    })
  })
  return owners
}

const isSidebar = (widget: any): boolean => String(widget?.uri ?? '').includes('widgets/layout/sidebar/')

/**
 * Makes a widget visible wherever it is placed: switches every section on the way up to the view
 * holding it, and opens every Sidebar whose collapsible side holds it. `openWidget` is still
 * dispatched so a widget inside a Widget Controller opens as before.
 */
export function revealWidget (widgetId: string): void {
  const store = getAppStore()
  const appConfig = store.getState().appConfig
  if (!appConfig) return
  const sizeMode = store.getState().browserSizeMode ?? appConfig.mainSizeMode

  const views = new Map<string, string>() // sectionId -> viewId
  const sidebars = new Set<string>()
  const visited = new Set<string>()

  // Walk outwards from the widget, one container level at a time.
  let layouts = layoutsHolding(appConfig, item => item?.widgetId === widgetId)
  while (layouts.length) {
    const next: string[] = []
    layouts.forEach(layoutId => {
      if (visited.has(layoutId)) return
      visited.add(layoutId)
      ownersOfLayout(appConfig, layoutId, sizeMode).forEach(owner => {
        if (owner.kind === 'view') {
          if (!views.has(owner.sectionId)) views.set(owner.sectionId, owner.viewId)
          next.push(...layoutsHolding(appConfig, item => item?.type === 'SECTION' && item?.sectionId === owner.sectionId))
        } else {
          const container = appConfig.widgets[owner.widgetId]
          if (isSidebar(container) && owner.layoutName === (container.config?.collapseSide ?? 'FIRST')) sidebars.add(owner.widgetId)
          next.push(...layoutsHolding(appConfig, item => item?.widgetId === owner.widgetId))
        }
      })
    })
    layouts = next
  }

  const sectionNavInfos = store.getState().appRuntimeInfo?.sectionNavInfos
  views.forEach((viewId, sectionId) => {
    if (sectionNavInfos?.[sectionId]?.currentViewId !== viewId) jimuHistory.changeView(sectionId, viewId)
  })
  // On a Sidebar, collapse === true means the collapsible side is showing.
  sidebars.forEach(id => store.dispatch(appActions.widgetStatePropChange(id, 'collapse', true)))
  store.dispatch(appActions.openWidget(widgetId))
}
