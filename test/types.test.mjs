import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isMfaRequired } from '../dist/index.js';

test('isMfaRequired is true for mfa_required payloads', () => {
  assert.equal(
    isMfaRequired({
      status: 'mfa_required',
      challenge: 'c',
      methods: ['totp']
    }),
    true
  );
});

test('isMfaRequired is false for token pairs', () => {
  assert.equal(
    isMfaRequired({
      user_id: 'u1',
      token: 't'
    }),
    false
  );
});

test('isMfaRequired is false for unrelated status values', () => {
  assert.equal(isMfaRequired({ status: 'ok', user_id: 'u1', token: 't' }), false);
});
