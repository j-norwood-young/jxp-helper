import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { JXPError, JXPHelper, isMfaRequired } from '../dist/index.js';
import { createMockServer, jsonError, jsonOk, textOk } from './helpers/mock-server.mjs';

const mockServer = createMockServer({
  'POST /login': (req) => {
    if (req.body?.email === 'mfa@example.com') {
      return jsonOk({
        status: 'mfa_required',
        challenge: 'challenge-jwt',
        methods: ['totp']
      });
    }
    if (req.body?.email === 'bad@example.com') {
      return jsonOk({ user_id: 'u1' });
    }
    return jsonOk({
      user_id: 'u1',
      token: 'access-token',
      refresh_token: 'refresh-token'
    });
  },
  'POST /login/mfa': (req) => {
    if (req.body?.code === '000000') {
      return jsonOk({ user_id: 'u1' });
    }
    return jsonOk({
      user_id: 'u1',
      token: 'access-after-mfa',
      refresh_token: 'refresh-token'
    });
  },
  'POST /refresh': (req) => {
    const auth = req.headers.authorization ?? '';
    if (auth.includes('bad-refresh')) {
      return jsonOk({ user_id: 'u1' });
    }
    return jsonOk({
      user_id: 'u1',
      token: 'access-refreshed',
      refresh_token: 'refresh-2'
    });
  },
  'GET /api/user/u1': () => jsonOk({ _id: 'u1', email: 'user@example.com' }),
  'GET /api/user': (req) => {
    const email = req.searchParams['filter[email]'];
    if (email === 'exists@example.com') {
      return jsonOk({ data: [{ _id: 'existing-id', email }] });
    }
    if (req.searchParams['filter[parent_id]'] === 'p1') {
      return jsonOk({
        data: [
          { _id: 'keep', parent_id: 'p1', name: 'keep' },
          { _id: 'remove', parent_id: 'p1', name: 'remove' }
        ]
      });
    }
    if (req.searchParams['filter[parent_id]'] === 'gone') {
      return jsonOk({ data: [{ _id: '1' }, { _id: '1' }] });
    }
    // Unfiltered list reads used by auth / get tests
    if (!email && !req.searchParams['filter[parent_id]']) {
      return jsonOk({ data: [{ _id: '1' }], count: 1 });
    }
    return jsonOk({ data: [] });
  },
  'GET /api/article/a1': () => jsonOk({ _id: 'a1', title: 'Hello' }),
  'GET /csv/user': () => textOk('id,email\n1,a@b.c'),
  'POST /query/user': (req) => jsonOk({ rows: [{ q: req.body?.query }] }),
  'POST /aggregate/user': (req) => jsonOk({ pipeline: req.body?.query }),
  'POST /bulkwrite/user': (req) => jsonOk({ ok: true, ops: req.body }),
  'GET /count/user': () => jsonOk({ count: 42 }),
  'POST /api/user': (req) => jsonOk({ data: { _id: 'new', ...req.body } }),
  'PUT /api/user/existing-id': (req) => jsonOk({ data: { _id: 'existing-id', ...req.body } }),
  'PUT /api/user/keep': (req) => jsonOk({ data: { _id: 'keep', ...req.body } }),
  'DELETE /api/user/1': () => jsonOk({ deleted: true }),
  'DELETE /api/user/remove': () => jsonOk({ deleted: 'remove' }),
  'DELETE /api/user/keep': () => jsonOk({ deleted: 'keep' }),
  'POST /call/user/ping': (req) => jsonOk({ pong: req.body }),
  'GET /groups/u1': () => jsonOk({ groups: ['admin', 'editor'] }),
  'GET /groups/empty': () => jsonOk({ groups: [] }),
  'PUT /groups/u1': (req) => jsonOk({ groups: req.body }),
  'POST /groups/u1': (req) => jsonOk({ added: req.body }),
  'DELETE /groups/u1': () => jsonOk({ removed: true }),
  'GET /groups/fail': () => jsonError(400, { message: 'bad groups get' }),
  'POST /login/getjwt': (req) => jsonOk({ jwt: `jwt-for-${req.body?.email}` }),
  'GET /model/user': () => jsonOk({ name: 'User', fields: {} }),
  'GET /model': () => jsonOk([{ name: 'User' }, { name: 'Article' }]),
  'GET /api/boom': () => jsonError(500, { message: 'boom' }),
  'GET /api/article/missing': () => jsonError(404, { message: 'not found' }),
  'POST /api/fail': () => jsonError(400, { message: 'bad post' }),
  'PUT /api/fail/1': () => jsonError(400, { message: 'bad put' }),
  'DELETE /api/fail/1': () => jsonError(400, { message: 'bad delete' }),
  'POST /bulkwrite/fail': () => jsonError(400, { message: 'bad bulk' }),
  'GET /count/fail': () => jsonError(400, { message: 'bad count' }),
  'POST /query/fail': () => jsonError(400, { message: 'bad query' }),
  'POST /aggregate/fail': () => jsonError(400, { message: 'bad aggregate' }),
  'GET /csv/fail': () => jsonError(400, { message: 'bad csv' }),
  'POST /call/fail/x': () => jsonError(400, { message: 'bad call' }),
  'PUT /groups/fail': () => jsonError(400, { message: 'bad groups put' }),
  'POST /groups/fail': () => jsonError(400, { message: 'bad groups post' }),
  'DELETE /groups/fail': () => jsonError(400, { message: 'bad groups del' }),
  'POST /login/getjwt-fail': () => jsonError(401, { message: 'jwt denied' }),
  'GET /model/missing': () => jsonError(404, { message: 'no model' })
});

