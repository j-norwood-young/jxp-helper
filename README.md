# JXP Helper

Helpers for reading, writing, and calling a [JXP](https://github.com/WorkSpaceMan/jxp) API server.

Targets **JXP 6** (bearer tokens + X-API-Key, MFA / TOTP login). Requires **Node.js 22+**.

## Installation

```bash
npm install --save jxp-helper
```

## Authentication

JXP supports two client credentials:

| Option | Header | Use |
| --- | --- | --- |
| `apikey` | `X-API-Key` | Long-lived machine / system keys |
| `token` | `Authorization: Bearer …` | Ephemeral access tokens from `/login` or `/login/mfa` |

Provide at least one for `/api/*` calls. Auth endpoints (`login`, `completeMfa`, `refresh`) work with neither.

When both are set, the **bearer token wins**.

```typescript
import { JXPHelper, isMfaRequired } from 'jxp-helper';

// System / machine client
const system = new JXPHelper({
  server: 'http://localhost:4001',
  apikey: process.env.JXP_API_KEY!
});

// User session client (after login)
const user = new JXPHelper({
  server: 'http://localhost:4001',
  token: accessToken
});
```

### Login + MFA (TOTP)

```typescript
const api = new JXPHelper({ server: 'http://localhost:4001' });

const step1 = await api.login(email, password);
if (isMfaRequired(step1)) {
  const step2 = await api.completeMfa({
    challenge: step1.challenge,
    code: authenticatorCode // or backup code
  });
  // step2.data.token / step2.user — api.token is also set
} else {
  // step1.data.token / step1.user
}
```

### Refresh

```typescript
const renewed = await api.refresh(refreshToken);
```

## Configuration Options

```typescript
interface JXPHelperOptions {
  server: string;   // Required
  apikey?: string;  // X-API-Key
  token?: string;   // Authorization: Bearer
  debug?: boolean;
  hideErrors?: boolean;
}
```

## TypeScript

```typescript
import { JXPHelper } from 'jxp-helper';

const api = new JXPHelper({
  server: 'http://localhost:4001',
  apikey: process.env.JXP_API_KEY!
});

const user = await api.getOne<User>('user', userId);
const articles = await api.get<Article>('article', { limit: 10 });
```

## Tests

```bash
npm test
npm run test:coverage
```

Uses Node's built-in test runner against a local mock HTTP server (no live JXP required).

## Migration from v2

See [MIGRATION.md](MIGRATION.md).

## License

MIT
