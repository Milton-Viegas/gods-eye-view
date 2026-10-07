import * as Cesium from 'cesium';
import { createListingsSpLayer } from '../../layers/listingsSp/index.js';
import { createBundledListingsSource } from '../../layers/listingsSp/source.js';
import { overlayHost } from './overlayHost.js';

/** Wire the sample São Paulo listings layer to the application overlay host. */
export function createApplicationListingsSp(options = {}) {
  return createListingsSpLayer({
    overlayHost,
    source: createBundledListingsSource(),
    screenSpaceEventHandlerFactory: (canvas) =>
      new Cesium.ScreenSpaceEventHandler(canvas),
    ...options,
  });
}
