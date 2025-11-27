# Migration Guide: v1.x to v2.0

## Overview

JXP Helper v2.0 introduces full TypeScript support while maintaining backward compatibility with JavaScript projects. This guide will help you migrate from v1.x to v2.0.

## Breaking Changes

### 1. Main Entry Point
- **v1.x**: `jxp-helper.js`
- **v2.0**: `dist/index.js` (built from TypeScript)

The package.json automatically handles this change, so no code changes are required.

### 2. Constructor Requirements
Both `server` and `apikey` are now required parameters:

```javascript
// v1.x - apikey was optional in some cases
const helper = new JXPHelper({ server: "http://localhost:2001" });

// v2.0 - both server and apikey are required
const helper = new JXPHelper({ 
  server: "http://localhost:2001", 
  apikey: "your-api-key" 
});
```

### 3. Error Handling
Error handling is now more consistent and type-safe:

```javascript
// v1.x - inconsistent error formats
try {
  const result = await helper.get('users');
} catch (err) {
  // err could be various formats
}

// v2.0 - consistent error handling
try {
  const result = await helper.get('users');
} catch (err) {
  // err.response.data contains the error details
}
```

## New Features

### 1. TypeScript Support
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

## Migration Steps

### For JavaScript Projects

1. **Update your package.json**:
   ```json
   {
     "dependencies": {
       "jxp-helper": "^2.0.0"
     }
   }
   ```

2. **Update constructor calls** to include apikey:
   ```javascript
   const helper = new JXPHelper({ 
     server: "http://localhost:2001", 
     apikey: process.env.JXP_API_KEY 
   });
   ```

3. **Test your application** - most existing code should work without changes.

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

- **Node.js**: Requires Node.js 14.0.0 or higher
- **JavaScript**: Fully backward compatible (with constructor changes)
- **TypeScript**: Full support with type definitions
- **ES Modules**: Supported
- **CommonJS**: Supported

## Development Changes

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
