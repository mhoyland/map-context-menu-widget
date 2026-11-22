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
| Add text here | text | Opens a small **Add text** dialog at the right-clicked spot. The text box starts with the last free text, selected so typing replaces it. **Enter** adds the text, **Shift+Enter** starts a new line, **Esc** closes. The text is placed in the Attribute Label widget's current style without opening that widget, and a message offers **Undo**. **More options…** places the text at the spot too, then opens it in Attribute Label's editor to change the text and style (Cancel there removes it). |
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

## Shared with [Attribute Label](https://github.com/mhoyland/attribute-label-widget)

*Add text here* places text without opening Attribute Label, so the two widgets share a small contract.
Either widget works without the other; if something is missing, the defaults below are used. Update both
widgets together if any of this changes.

| What | Where |
|---|---|
| Saved free text and style | `localStorage` key `exb-attribute-label:<appId or page path>:<Attribute Label widget id>`; Map Context Menu reads `freeText` and `style`, and writes `freeText`. Missing style falls back to Attribute Label's builder default style, then Arial 12 pt with a white halo. |
| Label style → TextSymbol | Attribute Label `src/runtime/label.ts` (`toTextSymbolProperties`), copied in Map Context Menu `src/runtime/attribute-label-bridge.ts` (`makeTextSymbol`). |
| Label tag | Graphic attributes `alSource: 'attribute-label'`, `alKind`, `alKey`, so Attribute Label lists the text; `alId` on text placed by *More options…*, so Attribute Label can open it in the editor. |
| Layers | Draw's `jimu-draw-layer-<mapViewId>-…`, else Attribute Label's holding layer `attribute-label-<widgetId>`. |
| Messages | `mutableStateProps.labelRequest` (`mode`: `feature`, `text`, `text-options`, `edit-text`; optional `text` and `labelId`) and `mutableStateProps.freeTextUpdate` (`text`). |

## Licence

[MIT](LICENSE)
