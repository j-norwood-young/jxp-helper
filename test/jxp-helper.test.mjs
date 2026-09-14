import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, test } from 'node:test';
import { JXPError, JXPHelper } from '../dist/index.js';

let server;
let baseUrl;
const requests = [];

before(async () => {
  server = http.createServer((req, res) => {
    requests.push({ url: req.url, headers: req.headers, method: req.method });
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/user') {
      res.end(JSON.stringify({ data: [{ _id: '1' }] }));
      return;
    }
    if (req.url.startsWith('/failure/')) {
      res.statusCode = 401;
      res.end(JSON.stringify({ message: 'invalid key' }));
      return;
    }
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('sends API keys in the X-API-Key header and never in URLs', async () => {
  const helper = new JXPHelper({ server: baseUrl, apikey: 'test-key' });
  await helper.get('user');
  assert.equal(requests.at(-1).headers['x-api-key'], 'test-key');
  assert.equal(requests.at(-1).url.includes('apikey'), false);
  await helper.get('user', { apikey: 'query-secret', limit: 1 });
  assert.equal(requests.at(-1).url.includes('apikey'), false);
});

test('exposes structured fetch errors', async () => {
  const helper = new JXPHelper({ server: `${baseUrl}/failure`, apikey: 'test-key' });
  await assert.rejects(() => helper.get('anything'), (error) => {
    assert.ok(error instanceof JXPError);
    assert.equal(error.status, 401);
    assert.deepEqual(error.body, { message: 'invalid key' });
    return true;
  });
});

test('supports bearer-token authentication without an API-key query parameter', async () => {
  const helper = new JXPHelper({ server: baseUrl, token: 'bearer-token' });
  await helper.get('user');
  assert.equal(requests.at(-1).headers.authorization, 'Bearer bearer-token');
  assert.equal(requests.at(-1).headers['x-api-key'], undefined);
});
