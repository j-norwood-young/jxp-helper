# Migration Guide: jxp-helper v2 to v3

## Overview

JXP Helper v3 removes axios and sends API keys in the `X-API-Key` header. It targets Node.js 22 or later and is intended for JXP 6.

## Breaking Changes

### 1. API key transport
The constructor remains the same:

```javascript
const helper = new JXPHelper({ 
  server: "http://localhost:2001", 
  apikey: "your-api-key" 
});
```

Every request now sends `X-API-Key: your-api-key` and never appends `?apikey=` to a URL.

### 2. Error handling

Errors are now typed:

```javascript
try {
  const result = await helper.get('users');
} catch (err) {
  // err is a JXPError with status, body, url, and method
}
```

## New Features

### 1. Native fetch
Full TypeScript definitions are now included:

```typescript
import JXPHelper from 'jxp-helper';

const helper = new JXPHelper({
  server: "http://localhost:2001",
  apikey: "your-api-key",
  debug: true
});

// Type-safe API calls
const users = await helper.get<User>('users');
const user = await helper.getOne<User>('users', userId);
```

### 2. Better Type Safety
All methods now have proper type annotations:

```typescript
// Generic type support
interface Article {
  _id: string;
  title: string;
  content: string;
}

const articles = await helper.get<Article>('articles', { limit: 10 });
// articles.data is now typed as Article[]
```

### 3. Enhanced IntelliSense
IDEs now provide better autocomplete and error detection.

## Migration steps

### For JavaScript Projects

1. **Update your package.json**:
   ```json
   {
     "dependencies": {
      "jxp-helper": "^3.0.0"
     }
   }
   ```

2. **Update constructor calls** to include the API key:
   ```javascript
   const helper = new JXPHelper({ 
     server: "http://localhost:2001", 
     apikey: process.env.JXP_API_KEY 
   });
   ```

3. **Remove any code that reads `err.response.data`** and use `err.body`.

### For TypeScript Projects

1. **Update your package.json** (same as above)

2. **Update imports**:
   ```typescript
   import JXPHelper from 'jxp-helper';
   // or
   import { JXPHelper } from 'jxp-helper';
   ```

3. **Add type annotations** where beneficial:
   ```typescript
   const users = await helper.get<User>('users');
   ```

4. **Update constructor** to include apikey (same as JavaScript)

## Compatibility

- **Node.js**: Requires Node.js 22.0.0 or higher
- **JavaScript**: CommonJS and ESM are supported
- **TypeScript**: Full support with type definitions
- **ES Modules**: Supported
- **CommonJS**: Supported

## Development changes

If you're contributing to the project:

1. **Source files** are now in `src/` directory
2. **Build process**: Run `npm run build` to compile TypeScript
3. **Development**: Use `npm run dev` for watch mode
4. **Distribution**: Only `dist/` files are published to npm

## Need Help?

If you encounter issues during migration:

1. Check that both `server` and `apikey` are provided in the constructor
2. Ensure you're using Node.js 14.0.0 or higher
3. For TypeScript projects, make sure your tsconfig.json includes proper module resolution
4. Open an issue on GitHub if you need assistance
