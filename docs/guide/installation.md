# Installation

Get started with Futurable in your project.

## Package Managers

Install Futurable using your preferred package manager:

::: code-group

```bash [npm]
npm install @ndriadev/futurable
```

```bash [yarn]
yarn add @ndriadev/futurable
```

```bash [pnpm]
pnpm add @ndriadev/futurable
```

```bash [bun]
bun add @ndriadev/futurable
```

:::

## Requirements

- **Node.js**: 14.0.0 or higher
- **TypeScript**: 4.5 or higher (optional, but recommended)

## Module Systems

Futurable supports both ESM and CommonJS:

### ESM (Recommended)

```typescript
import { Futurable } from '@ndriadev/futurable';
```

### CommonJS

```javascript
const { Futurable } = require('@ndriadev/futurable');
```

## CDN Usage

For quick prototyping or browser-only projects, you can use Futurable via CDN:

### ESM CDN

```html
<script type="module">
  import { Futurable } from 'https://esm.sh/@ndriadev/futurable';

  const request = Futurable.fetch('https://api.example.com/data');
</script>
```

### UMD (unpkg)

```html
<script src="https://unpkg.com/@ndriadev/futurable"></script>
<script>
  const { Futurable } = window.Futurable;

  const request = Futurable.fetch('https://api.example.com/data');
</script>
```

## Browser Support

Futurable works in all modern browsers that support:

- ✅ **ES2015 (ES6)** features
- ✅ **Promise** API
- ✅ **AbortController** and **AbortSignal**

### Supported Browsers

| Browser | Minimum Version |
|---------|----------------|
| Chrome  | 66+ |
| Firefox | 57+ |
| Safari  | 12.1+ |
| Edge    | 79+ |

### Polyfills

If you need to support older browsers, you may need polyfills for:

- `Promise` (for very old browsers)
- `AbortController` / `AbortSignal`
- `fetch` API

Example with polyfills:

```html
<!-- Promise polyfill -->
<script src="https://cdn.jsdelivr.net/npm/promise-polyfill@8/dist/polyfill.min.js"></script>

<!-- AbortController polyfill -->
<script src="https://cdn.jsdelivr.net/npm/abortcontroller-polyfill@1/dist/abortcontroller-polyfill-only.min.js"></script>

<!-- Fetch polyfill -->
<script src="https://cdn.jsdelivr.net/npm/whatwg-fetch@3/dist/fetch.umd.js"></script>

<!-- Your code -->
<script src="your-app.js"></script>
```

## Node.js Support

### Native Fetch API

Node.js includes native `fetch` support starting from version 17.5.0. For earlier versions, you'll need to install `node-fetch`:

```bash
npm install node-fetch
```

Then import it globally:

```javascript
import fetch from 'node-fetch';
global.fetch = fetch;

// Now Futurable.fetch will work
import { Futurable } from '@ndriadev/futurable';
```

### Recommended Node.js Versions

| Version | Support | Notes |
|---------|---------|-------|
| 20.x | ✅ Recommended | LTS, native fetch |
| 18.x | ✅ Supported | LTS, native fetch |
| 16.x | ⚠️ Limited | EOL, requires node-fetch |
| 14.x | ⚠️ Limited | EOL, requires node-fetch |

## TypeScript Configuration

If you're using TypeScript, ensure your `tsconfig.json` includes:

```json
{
  "compilerOptions": {
    "target": "ES2015",
    "module": "ESNext",
    "lib": ["ES2015", "DOM"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Verification

Verify your installation works:

```typescript
import { Futurable } from '@ndriadev/futurable';

// Create a simple futurable
const test = new Futurable((resolve) => {
  setTimeout(() => resolve('Installation successful! 🎉'), 1000);
});

test.then(message => console.log(message));
```

If you see "Installation successful! 🎉" after 1 second, you're all set!

## Next Steps

- [Getting Started](/guide/getting-started) - Learn the basics
- [API Reference](/api/constructor) - Explore the full API
- [Examples](/examples/) - See real-world usage

## Troubleshooting

### Module not found

If you get "Cannot find module '@ndriadev/futurable'":

1. Ensure the package is installed: `npm list @ndriadev/futurable`
2. Clear your node_modules and reinstall: `rm -rf node_modules && npm install`
3. Check your import statement syntax

### TypeScript errors

If you get TypeScript errors:

1. Ensure TypeScript version is 4.5+: `npm list typescript`
2. Add `"skipLibCheck": true` to your `tsconfig.json`
3. Check that `"moduleResolution": "node"` is set

### Fetch is not defined (Node.js)

If you get "fetch is not defined" in Node.js:

1. Upgrade to Node.js 18+ for native fetch support
2. Or install and import `node-fetch` as shown above

### AbortController is not defined

This is rare in modern environments, but if it happens:

1. Install the polyfill: `npm install abortcontroller-polyfill`
2. Import it before using Futurable:
   ```javascript
   import 'abortcontroller-polyfill/dist/polyfill-patch-fetch';
   ```

## Getting Help

If you encounter issues:

- 📖 Check the [documentation](https://futurable.ndria.dev)
- 🐛 [Report a bug](https://github.com/nDriaDev/futurable/issues/new)
- 💬 [Start a discussion](https://github.com/nDriaDev/futurable/discussions)
- 📧 Email: [info@ndria.dev](mailto:info@ndria.dev)
