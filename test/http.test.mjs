import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { JXPError } from '../dist/index.js';
import { jxpRequest } from '../dist/http.js';
import { createMockServer, jsonError, jsonOk, textOk } from './helpers/mock-server.mjs';

const mock = createMockServer({
  'GET /json': () => jsonOk({ hello: 'world' }),
  'GET /text': () => textOk('a,b,c\n1,2,3', 200, 'text/plain'),
  'POST /echo': (req) => jsonOk({ received: req.body }),
  'GET /fail': () => jsonError(401, { message: 'invalid key' }),
  'GET /fail-text': () => textOk('plain error', 500, 'text/plain')
});

let baseUrl;

before(async () => {
  baseUrl = await mock.listen();
});

after(async () => {
  await mock.close();
});

test('jxpRequest returns JSON when content-type includes json', async () => {
  const result = await jxpRequest(`${baseUrl}/json`, 'key', undefined);
  assert.deepEqual(result, { hello: 'world' });
});

test('jxpRequest returns text when content-type is not json', async () => {
  const result = await jxpRequest(`${baseUrl}/text`, undefined, undefined);
  assert.equal(result, 'a,b,c\n1,2,3');
});

test('jxpRequest sends X-API-Key when only apiKey is provided', async () => {
  mock.clearRequests();
  await jxpRequest(`${baseUrl}/json`, 'api-secret', undefined);
  assert.equal(mock.lastRequest().headers['x-api-key'], 'api-secret');
  assert.equal(mock.lastRequest().headers.authorization, undefined);
});

test('jxpRequest sends Bearer when bearerToken is provided', async () => {
  mock.clearRequests();
  await jxpRequest(`${baseUrl}/json`, undefined, 'tok');
  assert.equal(mock.lastRequest().headers.authorization, 'Bearer tok');
  assert.equal(mock.lastRequest().headers['x-api-key'], undefined);
});

test('jxpRequest prefers bearer over API key', async () => {
  mock.clearRequests();
  await jxpRequest(`${baseUrl}/json`, 'api-secret', 'tok');
  assert.equal(mock.lastRequest().headers.authorization, 'Bearer tok');
  assert.equal(mock.lastRequest().headers['x-api-key'], undefined);
});

test('jxpRequest sends JSON body with Content-Type', async () => {
  mock.clearRequests();
  const result = await jxpRequest(`${baseUrl}/echo`, 'key', undefined, {
    method: 'POST',
    body: { a: 1 }
  });
  assert.equal(mock.lastRequest().headers['content-type'], 'application/json');
  assert.deepEqual(mock.lastRequest().body, { a: 1 });
  assert.deepEqual(result, { received: { a: 1 } });
});

test('jxpRequest throws JXPError for non-OK JSON responses', async () => {
  await assert.rejects(
    () => jxpRequest(`${baseUrl}/fail`, 'key', undefined),
    (error) => {
      assert.ok(error instanceof JXPError);
      assert.equal(error.status, 401);
      assert.equal(error.method, 'GET');
      assert.deepEqual(error.body, { message: 'invalid key' });
      assert.match(error.url, /\/fail$/);
      return true;
    }
  );
});

test('jxpRequest throws JXPError for non-OK text responses', async () => {
  await assert.rejects(
    () => jxpRequest(`${baseUrl}/fail-text`, undefined, undefined),
    (error) => {
      assert.ok(error instanceof JXPError);
      assert.equal(error.status, 500);
      assert.equal(error.body, 'plain error');
      return true;
    }
  );
});

test('jxpRequest defaults method to GET', async () => {
  mock.clearRequests();
  await jxpRequest(`${baseUrl}/json`, undefined, undefined);
  assert.equal(mock.lastRequest().method, 'GET');
});

test('jxpRequest accepts a custom AbortSignal', async () => {
  const controller = new AbortController();
  const result = await jxpRequest(`${baseUrl}/json`, undefined, undefined, {
    signal: controller.signal
  });
  assert.deepEqual(result, { hello: 'world' });
});

test('jxpRequest treats missing content-type as text', async () => {
  mock.setHandler('GET /notype', (_req, res) => {
    res.statusCode = 200;
    res.end('plain');
  });
  const result = await jxpRequest(`${baseUrl}/notype`, undefined, undefined);
  assert.equal(result, 'plain');
});