let baseUrl;

before(async () => {
  baseUrl = await mockServer.listen();
});

after(async () => {
  await mockServer.close();
});

beforeEach(() => {
  mockServer.clearRequests();
});

function helper(opts = {}) {
  return new JXPHelper({ server: baseUrl, apikey: 'test-key', hideErrors: true, ...opts });
}

describe('constructor and config', () => {
  test('requires server', () => {
    assert.throws(() => new JXPHelper({}), /parameter 'server' required/);
  });

  test('sets defaults and api base path', () => {
    const api = new JXPHelper({ server: baseUrl, apikey: 'k' });
    assert.equal(api.server, baseUrl);
    assert.equal(api.api, `${baseUrl}/api`);
    assert.equal(api.debug, false);
    assert.equal(api.hideErrors, false);
    assert.equal(api.apikey, 'k');
  });

  test('config merges options and useAccessToken sets bearer', () => {
    const api = helper();
    api.config({ debug: true, hideErrors: false });
    assert.equal(api.debug, true);
    assert.equal(api.hideErrors, false);
    const returned = api.useAccessToken('new-token');
    assert.equal(api.token, 'new-token');
    assert.equal(returned, api);
  });
});

describe('url and query params', () => {
  test('builds urls with encoded params and array expansion', () => {
    const api = helper();
    assert.equal(api.url('user'), `${baseUrl}/api/user`);
    assert.equal(
      api.url('user', { limit: 10, 'filter[name]': 'a b' }),
      `${baseUrl}/api/user?limit=10&filter[name]=a%20b`
    );
    assert.equal(
      api.url('user', { id: ['a', 'b'] }, 'count'),
      `${baseUrl}/count/user?id=a&id=b`
    );
  });

  test('strips apikey-like query options from URLs', async () => {
    const api = helper();
    await api.get('user', {
      apikey: 'secret',
      api_key: 'secret',
      apiKey: 'secret',
      'x-api-key': 'secret',
      limit: 1
    });
    const url = mockServer.lastRequest().url;
    assert.equal(url.includes('apikey'), false);
    assert.equal(url.includes('api_key'), false);
    assert.equal(url.includes('apiKey'), false);
    assert.equal(url.includes('x-api-key'), false);
    assert.match(url, /limit=1/);
  });
});

/**
 * Fixed get/_configParams behavior: nullish/empty omission, object expansion,
 * filters→filter alias, and search { q } coercion.
 */
