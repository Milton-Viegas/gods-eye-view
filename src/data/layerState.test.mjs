import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REGISTERED_LAYER_IDS,
  LAYER_STATE_TOKEN_RESERVATIONS,
} from './layerState.js';

// Slim smoke tests for the Milton-Viegas fork.
// Full upstream suite is large; this keeps CI/registry checks honest for listings-sp.

test('registry includes listings-sp', () => {
  assert.ok(REGISTERED_LAYER_IDS.includes('listings-sp'));
});

test('registered layer count is 29', () => {
  assert.equal(REGISTERED_LAYER_IDS.length, 29);
});

test('listings-sp has a reserved layer-state token', () => {
  const reserved = LAYER_STATE_TOKEN_RESERVATIONS?.['listings-sp'];
  assert.ok(reserved !== undefined && reserved !== null);
});
