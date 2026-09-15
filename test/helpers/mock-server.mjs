import http from 'node:http';

/**
 * Minimal HTTP mock for jxp-helper tests.
 * Handlers are keyed as `${method} ${pathname}` or `*` for a catch-all.
 * Pathname matching ignores query strings.
 */
export function createMockServer(handlers = {}) {
  const requests = [];

  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
      }

      const url = new URL(req.url, 'http://127.0.0.1');
      const record = {
        url: req.url,
        pathname: url.pathname,
        searchParams: Object.fromEntries(url.searchParams),
        headers: req.headers,
        method: req.method,
        body: parsed,
        rawBody: raw
      };
      requests.push(record);

      const key = `${req.method} ${url.pathname}`;
      const handler = handlers[key] ?? handlers['*'];

      if (!handler) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ message: `No handler for ${key}` }));
        return;
      }

      Promise.resolve(handler(record, res))
        .then((result) => {
          if (result === undefined || res.writableEnded) return;
          const status = result.status ?? 200;
          const headers = result.headers ?? { 'Content-Type': 'application/json' };
          res.statusCode = status;
          for (const [k, v] of Object.entries(headers)) {
            res.setHeader(k, v);
          }
          if (result.raw != null) {
            res.end(result.raw);
          } else if (result.json !== undefined) {
            res.end(JSON.stringify(result.json));
          } else {
            res.end('');
          }
        })
        .catch((err) => {
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: String(err) }));
          }
        });
    });
  });

  return {
    server,
    requests,
    async listen() {
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address();
      return `http://127.0.0.1:${port}`;
    },
    async close() {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    },
    lastRequest() {
      return requests.at(-1);
    },
    clearRequests() {
      requests.length = 0;
    },
    setHandler(key, handler) {
      handlers[key] = handler;
    }
  };
}

export function jsonOk(json, status = 200) {
  return { status, json, headers: { 'Content-Type': 'application/json' } };
}

export function textOk(raw, status = 200, contentType = 'text/csv') {
  return { status, raw, headers: { 'Content-Type': contentType } };
}

export function jsonError(status, json) {
  return { status, json, headers: { 'Content-Type': 'application/json' } };
}