describe('get query-param edge cases (revengine workarounds)', () => {
  test('null filter value is omitted (null-safe)', () => {
    const api = helper();
    assert.equal(
      api.url('user', /** @type {any} */ ({ 'filter[x]': null, limit: 1 })),
      `${baseUrl}/api/user?limit=1`
    );
  });

  test('undefined filter value is omitted (undefined-safe)', () => {
    const api = helper();
    assert.equal(
      api.url('user', /** @type {any} */ ({ 'filter[x]': undefined, limit: 1 })),
      `${baseUrl}/api/user?limit=1`
    );
  });

  test('empty-string filter is omitted', () => {
    const api = helper();
    assert.equal(
      api.url('user', { 'filter[x]': '', limit: 1 }),
      `${baseUrl}/api/user?limit=1`
    );
  });

  test('object sort sugar expands to sort[name]=1', () => {
    const api = helper();
    assert.equal(
      api.url('user', /** @type {any} */ ({ sort: { name: '1' } })),
      `${baseUrl}/api/user?sort[name]=1`
    );
  });

  test('object filters sugar expands to filter[_id]=abc', () => {
    const api = helper();
    assert.equal(
      api.url('user', /** @type {any} */ ({ filters: { _id: 'abc' } })),
      `${baseUrl}/api/user?filter[_id]=abc`
    );
  });

  test('search { q } coerces to plain search=foo', () => {
    const api = helper();
    assert.equal(
      api.url('user', /** @type {any} */ ({ search: { q: 'foo' } })),
      `${baseUrl}/api/user?search=foo`
    );
  });

  test('filters array of objects expands each to filter[key]', () => {
    const api = helper();
    assert.equal(
      api.url('user', /** @type {any} */ ({ filters: [{ a: 1 }, { b: 2 }] })),
      `${baseUrl}/api/user?filter[a]=1&filter[b]=2`
    );
  });

  test('search field object expands to search[email]=x', () => {
    const api = helper();
    assert.equal(
      api.url('user', /** @type {any} */ ({ search: { email: 'x' } })),
      `${baseUrl}/api/user?search[email]=x`
    );
  });

  test('string sort is left as a scalar', () => {
    const api = helper();
    assert.equal(
      api.url('user', { sort: '-createdAt' }),
      `${baseUrl}/api/user?sort=-createdAt`
    );
  });

  test('string search (control) encodes as plain search=foo', () => {
    const api = helper();
    assert.equal(api.url('user', { search: 'foo' }), `${baseUrl}/api/user?search=foo`);
  });

  test('flat bracket keys (control) encode filter and sort correctly', () => {
    const api = helper();
    assert.equal(
      api.url('user', { 'filter[name]': 'a', 'sort[name]': '-1' }),
      `${baseUrl}/api/user?filter[name]=a&sort[name]=-1`
    );
  });
});

describe('authentication headers', () => {
  test('sends API keys in the X-API-Key header and never in URLs', async () => {
    const api = helper({ token: undefined });
    await api.get('user');
    assert.equal(mockServer.lastRequest().headers['x-api-key'], 'test-key');
    assert.equal(mockServer.lastRequest().url.includes('apikey'), false);
  });

  test('supports bearer-token authentication without an API-key header', async () => {
    const api = helper({ apikey: undefined, token: 'bearer-token' });
    await api.get('user');
    assert.equal(mockServer.lastRequest().headers.authorization, 'Bearer bearer-token');
    assert.equal(mockServer.lastRequest().headers['x-api-key'], undefined);
  });

  test('prefers bearer token over API key when both are configured', async () => {
    const api = helper({ token: 'bearer-token' });
    await api.get('user');
    assert.equal(mockServer.lastRequest().headers.authorization, 'Bearer bearer-token');
    assert.equal(mockServer.lastRequest().headers['x-api-key'], undefined);
  });
});

