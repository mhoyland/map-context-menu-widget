# Map Context Menu

Always-on right-click context menu for an ArcGIS Experience Builder Map widget (Developer Edition 1.21).

## Installation

ArcGIS Experience Builder Developer Edition 1.21.

1. Copy this folder to `client/your-extensions/widgets/map-context-menu`.
2. Restart the client dev server (`npm start` in `client/`).
3. Add the widget to an experience in the builder.

## Placement

Place the widget **directly on the page**, not inside a Widget Controller. It renders as a 1 × 1 invisible host
so its right-click listener is active as soon as the page loads. Select it later from the Builder **Outline**.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Map | — | The Map widget to attach to. |
| Show coordinate header | on | Shows `latitude, longitude` with a copy button at the top of the menu. |
| Decimal places | 6 | 0–10. |
| Menu items | Copy, Zoom in, Centre | Add, remove, enable/disable, rename and drag to reorder. The drag handle also accepts ↑/↓ keys. |
| Target widget | — | For *Open widget*: widgets placed in the app, excluding layout containers, Widget Controllers and other context menus. For *Add to Coordinate Point*: Coordinate Point widgets only. For *What's here?*: What's Here widgets only (pre-selected when there is just one). For *Add label here* and *Add text here*: Attribute Label widgets only (pre-selected when there is just one). |

## Actions

| Action | Icon | Behaviour |
|---|---|---|
| Copy coordinates | copy | Copies `lat, lon`, shows a check mark, then closes. |
| Open widget | target widget's own icon | Opens the selected widget; optionally writes `mutableStateProps.mapContext`. Choosing a target fills in the label with the widget's name (e.g. *Print*) unless you have typed your own. The target must be inside a Widget Controller or similar container; a widget placed directly on the page is always open. |
| Add to Coordinate Point ([Coordinate Point](https://github.com/mhoyland/coordinate-point-widget)) | pin | Writes `mutableStateProps.coordinateAddRequest` to the target, then opens it. |
| What's here? ([What's Here](https://github.com/mhoyland/whats-here-widget)) | select point | Writes `mutableStateProps.whatsHereRequest` to the target What's Here widget, then opens it. It lists the features of every visible layer at the right-clicked point. |
| Add label here ([Attribute Label](https://github.com/mhoyland/attribute-label-widget)) | text | Writes `mutableStateProps.labelRequest` to the target Attribute Label widget and opens it. The widget labels the feature at that point with its current layer, fields and style. |
| Add text here | text | Same as *Add label here* with `mode: 'text'`: the widget places its free text at that point. |
| Centre map here | locate | `view.goTo(point)` |
| Zoom in / out here | zoom | `view.goTo({ target, zoom ± 1 })` |
| Separator | — | Divider line. |

## Keyboard and accessibility

- Focus moves into the menu when it opens.
- ↑ / ↓ / Home / End move between items; Enter or Space activates; Esc or Tab closes and returns focus to the map.
- Colours, shadow and typography come from the app theme (`theme.sys.*`), so light and dark themes are supported.

## Hand-off payloads

`mapContext` (Open widget):

```ts
{ sourceWidgetId, source: 'map-context-menu', latitude, longitude, mapX, mapY, wkid }
```

`coordinateAddRequest` (Add to Coordinate Point) — same fields plus a unique `requestId` and `action: 'add-coordinate'`.

`whatsHereRequest` (What's here?) and `labelRequest` (Add label here) — same fields as `mapContext` plus a unique `requestId`.
The payload is written *before* `openWidget()` so a target inside a Widget Controller receives it on mount. The
`requestId` lets the receiver ignore re-renders while still allowing the same location to be added twice.

## Compatibility

Saved configuration from v1.x is read unchanged (`decimalPlaces`, `showCoordinateHeader`, `menuItems`).

## Licence

[MIT](LICENSE)
