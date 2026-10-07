# listings-sp — São Paulo listings (skeleton)

High-end São Paulo real-estate sample layer for the local God's Eye View clone.

**Brand:** Viegas R.E. Broker (CRECI 302404-F) · https://viegas-rebroker.com.br

## What this is

- Layer id: `listings-sp`
- Sample inventory only (fictional). Neighborhoods: Jardins, Itaim, Pinheiros, Morumbi.
- Renders point markers on the Cesium globe and shows a minimal selected detail card on click (world-overlay host).

## How to replace the sample GeoJSON with real inventory

1. Edit or replace `listings.geojson` in this folder (or point `source.js` at another URL).
2. Keep Feature `Point` geometries (`[lon, lat]`).
3. Required / expected properties per feature:
   - `id` (stable string)
   - `title`
   - `neighborhood`
   - `type` — `apartamento` | `casa` | `cobertura`
   - `m2` (number)
   - `priceBRL` (number)
   - `status` — `venda` | `locacao`
   - `photoUrl` (optional; placeholder URL or omit)
   - `url` (listing page or `#`)
4. Reload the app and toggle **SP Listings (Viegas)** under Data Layers → Infrastructure.

No API keys are required for the bundled sample. If you later wire a live CRM/API feed, keep secrets out of the client bundle (proxy or server-side).

## Commercial note (TeleGeography)

TeleGeography submarine-cable data shipped elsewhere in this project is **unrelated** to this listings layer. That cable dataset is CC BY-NC-SA 3.0 and must not be used commercially without a TeleGeography license. This listings layer does not use or depend on TeleGeography data.

## UI

Open the Data Layers panel → group **Infrastructure** → enable **SP Listings (Viegas)**. Fly to São Paulo to see the sample points; click a point for the detail card.