describe('login / MFA / refresh', () => {
  test('login hydrates user and stores access token', async () => {
    const api = new JXPHelper({ server: baseUrl, hideErrors: true });
    const result = await api.login('user@example.com', 'secret');
    assert.equal(isMfaRequired(result), false);
    assert.equal(result.data.token, 'access-token');
    assert.equal(result.user.email, 'user@example.com');
    assert.equal(api.token, 'access-token');
    const userFetch = mockServer.requests.find((r) => r.pathname === '/api/user/u1');
    assert.equal(userFetch.headers.authorization, 'Bearer access-token');
  });

  test('login returns mfa_required without hydrating', async () => {
    const api = new JXPHelper({ server: baseUrl, hideErrors: true });
    const step1 = await api.login('mfa@example.com', 'secret');
    assert.equal(isMfaRequired(step1), true);
    assert.equal(step1.challenge, 'challenge-jwt');
    assert.equal(api.token, undefined);
  });

  test('login rejects incomplete token responses', async () => {
    const api = new JXPHelper({ server: baseUrl, hideErrors: true });
    await assert.rejects(
      () => api.login('bad@example.com', 'secret'),
      /Login response missing token\/user_id/
    );
  });

  test('completeMfa trims codes, defaults method, and hydrates', async () => {
    const api = new JXPHelper({ server: baseUrl, hideErrors: true });
    const result = await api.completeMfa({
      challenge: 'challenge-jwt',
      code: ' 123 456 '
    });
    const mfaReq = mockServer.requests.find((r) => r.pathname === '/login/mfa');
    assert.deepEqual(mfaReq.body, {
      method: 'totp',
      challenge: 'challenge-jwt',
      code: '123456'
    });
    assert.equal(result.data.token, 'access-after-mfa');
    assert.equal(api.token, 'access-after-mfa');
  });

  test('completeMfa accepts custom method and rejects incomplete responses', async () => {
    const api = new JXPHelper({ server: baseUrl, hideErrors: true });
    await api.completeMfa({
      challenge: 'c',
      code: '111111',
      method: 'backup'
    });
    const mfaReq = mockServer.requests.find(
      (r) => r.pathname === '/login/mfa' && r.body?.code === '111111'
    );
    assert.equal(mfaReq.body.method, 'backup');

    await assert.rejects(
      () => api.completeMfa({ challenge: 'c', code: '000000' }),
      /MFA response missing token\/user_id/
    );
  });

  test('refresh uses refresh token as bearer and hydrates', async () => {
    const api = new JXPHelper({ server: baseUrl, hideErrors: true, apikey: 'ignored' });
    const result = await api.refresh('refresh-token');
    const refreshReq = mockServer.requests.find((r) => r.pathname === '/refresh');
    assert.equal(refreshReq.headers.authorization, 'Bearer refresh-token');
    assert.equal(refreshReq.headers['x-api-key'], undefined);
    assert.equal(result.data.token, 'access-refreshed');
    assert.equal(api.token, 'access-refreshed');
  });

  test('refresh rejects incomplete responses', async () => {
    const api = new JXPHelper({ server: baseUrl, hideErrors: true });
    await assert.rejects(
      () => api.refresh('bad-refresh'),
      /Refresh response missing token\/user_id/
    );
  });
});

describe('read helpers', () => {
  test('getOne returns a single document', async () => {
    const api = helper();
    const doc = await api.getOne('article', 'a1', { populate: 'author' });
    assert.deepEqual(doc, { _id: 'a1', title: 'Hello' });
    assert.match(mockServer.lastRequest().url, /populate=author/);
  });

  test('get returns list payloads', async () => {
    const api = helper();
    const result = await api.get('user', { limit: 5 });
    assert.deepEqual(result.data, [{ _id: '1' }]);
  });

  test('csv returns text bodies', async () => {
    const api = helper();
    const csv = await api.csv('user', { limit: 1 });
    assert.equal(csv, 'id,email\n1,a@b.c');
  });

  test('query and aggregate POST bodies', async () => {
    const api = helper();
    assert.deepEqual(await api.query('user', 'SELECT 1'), { rows: [{ q: 'SELECT 1' }] });
    assert.deepEqual(await api.aggregate('user', [{ $match: { a: 1 } }]), {
      pipeline: [{ $match: { a: 1 } }]
    });
  });

  test('count forces limit=1 and returns count', async () => {
    const api = helper();
    const count = await api.count('user');
    assert.equal(count, 42);
    assert.equal(mockServer.lastRequest().pathname, '/count/user');
    assert.equal(mockServer.lastRequest().searchParams.limit, '1');

    const filtered = await api.count('user', { 'filter[active]': true });
    assert.equal(filtered, 42);
    assert.equal(mockServer.lastRequest().searchParams['filter[active]'], 'true');
  });
});

