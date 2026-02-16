<div align="center">
  <br>
  <a href="https://futurable.ndria.dev/">
    <img src="https://futurable.ndria.dev/Futurable.png" alt="Futurable Logo" width="200">
  </a>
  <br>
  <h1>Futurable</h1>
  <p><strong>JavaScript's Promise and Fetch APIs with superpowers! 🚀</strong></p>

  [![npm version](https://img.shields.io/npm/v/%40ndriadev/futurable?color=orange&style=for-the-badge)](https://www.npmjs.org/package/%40ndriadev/futurable)
  ![npm bundle size](https://img.shields.io/bundlephobia/min/@ndriadev/futurable?color=yellow&label=SIZE&style=for-the-badge)
  ![npm downloads](https://img.shields.io/npm/dt/%40ndriadev/futurable?label=DOWNLOADS&color=red&style=for-the-badge)
  ![license](https://img.shields.io/npm/l/@ndriadev/futurable?color=blue&style=for-the-badge)

  ![coverage statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg?style=for-the-badge)
  ![coverage branches](https://img.shields.io/badge/branches-96.24%25-brightgreen.svg?style=for-the-badge)
  ![coverage functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=for-the-badge)
  ![coverage lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg?style=for-the-badge)

</div>

---
## 📋 Table of Contents

 - [Documentation](https://futurable.ndria.dev/)
 - [About](#-about)
 - [Quick Start](#-quick-start)
 - [Features](#-key-features)
 - [Examples](#-examples)

---

## 📖 About

**Futurable** is a powerful TypeScript library that extends JavaScript's native `Promise` and `Fetch` APIs with advanced features like **cancellation**, **delays**, **polling**, and more. Built for both browser and Node.js environments, it provides an intuitive API to handle async operations with greater control.

### Why Futurable?

JavaScript's Promise API is powerful but lacks some crucial features for modern applications:

- ❌ No way to cancel pending promises
- ❌ No built-in delay or sleep functionality
- ❌ Fetch API doesn't support request cancellation easily
- ❌ No polling mechanism out of the box
- ❌ Complex AbortController boilerplate

**Futurable solves all of these problems** with a clean, Promise-compatible API that feels natural to use.

---

## ✨ Key Features

- ✅ **Full Promise Compatibility** - Works as a drop-in replacement for native Promises
- ✅ **Cancellable Operations** - Cancel any async operation with ease
- ✅ **Fetch Integration** - Built-in cancellable fetch with AbortController support
- ✅ **Delays & Sleep** - Add delays without complex setTimeout logic
- ✅ **Polling Support** - Built-in polling mechanism with cancellation
- ✅ **TypeScript First** - Full type safety with excellent IDE support
- ✅ **Tree-shakeable** - Import only what you need
- ✅ **Zero Dependencies** - Lightweight and fast
- ✅ **Universal** - Works in Node.js and all modern browsers
- ✅ **100% Test Coverage** - Battle-tested and reliable

---

## 🚀 Quick Start

### Installation

```bash
# npm
npm install @ndriadev/futurable

# yarn
yarn add @ndriadev/futurable

# pnpm
pnpm add @ndriadev/futurable
```

### Basic Usage

```typescript
import { Futurable } from '@ndriadev/futurable';

// Create a cancellable promise
const futurable = new Futurable((resolve, reject, { cancel, signal }) => {
  const timeoutId = setTimeout(() => resolve('Done!'), 2000);

  // Clean up when cancelled
  signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
  });
});

// Cancel it before it completes
setTimeout(() => futurable.cancel(), 1000);
```

---

## 💡 Examples

### Cancellable Fetch Request

```typescript
import { Futurable } from '@ndriadev/futurable';

// Make a cancellable API request
const request = Futurable.fetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Request failed:', error));

// Cancel after 5 seconds if not completed
setTimeout(() => request.cancel(), 5000);
```

### React Hook with Auto-Cleanup

```typescript
import { useEffect, useState } from 'react';
import { Futurable } from '@ndriadev/futurable';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const request = Futurable
      .fetch(`https://api.example.com/users/${userId}`)
      .then(res => res.json())
      .then(setUser);

    // Automatically cancel on component unmount
    return () => request.cancel();
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

### Sleep & Delay

```typescript
import { Futurable } from '@ndriadev/futurable';

// Simple sleep
await Futurable.sleep(1000); // Wait 1 second
console.log('Slept for 1 second');

// Delay with callback
const result = await new Futurable((resolve) => {
  resolve('initial value');
}).delay(() => 'delayed value', 2000);

console.log(result); // 'delayed value' after 2 seconds
```

### Polling

```typescript
import { Futurable } from '@ndriadev/futurable';

// Poll an API endpoint every 5 seconds
const polling = Futurable.polling(
  () => Futurable.fetch('https://api.example.com/status')
    .then(res => res.json()),
  5000 // interval in ms
);

polling
  .then(data => console.log('Status:', data))
  .catch(error => console.error('Polling error:', error));

// Stop polling after 30 seconds
setTimeout(() => polling.cancel(), 30000);
```

### Convert Existing Promises

```typescript
import { Futurable } from '@ndriadev/futurable';

// Convert any promise to a Futurable
const regularPromise = fetch('https://api.example.com/data');
const futurable = Futurable.futurizable(regularPromise);

// Now it's cancellable!
futurable.cancel();
```

### Static Methods (All Promise Methods Supported)

```typescript
import { Futurable } from '@ndriadev/futurable';

// All static Promise methods work with cancellation support
const results = await Futurable.all([
  Futurable.fetch('/api/users'),
  Futurable.fetch('/api/posts'),
  Futurable.fetch('/api/comments')
]);

// Cancel all requests at once
results.cancel();
```

---

## 🎯 FuturableTask: Lazy Computation for Advanced Workflows

While `Futurable` extends Promise for eager execution, **`FuturableTask`** provides lazy computation with powerful functional composition capabilities. Think of it as a blueprint for async operations that only execute when you explicitly run them.

### Why FuturableTask?

- ⏱️ **Lazy Execution** - Define operations without executing them
- 🔄 **Reusable** - Run the same task multiple times independently
- 🧩 **Composable** - Chain transformations before execution
- 🎛️ **Concurrency Control** - Built-in rate limiting and debouncing
- 💾 **Memoization** - Cache results for expensive operations
- 🔁 **Advanced Patterns** - Retry, timeout, fallback, and more

### Quick Example

```typescript
import { FuturableTask } from '@ndriadev/futurable';

// Define a task (not executed yet!)
const fetchUser = FuturableTask
  .of(() => fetch('/api/user'))
  .map(res => res.json())
  .retry(3)              // Retry on failure
  .timeout(5000)         // 5 second timeout
  .memoize();            // Cache the result

// Execute when needed
const user = await fetchUser.run();

// Execute again - uses cached result
const sameUser = await fetchUser.run();
```

### Key Features

#### Lazy Evaluation
```typescript
// Creating a task doesn't execute it
const task = FuturableTask.of(() => {
  console.log('Executing!');
  return expensiveOperation();
});
// Nothing logged yet

// Execute when ready
const result = await task.run(); // Now it executes
```

#### Functional Composition
```typescript
const pipeline = FuturableTask
  .of(() => fetch('/api/data'))
  .map(res => res.json())
  .filter(data => data.active)
  .map(data => processData(data))
  .retry(3)
  .timeout(10000);

// All transformations applied during execution
const result = await pipeline.run();
```

#### Concurrency Control
```typescript
// Limit concurrent executions
const limiter = FuturableTask.createLimiter(2, {
  onActive: (task) => console.log('Task started'),
  onCompleted: (result) => console.log('Task done:', result)
});

const tasks = urls.map(url =>
  limiter(FuturableTask.fetch(url))
);

// Only 2 tasks run concurrently
await FuturableTask.parallel(tasks).run();
```

#### Advanced Error Handling
```typescript
const task = FuturableTask
  .of(() => riskyOperation())
  .retry(3, { delay: 1000 })        // Retry with backoff
  .timeout(5000)                     // Timeout protection
  .orElse(() => FuturableTask.resolve(fallbackValue))  // Fallback
  .fallbackTo(error => {                // Error fallbackToy
    console.error('Failed:', error);
    return defaultValue;
  });

const result = await task.run();
```

#### Debouncing & Throttling
```typescript
// Debounce expensive operations
const searchTask = FuturableTask
  .of((query) => searchAPI(query))
  .debounce(300);  // Wait 300ms after last call

// Multiple rapid calls
searchTask.run('a');
searchTask.run('ab');
searchTask.run('abc');  // Only this executes
```

#### Sequential & Parallel Execution
```typescript
// Execute tasks in sequence
const sequential = FuturableTask.sequence([
  FuturableTask.fetch('/api/step1'),
  FuturableTask.fetch('/api/step2'),
  FuturableTask.fetch('/api/step3')
]);

// Execute tasks in parallel
const parallel = FuturableTask.parallel([
  FuturableTask.fetch('/api/users'),
  FuturableTask.fetch('/api/posts'),
  FuturableTask.fetch('/api/comments')
]);

const results = await parallel.run();
```

### Common Patterns

#### Retry with Exponential Backoff
```typescript
const resilientTask = FuturableTask
  .of(() => unreliableAPI())
  .retry(5, {
    delay: 1000,
    backoff: 2  // 1s, 2s, 4s, 8s, 16s
  });
```

#### Polling Until Condition
```typescript
const pollUntilReady = FuturableTask
  .until(
    async () => await checkStatus() === 'ready',
    FuturableTask.of(() => fetch('/api/status')).delay(1000)
  );

await pollUntilReady.run();
```

#### Batch Processing with Limits
```typescript
const limiter = FuturableTask.createLimiter(5);

const processAllFiles = FuturableTask.traverse(
  filePaths,
  path => limiter(FuturableTask.of(() => processFile(path)))
);

await processAllFiles.run();
```

#### Race with Timeout
```typescript
const quickestResult = FuturableTask.race([
  FuturableTask.fetch('/api/fast'),
  FuturableTask.fetch('/api/slow'),
  FuturableTask.sleep(3000).map(() => 'timeout')
]);

const result = await quickestResult.run();
```

### API Methods

| Method | Description |
|--------|-------------|
| `of()` | Create a task from a function |
| `run()` | Execute the task |
| `map()` | Transform the result |
| `flatMap()` | Transform and flatten |
| `filter()` | Conditionally succeed |
| `retry()` | Retry on failure |
| `timeout()` | Add timeout protection |
| `delay()` | Delay execution |
| `debounce()` | Debounce execution |
| `memoize()` | Cache results |
| `orElse()` | Fallback task |
| `tap()` | Side effects |
| `finally()` | Cleanup logic |

### Static Combinators

| Method | Description |
|--------|-------------|
| `sequence()` | Execute tasks sequentially |
| `parallel()` | Execute tasks in parallel |
| `race()` | First task to complete |
| `all()` | All tasks must succeed |
| `allSettled()` | Wait for all to finish |
| `traverse()` | Map and execute sequentially |
| `whilst()` | Loop while condition |
| `until()` | Loop until condition |
| `times()` | Repeat n times |

---

## 📚 API Reference

For complete API documentation, visit [futurable.ndria.dev](https://futurable.ndria.dev/)

### Core Methods

| Method | Description |
|--------|-------------|
| `cancel()` | Cancels the futurable operation |
| `onCancel(callback)` | Executes callback when cancelled |
| `sleep(ms)` | Waits for specified milliseconds |
| `delay(callback, ms)` | Delays execution of callback |
| `fetch(url, options)` | Cancellable fetch request |
| `futurizable(promise)` | Converts Promise to Futurable |

### Static Methods

All native Promise static methods are supported:
- `Futurable.all()`
- `Futurable.allSettled()`
- `Futurable.any()`
- `Futurable.race()`
- `Futurable.resolve()`
- `Futurable.reject()`
- `Futurable.withResolvers()`

Plus additional methods:
- `Futurable.polling()` - Polling with interval support
- `Futurable.sleep()` - Static sleep utility
- `Futurable.delay()` - Static delay utility
- `Futurable.fetch()` - Static fetch utility
- `Futurable.futurizable()` - Convert Promise to Futurable

---

## 🎯 Use Cases

### Perfect For

- **SPA Applications** - Cancel API calls when navigating away
- **React/Vue/Angular** - Clean up effects and prevent memory leaks
- **Real-time Updates** - Implement polling with easy cancellation
- **Long-running Operations** - Timeout or cancel expensive operations
- **Resource Management** - Proper cleanup of async resources
- **Testing** - Better control over async test scenarios

---

## 🌐 Browser & Node.js Support

- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Node.js 14+ (Native Fetch API support in Node.js 17.5+)
- ✅ TypeScript 4.5+

> **Note for Node.js < 17.5:** Install `node-fetch` for fetch functionality

---

## 📄 License

[MIT](LICENSE) © [nDriaDev](https://github.com/nDriaDev)

---

## 📞 Support

- **Issues:** [GitHub Issues](https://github.com/nDriaDev/vite-plugin-universal-api/issues)
- **Discussions:** [GitHub Discussions](https://github.com/nDriaDev/vite-plugin-universal-api/discussions)
- **Email:** info@ndria.dev

---



<div align="center">


If you find this plugin useful, please consider giving it a ⭐ on [GitHub](https://github.com/nDriaDev/vite-plugin-universal-api)!
</div>