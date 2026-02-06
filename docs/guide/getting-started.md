# Getting Started

Welcome to Futurable! This guide will help you get up and running quickly.

## What is Futurable?

Futurable is a powerful TypeScript library that extends JavaScript's native `Promise` and `Fetch` APIs with advanced features like cancellation, delays, polling, and more. It's designed to work seamlessly in both browser and Node.js environments.

## Installation

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

:::

## Basic Usage

### Importing

Futurable supports both ESM and CommonJS:

```typescript
// ESM
import { Futurable } from '@ndriadev/futurable';

// CommonJS
const { Futurable } = require('@ndriadev/futurable');
```

### Your First Futurable

Let's create a simple cancellable promise:

```typescript
import { Futurable } from '@ndriadev/futurable';

const futurable = new Futurable((resolve, reject, { signal }) => {
  const timeoutId = setTimeout(() => {
    resolve('Operation completed!');
  }, 2000);

  // Clean up when cancelled
  signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
    reject(new Error('Operation cancelled'));
  });
});

// Use it like a regular promise
futurable
  .then(result => console.log(result))
  .catch(error => console.error(error));

// Cancel it after 1 second
setTimeout(() => futurable.cancel(), 1000);
```

### Cancellable Fetch

One of the most common use cases is making cancellable HTTP requests:

```typescript
import { Futurable } from '@ndriadev/futurable';

const request = Futurable.fetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => {
    console.log('Data received:', data);
    return data;
  })
  .catch(error => {
    if (error.name === 'AbortError') {
      console.log('Request was cancelled');
    } else {
      console.error('Request failed:', error);
    }
  });

// Cancel the request after 5 seconds
setTimeout(() => request.cancel(), 5000);
```

## Key Concepts

### Promise Compatibility

Futurable is fully compatible with JavaScript's native Promise API. You can:

- Use `.then()`, `.catch()`, and `.finally()` just like regular promises
- Use `async/await` syntax
- Mix Futurable with regular Promises
- Use all static methods like `Promise.all()`, `Promise.race()`, etc.

```typescript
// All of these work!
const result1 = await futurable;
const result2 = await futurable.then(x => x * 2);
const results = await Futurable.all([futurable1, futurable2, regularPromise]);
```

### Cancellation

Every Futurable instance has a `cancel()` method that allows you to abort the operation:

```typescript
const futurable = new Futurable((resolve, reject, { signal }) => {
  // Your async operation
});

// Cancel it
futurable.cancel();
```

When cancelled, the futurable's internal `AbortSignal` is triggered, allowing you to clean up resources.

### AbortSignal Integration

Futurable uses the standard `AbortSignal` API, making it compatible with any API that supports cancellation:

```typescript
const futurable = new Futurable((resolve, reject, { signal }) => {
  fetch('https://api.example.com/data', { signal })
    .then(response => response.json())
    .then(resolve)
    .catch(reject);
});

futurable.cancel(); // Automatically cancels the fetch
```

## Next Steps

Now that you understand the basics, explore these topics:

- [Why Futurable?](/guide/why-futurable) - Learn about the problems Futurable solves
- [Cancellation](/guide/cancellation) - Deep dive into cancellation patterns
- [Delays & Sleep](/guide/delays-and-sleep) - Working with timing utilities
- [Fetch Integration](/guide/fetch-integration) - Advanced fetch patterns
- [API Reference](/api/constructor) - Complete API documentation
- [Examples](/examples/) - Real-world usage examples

## TypeScript Support

Futurable is written in TypeScript and provides full type definitions out of the box:

```typescript
import { Futurable, FuturableExecutor } from '@ndriadev/futurable';

// Type-safe executor
const executor: FuturableExecutor<string> = (resolve, reject, { signal }) => {
  resolve('typed value');
};

const futurable = new Futurable(executor);

// TypeScript knows this is a string
const result: string = await futurable;
```

## Need Help?

- 📚 Check the [API documentation](/api/constructor)
- 💬 Open an issue on [GitHub](https://github.com/nDriaDev/futurable/issues)
- 📧 Contact the author at [andreacosentino.work@gmail.com](mailto:andreacosentino.work@gmail.com)