describe('write helpers', () => {
  test('post and put send bodies to resource URLs', async () => {
    const api = helper();
    await api.post('user', { email: 'n@e.com' });
    assert.equal(mockServer.lastRequest().method, 'POST');
    assert.deepEqual(mockServer.lastRequest().body, { email: 'n@e.com' });

    await api.put('user', 'existing-id', { email: 'u@e.com' });
    assert.equal(mockServer.lastRequest().method, 'PUT');
    assert.equal(mockServer.lastRequest().pathname, '/api/user/existing-id');
  });

  test('postput updates when a match exists and inserts otherwise', async () => {
    const api = helper();
    await api.postput('user', 'email', { email: 'exists@example.com', name: 'Existing' });
    assert.equal(mockServer.lastRequest().method, 'PUT');
    assert.equal(mockServer.lastRequest().pathname, '/api/user/existing-id');

    await api.postput('user', 'email', { email: 'new@example.com', name: 'New' });
    assert.equal(mockServer.lastRequest().method, 'POST');
    assert.equal(mockServer.lastRequest().pathname, '/api/user');
  });

  test('bulk_postput delegates single objects to postput', async () => {
    const api = helper();
    await api.bulk_postput('user', 'email', { email: 'new@example.com' });
    assert.equal(mockServer.lastRequest().method, 'POST');
  });

  test('bulk_postput builds upsert updateOne ops for arrays', async () => {
    const api = helper();
    await api.bulk_postput('user', 'email', [
      { email: 'a@example.com', name: 'A' },
      { email: 'b@example.com', name: 'B' }
    ]);
    assert.equal(mockServer.lastRequest().pathname, '/bulkwrite/user');
    assert.deepEqual(mockServer.lastRequest().body, [
      {
        updateOne: {
          upsert: true,
          update: { email: 'a@example.com', name: 'A' },
          filter: { email: 'a@example.com' }
        }
      },
      {
        updateOne: {
          upsert: true,
          update: { email: 'b@example.com', name: 'B' },
          filter: { email: 'b@example.com' }
        }
      }
    ]);
  });

  test('bulk_postput supports composite keys', async () => {
    const api = helper();
    await api.bulk_postput('user', ['email', 'tenant'], [
      { email: 'a@example.com', tenant: 't1', name: 'A' }
    ]);
    assert.deepEqual(mockServer.lastRequest().body[0].updateOne.filter, {
      email: 'a@example.com',
      tenant: 't1'
    });
  });

  test('bulk_put builds non-upsert updates', async () => {
    const api = helper();
    await api.bulk_put('user', '_id', [{ _id: '1', name: 'X' }]);
    assert.deepEqual(mockServer.lastRequest().body, [
      {
        updateOne: {
          upsert: false,
          update: { _id: '1', name: 'X' },
          filter: { _id: '1' }
        }
      }
    ]);
  });

  test('bulk_post builds insertOne ops', async () => {
    const api = helper();
    await api.bulk_post('user', [{ email: 'a@example.com' }]);
    assert.deepEqual(mockServer.lastRequest().body, [
      { insertOne: { document: { email: 'a@example.com' } } }
    ]);
  });

  test('bulk forwards raw operations', async () => {
    const api = helper();
    const ops = [{ deleteMany: { filter: { stale: true } } }];
    await api.bulk('user', ops);
    assert.deepEqual(mockServer.lastRequest().body, ops);
  });

  test('put_all wraps $set updateMany', async () => {
    const api = helper();
    await api.put_all('user', { active: false });
    assert.deepEqual(mockServer.lastRequest().body, [
      {
        updateMany: {
          upsert: false,
          filter: {},
          update: { $set: { active: false } }
        }
      }
    ]);
  });
});

