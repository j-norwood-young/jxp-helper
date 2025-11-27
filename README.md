# JXP Helper

A bunch of helpers to make it easier to read, write, delete and do other cool stuff with the [JXP API server](https://github.com/j-norwood-young/jexpress-2)

**Now with full TypeScript support!** 🎉

## Installation

```bash
npm install --save jxp-helper
```

## Usage

### TypeScript

```typescript
import JXPHelper from 'jxp-helper';
// or
import { JXPHelper } from 'jxp-helper';

const apihelper = new JXPHelper({ 
  server: "http://localhost:2001", 
  apikey: "your-api-key" 
});
```

### JavaScript (CommonJS)

```javascript
const JXPHelper = require("jxp-helper");
const apihelper = new JXPHelper({ 
  server: "http://localhost:2001", 
  apikey: "your-api-key" 
});
```

### JavaScript (ES Modules)

```javascript
import JXPHelper from 'jxp-helper';
const apihelper = new JXPHelper({ 
  server: "http://localhost:2001", 
  apikey: "your-api-key" 
});
```

## Configuration Options

```typescript
interface JXPHelperOptions {
  server: string;        // Required: The JXP server URL
  apikey: string;        // Required: Your API key
  debug?: boolean;       // Optional: Enable debug logging (default: false)
  hideErrors?: boolean;  // Optional: Hide error messages (default: false)
}
```

## Config

### Config file

Use [config](https://www.npmjs.com/package/config) and create `config/default.json` with your `jxp_server`.

Eg. of `default.json`

```json
{
    "jxp_server": "http://localhost:2001"
}
```

### Pass in config

When initialising the helper, just pass in `server` and `apikey`.

```typescript
const apihelper = new JXPHelper({ 
  server: "http://localhost:2001", 
  apikey: "your-api-key" 
});
```

## TypeScript Support

This package includes full TypeScript definitions and provides excellent IntelliSense support. All methods are properly typed with generics where appropriate:

```typescript
// Typed responses
const user = await apihelper.getOne<User>('users', userId);
const articles = await apihelper.get<Article>('articles', { limit: 10 });

// Type-safe bulk operations
await apihelper.bulk_post('users', userData);
```