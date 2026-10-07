import * as Cesium from 'cesium';
import { isPointerFree } from '../../data/inputOwnership.js';
import {
  LISTINGS_SP_ACCENT,
  LISTINGS_SP_OVERLAY_COHORT_LIMIT,
  LISTINGS_SP_OVERLAY_COLLISION_CAPACITY,
  LISTINGS_SP_OVERLAY_SOURCE_ID,
  LISTINGS_SP_SELECTED_OVERLAY_OPTIONS,
  LISTINGS_SP_SELECTED_OVERLAY_SOURCE_ID,
  createListingAmbientOverlayEntry,
  createListingSelectedOverlayEntry,
  listingFromFeature,
} from './model.js';
export * from './model.js';
export { createBundledListingsSource } from './source.js';

/**
 * Skeleton high-end São Paulo listings layer (sample GeoJSON + detail card).
 * Points on the globe; click publishes a selected overlay card.
 */
export function createListingsSpLayer({
  source,
  overlayHost,
  screenSpaceEventHandlerFactory = (canvas) =>
    new Cesium.ScreenSpaceEventHandler(canvas),
} = {}) {
  if (typeof source?.fetch !== 'function')
    throw new TypeError('Listings require a fetch(signal) source');
  if (!overlayHost) throw new TypeError('Listings require an overlay host');

  let _viewer = null;
  let _dataSource = null;
  let _request = null;
  let _clickHandler = null;
  let _count = 0;
  let _lastUpdate = null;
  let _lastError = null;
  let _enabled = false;
  let _loaded = false;
  /** @type {Map<string, {listing: object, position: Cesium.Cartesian3, entity: Cesium.Entity}>} */
  const _byId = new Map();
  let _selectedId = null;

  const accent = Cesium.Color.fromCssColorString(LISTINGS_SP_ACCENT);

  function clearSelection() {
    _selectedId = null;
    overlayHost.clearSource(LISTINGS_SP_SELECTED_OVERLAY_SOURCE_ID);
  }

  function selectListing(id) {
    const record = _byId.get(id);
    if (!record) return;
    _selectedId = id;
    const entry = createListingSelectedOverlayEntry({
      listing: record.listing,
      position: record.position,
    });
    overlayHost.setEntries(
      LISTINGS_SP_SELECTED_OVERLAY_SOURCE_ID,
      entry ? [entry] : [],
      LISTINGS_SP_SELECTED_OVERLAY_OPTIONS,
    );
    overlayHost.setVisible(LISTINGS_SP_SELECTED_OVERLAY_SOURCE_ID, true);
  }

  function publishAmbient() {
    const entries = [];
    for (const { listing, position } of _byId.values()) {
      const entry = createListingAmbientOverlayEntry({ listing, position });
      if (entry) entries.push(entry);
    }
    overlayHost.setEntries(LISTINGS_SP_OVERLAY_SOURCE_ID, entries, {
      cohortLimit: LISTINGS_SP_OVERLAY_COHORT_LIMIT,
      collisionCapacity: LISTINGS_SP_OVERLAY_COLLISION_CAPACITY,
      moving: false,
    });
  }

  function beginInteraction(viewer) {
    if (_clickHandler) return;
    _clickHandler = screenSpaceEventHandlerFactory(viewer.scene.canvas);
    _clickHandler.setInputAction((click) => {
      if (!isPointerFree()) return;
      if (!_enabled) return;
      const picked = viewer.scene.pick(click.position);
      const entity = picked?.id;
      const listingId =
        entity?.__listingsSpId ||
        (typeof entity?.id === 'string' && entity.id.startsWith('listings-sp:')
          ? entity.id.slice('listings-sp:'.length)
          : null);
      if (listingId && _byId.has(listingId)) {
        selectListing(listingId);
        const record = _byId.get(listingId);
        viewer.camera.cancelFlight();
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            record.listing.lon,
            record.listing.lat,
            1200,
          ),
          orientation: {
            heading: viewer.camera.heading || 0,
            pitch: Cesium.Math.toRadians(-45),
            roll: 0,
          },
          duration: 1.2,
          easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        });
        return;
      }
      // Empty space clears this layer's selection; sibling picks are left alone.
      if (picked) return;
      clearSelection();
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  function endInteraction() {
    if (_clickHandler) {
      _clickHandler.destroy();
      _clickHandler = null;
    }
  }

  const layer = {
    id: 'listings-sp',
    name: 'SP Listings (Viegas)',
    icon: '⌂',
    source: source.label || 'Viegas R.E. Broker · sample',
    updateInterval: 0,

    init(viewer) {
      if (_viewer) throw new Error('Listings layer is already initialized');
      _viewer = viewer;
      _dataSource = new Cesium.CustomDataSource('listings-sp');
      _dataSource.show = false;
      viewer.dataSources.add(_dataSource);
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
      _enabled = false;
      _loaded = false;
      overlayHost.setVisible(LISTINGS_SP_OVERLAY_SOURCE_ID, false);
      overlayHost.setVisible(LISTINGS_SP_SELECTED_OVERLAY_SOURCE_ID, false);
      beginInteraction(viewer);
      console.log('[Data:ListingsSP] Initialized');
    },

    enable(viewer) {
      _enabled = true;
      if (_dataSource) _dataSource.show = true;
      overlayHost.setVisible(LISTINGS_SP_OVERLAY_SOURCE_ID, true);
      overlayHost.setVisible(LISTINGS_SP_SELECTED_OVERLAY_SOURCE_ID, true);
      void layer.update(viewer || _viewer);
    },

    disable() {
      _request?.abort();
      _request = null;
      _enabled = false;
      if (_dataSource) _dataSource.show = false;
      clearSelection();
      overlayHost.clearSource(LISTINGS_SP_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(LISTINGS_SP_OVERLAY_SOURCE_ID, false);
      overlayHost.setVisible(LISTINGS_SP_SELECTED_OVERLAY_SOURCE_ID, false);
    },

    async update(viewer) {
      if (!_enabled || !_dataSource) return false;
      if (_loaded && _byId.size > 0) {
        publishAmbient();
        if (_selectedId) selectListing(_selectedId);
        return true;
      }
      _request?.abort();
      const request = new AbortController();
      _request = request;
      try {
        const collection = await source.fetch(request.signal);
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;

        const features = Array.isArray(collection?.features)
          ? collection.features
          : [];
        _dataSource.entities.removeAll();
        _byId.clear();
        clearSelection();

        let count = 0;
        for (let i = 0; i < features.length; i++) {
          const listing = listingFromFeature(features[i], i);
          if (!listing) continue;
          count++;
          const position = Cesium.Cartesian3.fromDegrees(
            listing.lon,
            listing.lat,
            40,
          );
          const entity = _dataSource.entities.add(
            new Cesium.Entity({
              id: `listings-sp:${listing.id}`,
              position,
              point: {
                pixelSize: 12,
                color: accent,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              },
              properties: {
                listingId: listing.id,
                title: listing.title,
                neighborhood: listing.neighborhood,
                type: listing.type,
                m2: listing.m2,
                priceBRL: listing.priceBRL,
                status: listing.status,
                url: listing.url,
              },
            }),
          );
          entity.__listingsSpId = listing.id;
          _byId.set(listing.id, { listing, position, entity });
        }

        if (_enabled) publishAmbient();

        _count = count;
        _lastUpdate = Date.now();
        _lastError = null;
        _loaded = true;
        console.log(`[Data:ListingsSP] Updated: ${_count} listings`);
        return true;
      } catch (e) {
        if (request.signal.aborted || _request !== request || !_enabled)
          return false;
        console.warn('[Data:ListingsSP] Fetch error:', e);
        _lastError = e?.message || 'Listings source unavailable';
        return false;
      } finally {
        if (_request === request) _request = null;
      }
    },

    destroy(viewer = _viewer) {
      _request?.abort();
      _request = null;
      endInteraction();
      clearSelection();
      overlayHost.clearSource(LISTINGS_SP_OVERLAY_SOURCE_ID);
      overlayHost.setVisible(LISTINGS_SP_OVERLAY_SOURCE_ID, false);
      overlayHost.setVisible(LISTINGS_SP_SELECTED_OVERLAY_SOURCE_ID, false);
      _byId.clear();
      _viewer = null;
      _enabled = false;
      _loaded = false;
      if (_dataSource) {
        viewer?.dataSources?.remove(_dataSource, true);
        _dataSource = null;
      }
      _count = 0;
      _lastUpdate = null;
      _lastError = null;
    },

    getStats() {
      return {
        count: _count,
        lastUpdate: _lastUpdate,
        error: _lastError,
        selectedId: _selectedId,
      };
    },
  };
  return layer;
}
