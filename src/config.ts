import type { ImmutableObject } from 'seamless-immutable'

export type MenuAction =
  | 'copy-coordinate'
  | 'open-widget'
  | 'add-to-coordinate-widget'
  | 'whats-here'
  | 'add-label'
  | 'add-text'
  | 'center-map'
  | 'zoom-in'
  | 'zoom-out'
  | 'separator'

export interface MenuItemConfig {
  id: string
  label: string
  action: MenuAction
  enabled: boolean
  targetWidgetId?: string
  sendCoordinateToWidget?: boolean
}

export interface Config {
  decimalPlaces: number
  showCoordinateHeader: boolean
  menuItems: MenuItemConfig[]
}

export type IMConfig = ImmutableObject<Config>