describe('delete helpers', () => {
  test('del variants set cascade and permaDelete flags', async () => {
    const api = helper();
    await api.del('user', '1');
    assert.equal(mockServer.lastRequest().pathname, '/api/user/1');
    assert.equal(mockServer.lastRequest().method, 'DELETE');

    mockServer.setHandler('DELETE /api/user/1', (req) => {
      return jsonOk({
        flags: {
          cascade: req.searchParams._cascade,
          permaDelete: req.searchParams._permaDelete
        }
      });
    });

    assert.deepEqual(await api.del_perm('user', '1'), {
      flags: { permaDelete: '1' }
    });
    assert.deepEqual(await api.del_cascade('user', '1'), {
      flags: { cascade: '1' }
    });
    assert.deepEqual(await api.del_perm_cascade('user', '1'), {
      flags: { cascade: '1', permaDelete: '1' }
    });
  });

  test('del_all deletes each filtered match', async () => {
    const api = helper();
    mockServer.setHandler('DELETE /api/user/1', () => jsonOk({ deleted: true }));

    const results = await api.del_all('user', 'parent_id', 'gone');
    assert.equal(results.length, 2);
    assert.equal(results[0].deleted, true);
  });
});

describe('sync', () => {
  test('inserts, updates, and deletes to match desired state', async () => {
    mockServer.setHandler('GET /api/user', (req) => {
      if (req.searchParams['filter[parent_id]'] === 'p1') {
        return jsonOk({
          data: [
            { _id: 'keep', parent_id: 'p1', name: 'old' },
            { _id: 'remove', parent_id: 'p1', name: 'gone' }
          ]
        });
      }
      return jsonOk({ data: [] });
    });

    const api = helper();
    const results = await api.sync('user', 'parent_id', 'p1', [
      { _id: 'keep', parent_id: 'p1', name: 'new' },
      { parent_id: 'p1', name: 'fresh' }
    ]);

    assert.equal(results.length, 3);
    const methods = mockServer.requests.map((r) => `${r.method} ${r.pathname}`);
    assert.ok(methods.includes('POST /api/user'));
    assert.ok(methods.includes('PUT /api/user/keep'));
    assert.ok(methods.includes('DELETE /api/user/remove'));
  });
});

describe('call, groups, jwt, models', () => {
  test('call posts to /call/:type/:cmd', async () => {
    const api = helper();
    const result = await api.call('user', 'ping', { n: 1 });
    assert.deepEqual(result, { pong: { n: 1 } });
  });

  test('groups_get / groups_put / groups_post / groups_del', async () => {
    const api = helper();
    const groups = await api.groups_get('u1');
    assert.deepEqual(groups, { groups: ['admin', 'editor'] });
    assert.equal(mockServer.lastRequest().method, 'GET');
    assert.equal(mockServer.lastRequest().pathname, '/groups/u1');
    assert.equal(mockServer.lastRequest().headers['x-api-key'], 'test-key');

    assert.deepEqual(await api.groups_get('empty'), { groups: [] });

    await api.groups_put('u1', ['admin', 'editor']);
    assert.deepEqual(mockServer.lastRequest().body, { group: ['admin', 'editor'] });

    await api.groups_post('u1', ['viewer']);
    assert.deepEqual(mockServer.lastRequest().body, { group: ['viewer'] });

    await api.groups_del('u1', 'admin+');
    assert.equal(mockServer.lastRequest().method, 'DELETE');
    assert.equal(mockServer.lastRequest().searchParams.group, 'admin+');
  });

  test('getjwt, model, and models', async () => {
    const api = helper();
    assert.deepEqual(await api.getjwt('a@b.c'), { jwt: 'jwt-for-a@b.c' });
    assert.deepEqual(await api.model('user'), { name: 'User', fields: {} });
    assert.deepEqual(await api.models(), [{ name: 'User' }, { name: 'Article' }]);
  });
});

