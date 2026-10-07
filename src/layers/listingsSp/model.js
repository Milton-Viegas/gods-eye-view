export const LISTINGS_SP_OVERLAY_SOURCE_ID = 'listings-sp';
export const LISTINGS_SP_SELECTED_OVERLAY_SOURCE_ID = 'listings-sp-selected';
export const LISTINGS_SP_OVERLAY_COHORT_LIMIT = 32;
export const LISTINGS_SP_OVERLAY_COLLISION_CAPACITY = 16;
export const LISTINGS_SP_SELECTED_OVERLAY_OPTIONS = Object.freeze({
  cohortLimit: 1,
  collisionCapacity: 0,
  moving: false,
});
export const LISTINGS_SP_ACCENT = '#c9a227';

const TYPE_LABELS = Object.freeze({
  apartamento: 'Apartamento',
  casa: 'Casa',
  cobertura: 'Cobertura',
});

const STATUS_LABELS = Object.freeze({
  venda: 'Venda',
  locacao: 'Locação',
});

/** Format BRL amounts for card copy (pt-BR). */
export function formatPriceBRL(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `R$ ${Math.round(amount).toLocaleString('pt-BR')}`;
  }
}

export function typeLabel(type) {
  const key = String(type || '').trim().toLowerCase();
  return TYPE_LABELS[key] || key || 'Imóvel';
}

export function statusLabel(status) {
  const key = String(status || '').trim().toLowerCase();
  return STATUS_LABELS[key] || key || '—';
}

/** Normalize one GeoJSON feature into a plain listing record. */
export function listingFromFeature(feature, index = 0) {
  const props =
    feature?.properties &&
    typeof feature.properties === 'object' &&
    !Array.isArray(feature.properties)
      ? feature.properties
      : {};
  const coords = feature?.geometry?.coordinates;
  const lon = Number(coords?.[0]);
  const lat = Number(coords?.[1]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const id = String(props.id || feature?.id || `listing-${index}`).trim();
  const title = String(props.title || props.name || id).trim() || id;
  return {
    id,
    title,
    neighborhood: String(props.neighborhood || '').trim(),
    type: String(props.type || '').trim().toLowerCase(),
    m2: Number(props.m2),
    priceBRL: Number(props.priceBRL),
    status: String(props.status || '').trim().toLowerCase(),
    photoUrl: props.photoUrl ? String(props.photoUrl).trim() : '',
    url: props.url ? String(props.url).trim() : '#',
    lon,
    lat,
  };
}

/** Ambient card: title + short neighborhood/price line. */
export function createListingAmbientOverlayEntry({ listing, position }) {
  if (!listing?.id || !position) return null;
  const details = [];
  const summary = [
    listing.neighborhood || null,
    Number.isFinite(listing.m2) ? `${Math.round(listing.m2)} m²` : null,
    formatPriceBRL(listing.priceBRL),
  ]
    .filter(Boolean)
    .join(' · ');
  if (summary) details.push(summary);
  return {
    id: String(listing.id),
    position,
    variant: 'card',
    title: listing.title,
    details,
    accent: LISTINGS_SP_ACCENT,
    priority: 500,
    collisionGroup: 'ambient-card',
    zIndex: 30,
    interactive: false,
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
    gapPx: 15,
    placement: 'above',
  };
}

/** Selected detail card with fuller listing copy. */
export function createListingSelectedOverlayEntry({ listing, position }) {
  if (!listing?.id || !position) return null;
  const details = [];
  details.push(
    [
      listing.neighborhood || null,
      typeLabel(listing.type),
      Number.isFinite(listing.m2) ? `${Math.round(listing.m2)} m²` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  );
  details.push(
    `${formatPriceBRL(listing.priceBRL)} · ${statusLabel(listing.status)}`,
  );
  details.push('Viegas R.E. Broker · CRECI 302404-F');
  if (listing.url && listing.url !== '#') details.push(listing.url);
  return {
    id: String(listing.id),
    position,
    variant: 'selected',
    selected: true,
    protected: true,
    paintLane: 'selected',
    collisionGroup: 'ambient-card',
    priority: Number.MAX_SAFE_INTEGER,
    title: listing.title,
    details,
    accent: LISTINGS_SP_ACCENT,
    interactive: false,
    anchorRadiusPx: 10,
    minAnchorGapPx: 12,
    verticalOnly: true,
    placement: 'above',
    edgeFade: 'keyhole',
    horizonCull: true,
    terrainOcclusion: false,
  };
}
