import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JXPError } from '../dist/index.js';

test('JXPError sets name, message, and request metadata', () => {
  const err = new JXPError({
    status: 403,
    statusText: 'Forbidden',
    body: { message: 'nope' },
    url: 'http://example/api/user',
    method: 'GET'
  });

  assert.equal(err.name, 'JXPError');
  assert.equal(err.message, 'JXP request failed with 403 Forbidden');
  assert.equal(err.status, 403);
  assert.equal(err.statusText, 'Forbidden');
  assert.deepEqual(err.body, { message: 'nope' });
  assert.equal(err.url, 'http://example/api/user');
  assert.equal(err.method, 'GET');
  assert.ok(err instanceof Error);
});