describe('error handling', () => {
  test('propagates JXPError from read helpers', async () => {
    const api = helper();
    await assert.rejects(() => api.get('boom'), (error) => {
      assert.ok(error instanceof JXPError);
      assert.equal(error.status, 500);
      return true;
    });
    await assert.rejects(() => api.getOne('article', 'missing'));
    await assert.rejects(() => api.csv('fail'));
    await assert.rejects(() => api.query('fail', 'x'));
    await assert.rejects(() => api.aggregate('fail', {}));
    await assert.rejects(() => api.count('fail'));
  });

  test('propagates JXPError from write and delete helpers', async () => {
    const api = helper();
    await assert.rejects(() => api.post('fail', {}));
    await assert.rejects(() => api.put('fail', '1', {}));
    await assert.rejects(() => api.del('fail', '1'));
    await assert.rejects(() => api.del_perm('fail', '1'));
    await assert.rejects(() => api.del_cascade('fail', '1'));
    await assert.rejects(() => api.del_perm_cascade('fail', '1'));
    await assert.rejects(() => api.bulk('fail', []));
    await assert.rejects(() => api.bulk_post('fail', [{}]));
    await assert.rejects(() => api.bulk_put('fail', '_id', [{ _id: '1' }]));
    await assert.rejects(() => api.bulk_postput('fail', '_id', [{ _id: '1' }]));
    await assert.rejects(() => api.put_all('fail', { a: 1 }));
  });

  test('postput, del_all, and sync surface upstream failures', async () => {
    const api = helper();
    mockServer.setHandler('GET /api/boomlist', () => jsonError(500, { message: 'nope' }));
    await assert.rejects(() => api.postput('boomlist', 'email', { email: 'x' }));
    await assert.rejects(() => api.del_all('boomlist', 'email', 'x'));
    await assert.rejects(() => api.sync('boomlist', 'email', 'x', []));
  });

  test('call and groups_put rethrow without wrapping', async () => {
    const api = helper();
    await assert.rejects(() => api.call('fail', 'x', {}), (error) => {
      assert.ok(error instanceof JXPError);
      return true;
    });
    await assert.rejects(() => api.groups_get('fail'));
    await assert.rejects(() => api.groups_put('fail', ['a']));
    await assert.rejects(() => api.groups_post('fail', ['a']));
    await assert.rejects(() => api.groups_del('fail', 'a'));
  });

  test('getjwt/model/models reject with JXPError body', async () => {
    const api = helper();
    mockServer.setHandler('POST /login/getjwt', () => jsonError(401, { message: 'jwt denied' }));
    await assert.rejects(() => api.getjwt('x@y.z'), (body) => {
      assert.deepEqual(body, { message: 'jwt denied' });
      return true;
    });

    await assert.rejects(() => api.model('missing'), (body) => {
      assert.deepEqual(body, { message: 'no model' });
      return true;
    });

    mockServer.setHandler('GET /model', () => jsonError(500, { message: 'models down' }));
    await assert.rejects(() => api.models(), (body) => {
      assert.deepEqual(body, { message: 'models down' });
      return true;
    });
  });

  test('getjwt/model/models rethrow non-JXPError failures', async () => {
    const api = helper();
    const boom = new Error('transport failed');
    api['_request'] = async () => {
      throw boom;
    };
    await assert.rejects(() => api.getjwt('x@y.z'), (err) => err === boom);
    await assert.rejects(() => api.model('user'), (err) => err === boom);
    await assert.rejects(() => api.models(), (err) => err === boom);
  });

  test('hideErrors suppresses console.error for JXPError', async () => {
    const errors = [];
    const original = console.error;
    console.error = (...args) => errors.push(args);
    try {
      const api = helper({ hideErrors: true });
      await assert.rejects(() => api.get('boom'));
      assert.equal(errors.length, 0);

      const noisy = helper({ hideErrors: false });
      await assert.rejects(() => noisy.get('boom'));
      assert.ok(errors.length >= 1);
      assert.match(String(errors[0][0]), /url:/);
    } finally {
      console.error = original;
    }
  });

  test('debug timings and debug logs run on success and failure', async () => {
    const timeCalls = [];
    const timeEndCalls = [];
    const logs = [];
    const originalTime = console.time;
    const originalTimeEnd = console.timeEnd;
    const originalLog = console.log;
    console.time = (label) => timeCalls.push(label);
    console.timeEnd = (label) => timeEndCalls.push(label);
    console.log = (...args) => logs.push(args);
    try {
      const api = helper({ debug: true });
      await api.get('user');
      await api.post('user', { email: 'dbg@example.com' });
      await api.put('user', 'existing-id', { email: 'dbg@example.com' });
      await api.bulk('user', []);
      await api.put_all('user', { a: 1 });
      await api.call('user', 'ping', {});
      await api.groups_post('u1', ['x']);
      await api.sync('user', 'parent_id', 'p1', [{ _id: 'keep', parent_id: 'p1' }]);
      await assert.rejects(() => api.getOne('article', 'missing'));
      assert.ok(timeCalls.some((l) => l.startsWith('get.user-')));
      assert.ok(timeEndCalls.some((l) => l.startsWith('get.user-')));
      assert.ok(timeCalls.some((l) => l.startsWith('getOne.article-')));
      assert.ok(timeEndCalls.some((l) => l.startsWith('getOne.article-')));
      assert.ok(logs.some((args) => String(args[0]).includes('POSTing')));
      assert.ok(logs.some((args) => String(args[0]).includes('PUTting')));
      assert.ok(logs.some((args) => String(args[0]).includes('bulk')));
      assert.ok(logs.some((args) => String(args[0]).includes('put_all')));
      assert.ok(logs.some((args) => String(args[0]).includes('CALLing')));
      assert.ok(logs.some((args) => String(args[0]).includes('GROUP POSTing')));
    } finally {
      console.time = originalTime;
      console.timeEnd = originalTimeEnd;
      console.log = originalLog;
    }
  });

  test('_displayError falls back for non-JXPError values', async () => {
    const errors = [];
    const original = console.error;
    console.error = (...args) => errors.push(args);
    try {
      const api = helper({ hideErrors: false });
      api['_displayError'](new Error('network down'));
      assert.ok(errors.some((args) => args[0] instanceof Error));
    } finally {
      console.error = original;
    }
  });

  test('_displayError swallows console.error failures', () => {
    const original = console.error;
    let calls = 0;
    console.error = () => {
      calls += 1;
      if (calls === 1) throw new Error('console broken');
    };
    try {
      const api = helper({ hideErrors: false });
      assert.doesNotThrow(() => api['_displayError'](new Error('x')));
      assert.equal(calls, 2);
    } finally {
      console.error = original;
    }
  });

  test('debug timings cover read failure paths', async () => {
    const timeEndCalls = [];
    const originalTime = console.time;
    const originalTimeEnd = console.timeEnd;
    console.time = () => {};
    console.timeEnd = (label) => timeEndCalls.push(label);
    try {
      const api = helper({ debug: true });
      await assert.rejects(() => api.get('boom'));
      await assert.rejects(() => api.csv('fail'));
      await assert.rejects(() => api.query('fail', 'x'));
      await assert.rejects(() => api.aggregate('fail', {}));
      await assert.rejects(() => api.count('fail'));
      assert.ok(timeEndCalls.some((l) => l.startsWith('get.boom-')));
      assert.ok(timeEndCalls.some((l) => l.startsWith('get.fail-')));
      assert.ok(timeEndCalls.some((l) => l.startsWith('query.fail-')));
      assert.ok(timeEndCalls.some((l) => l.startsWith('aggregate.fail-')));
      assert.ok(timeEndCalls.some((l) => l.startsWith('count.fail-')));
    } finally {
      console.time = originalTime;
      console.timeEnd = originalTimeEnd;
    }
  });
});
