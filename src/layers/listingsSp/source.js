/** Bundled fictional São Paulo listings GeoJSON (Viegas R.E. Broker sample). */
function listingsUrl() {
  return new URL('./listings.geojson', import.meta.url).href;
}

/**
 * Supply the sample FeatureCollection without coupling the renderer to asset URLs.
 * @param {object} [options]
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createBundledListingsSource({
  fetchImpl = (...args) => fetch(...args),
} = {}) {
  return {
    label: 'Viegas R.E. Broker · sample',
    async fetch(signal) {
      signal?.throwIfAborted();
      const response = await fetchImpl(listingsUrl(), {
        signal,
        cache: 'force-cache',
      });
      if (!response.ok) {
        try {
          await response.body?.cancel();
        } catch {
          /* best effort */
        }
        throw new Error(`HTTP ${response.status} for listings GeoJSON`);
      }
      const json = await response.json();
      signal?.throwIfAborted();
      return json;
    },
  };
}
