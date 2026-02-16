<div align="center">
  <br>
  <a href="https://futurable.ndria.dev/">
    <img src="https://futurable.ndria.dev/Futurable.png" alt="Futurable Logo" width="200">
  </a>
  <br>
  <h1>Futurable</h1>
  <p><strong>The async library JavaScript was missing 🚀</strong></p>

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

## 🎯 Why Futurable?

JavaScript's async ecosystem has evolved dramatically over the years—from callbacks to Promises, from async/await to various control flow libraries. Yet, despite this evolution, **critical gaps remain** in how we handle asynchronous operations in production applications.

### The Problem

Modern applications need more than just Promises. They need:

- **Cancellation**: Stop long-running operations when they're no longer needed
- **Composition**: Build complex async workflows without callback hell or try-catch pyramids
- **Control**: Fine-grained management of concurrency, retries, timeouts, and fallbacks
- **Safety**: Handle errors explicitly without littering code with try-catch blocks
- **Reusability**: Define async operations once, execute them multiple times

JavaScript's native Promise API offers none of these. AbortController exists but requires verbose boilerplate. Third-party solutions are either too opaque (RxJS), too heavy, or too limited in scope.

### The Solution

**Futurable** fills this gap with two complementary primitives:

1. **`Futurable`**: A Promise with superpowers—cancellable, chainable, and resource-aware
2. **`FuturableTask`**: A lazy computation model for functional async composition

Together, they provide everything you need to write **robust, maintainable, production-ready async code**.

---

## 📖 What is Futurable?

### Futurable: Cancellable Promises

`Futurable` extends the native Promise API with built-in cancellation support. It's a **drop-in replacement** for Promise that solves the resource management problem.

**The core insight:** When you navigate away from a page, close a modal, or change a filter, you don't just want to ignore pending operations—you want to **actively stop** them and **clean up resources**.

```typescript
import { Futurable } from '@ndriadev/futurable';

// Create a cancellable fetch request
const request = Futurable.fetch('https://api.example.com/data')
  .then(res => res.json())
  .then(data => console.log(data));

// User navigates away? Cancel it.
request.cancel();
```

**Why this matters:**

- **Memory leaks**: Prevented by cancelling pending operations
- **Race conditions**: Eliminated by cancelling stale requests
- **Resource management**: WebSocket connections, timers, and event listeners properly cleaned up
- **User experience**: No more stale data updates after navigation

#### When to use Futurable

Use `Futurable` when you need **immediate execution** with cancellation support:

- React/Vue component effects that need cleanup
- API requests that should be cancellable
- Any Promise-based code where you might need to cancel
- Drop-in replacement for existing Promise code

---

## 🎯 What is FuturableTask?

### FuturableTask: Lazy Async Composition

`FuturableTask` represents a **blueprint** for async work—it doesn't execute until you explicitly run it. Think of it as a recipe: you write it once, then bake it multiple times with different ingredients.

**The core insight:** Many async operations benefit from **lazy evaluation**—separating the definition of work from its execution enables powerful patterns like retry, memoization, and functional composition.

```typescript
import { FuturableTask } from '@ndriadev/futurable';

// Define the work (doesn't execute yet)
const fetchUser = FuturableTask
  .fetch('/api/user')
  .map(res => res.json())
  .filter(user => user.active)
  .retry(3)
  .timeout(5000)
  .memoize();

// Execute when needed
const user = await fetchUser.run();

// Execute again (uses memoized result)
const sameUser = await fetchUser.run();
```

**Why this matters:**

- **Reusability**: Define once, execute many times
- **Composition**: Chain transformations before execution
- **Testing**: Easy to test without execution
- **Optimization**: Memoization, batching, and deduplication
- **Declarative**: Describe what should happen, not when

#### When to use FuturableTask

Use `FuturableTask` when you need **lazy evaluation** with advanced composition:

- Building reusable async workflows
- Complex pipelines with retry/timeout/fallback logic
- Operations that should be memoized or deduplicated
- Functional programming patterns in async code
- Rate-limited or batched API calls

---

## 🚀 Core Capabilities

### For Futurable

#### Cancellation

Stop operations and clean up resources:

```typescript
const request = Futurable.fetch('/api/data')
  .then(res => res.json())
  .onCancel(() => {
    console.log('Cleanup: close connections, clear timers');
  });

// Cancel anytime
request.cancel();
```

#### Built-in Utilities

Native support for common patterns:

```typescript
// Sleep/delay
await Futurable.sleep(1000);

// Delayed execution
const result = await new Futurable(resolve => {
  resolve('value');
}).delay(() => 'delayed', 2000);

// Polling
const status = await Futurable.polling(
  () => checkStatus(),
  1000 // every second
);

// Cancellable fetch
const data = await Futurable.fetch('/api/data')
  .then(res => res.json());
```

#### Safe Error Handling

Handle errors without try-catch:

```typescript
const result = await Futurable.fetch('/api/data')
  .then(res => res.json())
  .safe();

if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

---

### For FuturableTask

#### Functional Composition

Build complex pipelines declaratively:

```typescript
const pipeline = FuturableTask
  .fetch('/api/users')
  .map(res => res.json())
  .filter(users => users.length > 0)
  .map(users => users.filter(u => u.active))
  .map(users => users.sort((a, b) => a.name.localeCompare(b.name)))
  .tap(users => console.log(`Found ${users.length} active users`));

const users = await pipeline.run();
```

#### Error Recovery

Sophisticated error handling strategies:

```typescript
const resilient = FuturableTask
  .fetch('/api/data')
  .retry(3, {
    delay: 1000,
    backoff: 2  // exponential backoff
  })
  .timeout(5000)
  .orElse(() => FuturableTask.fetch('/api/backup'))
  .fallbackTo(() => CACHED_DATA);
```

#### Concurrency Control

Fine-grained control over parallel execution:

```typescript
// Limit concurrent requests
const limiter = FuturableTask.createLimiter(5, {
  onActive: () => console.log('Task started'),
  onIdle: () => console.log('All done')
});

const tasks = urls.map(url =>
  limiter(FuturableTask.fetch(url))
);

// Only 5 run at once
const results = await FuturableTask.parallel(tasks).run();
```

#### Debouncing

Automatic debouncing for user input:

```typescript
const search = FuturableTask
  .of((query: string) => searchAPI(query))
  .debounce(300);

// Rapid calls - only last executes
search.run('a');   // cancelled
search.run('ab');  // cancelled
search.run('abc'); // executes after 300ms
```

#### Memoization

Cache expensive operations:

```typescript
const loadConfig = FuturableTask
  .fetch('/api/config')
  .map(res => res.json())
  .memoize();

const config1 = await loadConfig.run(); // Fetches
const config2 = await loadConfig.run(); // Cached
const config3 = await loadConfig.run(); // Cached
```

---

## 💡 Real-World Examples

### React Component with Cleanup

```typescript
import { useEffect, useState } from 'react';
import { Futurable } from '@ndriadev/futurable';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const request = Futurable
      .fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error(error);
        }
        setLoading(false);
      });

    // Cleanup on unmount or userId change
    return () => request.cancel();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  return <div>{user?.name}</div>;
}
```

### Reusable API Client

```typescript
class APIClient {
  private baseURL = 'https://api.example.com';

  // Reusable task definitions
  fetchUser = (id: number) =>
    FuturableTask
      .fetch(`${this.baseURL}/users/${id}`)
      .map(res => res.json())
      .retry(3)
      .timeout(5000)
      .memoize();

  searchUsers = (query: string) =>
    FuturableTask
      .fetch(`${this.baseURL}/users/search?q=${query}`)
      .map(res => res.json())
      .debounce(300)
      .timeout(10000);

  // Execute when needed
  async getUser(id: number) {
    return this.fetchUser(id).run();
  }

  async search(query: string) {
    return this.searchUsers(query).run();
  }
}
```

### Complex Data Pipeline

```typescript
const processData = FuturableTask
  .fetch('/api/raw-data')
  .map(res => res.json())
  .tap(data => console.log(`Received ${data.length} items`))
  .filter(data => data.length > 0, 'No data available')
  .map(data => data.map(item => ({
    ...item,
    processed: true,
    timestamp: Date.now()
  })))
  .flatMap(data =>
    FuturableTask.traverse(
      data,
      item => FuturableTask.of(() => enrichItem(item))
    )
  )
  .tap(results => console.log(`Processed ${results.length} items`))
  .retry(2, { delay: 1000 })
  .timeout(30000)
  .fallbackTo(error => {
    console.error('Pipeline failed:', error);
    return [];
  });

const results = await processData.run();
```

### Rate-Limited Batch Processing

```typescript
async function processLargeDataset(items: Item[]) {
  // Create limiter (max 10 concurrent)
  const limiter = FuturableTask.createLimiter(10, {
    onActive: () => console.log(`Active: ${limiter.activeCount}/10`),
    onCompleted: (result) => updateProgress(result),
    onIdle: () => console.log('Batch complete')
  });

  // Process in batches of 50
  const batches = chunk(items, 50);

  const results = await FuturableTask.sequence(
    batches.map(batch =>
      FuturableTask.parallel(
        batch.map(item =>
          limiter(
            FuturableTask
              .of(() => processItem(item))
              .retry(3)
              .timeout(5000)
          )
        )
      )
    )
  ).run();

  return results.flat();
}
```

---

## 🎨 Design Philosophy

### 1. Progressive Enhancement

Start simple, add complexity only when needed:

```typescript
// Simple
const data = await Futurable.fetch('/api/data')
  .then(res => res.json());

// Add cancellation
const request = Futurable.fetch('/api/data')
  .then(res => res.json());
request.cancel();

// Add retry and timeout
const resilient = FuturableTask
  .fetch('/api/data')
  .map(res => res.json())
  .retry(3)
  .timeout(5000);
```

### 2. Type Safety First

Full TypeScript support with inference:

```typescript
const result = await FuturableTask
  .of(() => 42)                    // FuturableTask<number>
  .map(x => x.toString())          // FuturableTask<string>
  .filter(s => s.length > 0)       // FuturableTask<string>
  .run();                          // Promise<string>
```

### 3. Zero Dependencies

No external dependencies. Small bundle size. Tree-shakeable.

### 4. Promise Compatible

`Futurable` **is** a Promise. Works with `async/await`, `Promise.all()`, and any Promise-based API.

---

## 📦 Installation

```bash
npm install @ndriadev/futurable
```

```bash
yarn add @ndriadev/futurable
```

```bash
pnpm add @ndriadev/futurable
```

---

## 🎯 Quick Start

### Basic Futurable

```typescript
import { Futurable } from '@ndriadev/futurable';

// Cancellable fetch
const request = Futurable.fetch('/api/data')
  .then(res => res.json());

request.cancel(); // Cancel if needed
```

### Basic FuturableTask

```typescript
import { FuturableTask } from '@ndriadev/futurable';

// Define work
const task = FuturableTask
  .of(() => fetch('/api/data'))
  .map(res => res.json())
  .retry(3);

// Execute when ready
const data = await task.run();
```

---

## 📚 Documentation

📖 **[Complete Documentation](https://futurable.ndria.dev/)**

- [Getting Started Guide](https://futurable.ndria.dev/guide/getting-started)
- [Futurable API Reference](https://futurable.ndria.dev/api/constructor)
- [FuturableTask Guide](https://futurable.ndria.dev/guide-task/introduction)
- [Examples & Patterns](https://futurable.ndria.dev/examples/)

---

## 🌟 Key Features

### Futurable

| Feature | Description |
|---------|-------------|
| ✅ **Cancellation** | Cancel operations and cleanup resources |
| ✅ **Promise Compatible** | Drop-in Promise replacement |
| ✅ **Built-in Fetch** | Cancellable HTTP requests |
| ✅ **Delays & Sleep** | Timing utilities |
| ✅ **Polling** | Repeated execution with cancellation |
| ✅ **Safe Mode** | Error handling without try-catch |
| ✅ **Full TypeScript** | Complete type safety |

### FuturableTask

| Feature | Description |
|---------|-------------|
| ✅ **Lazy Evaluation** | Define once, execute when needed |
| ✅ **Reusability** | Run the same task multiple times |
| ✅ **Functional Composition** | map, filter, flatMap, tap, and more |
| ✅ **Retry Logic** | Exponential backoff and conditional retry |
| ✅ **Timeout Protection** | Automatic timeouts |
| ✅ **Error Recovery** | Fallbacks and error handling |
| ✅ **Concurrency Control** | Rate limiting and parallelism |
| ✅ **Debouncing** | Built-in debouncing |
| ✅ **Memoization** | Cache expensive operations |
| ✅ **Full TypeScript** | Complete type inference |

---

## 🎯 Use Cases

### Perfect For

- **SPA Applications**: Cancel API calls on navigation
- **React/Vue/Angular**: Component cleanup and effects
- **Real-time Features**: Polling with cancellation
- **Data Processing**: Complex async pipelines
- **API Clients**: Reusable, composable requests
- **Rate Limiting**: Control concurrent operations
- **Form Handling**: Debounced search and auto-save
- **Resource Management**: Proper async cleanup

---

## 🌐 Browser & Node.js Support

- ✅ All modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Node.js 14+
- ✅ TypeScript 4.5+
- ✅ ES2015+ (ES6+)

---

## 📄 License

[MIT](LICENSE) © [nDriaDev](https://github.com/nDriaDev)

---

## 🙏 Acknowledgments

Futurable draws inspiration from:
- **Promises/A+** specification
- **RxJS** observables and operators
- **Fluture** and functional programming patterns
- Real-world production challenges in modern web apps

---

## 📞 Support

- **Documentation**: [futurable.ndria.dev](https://futurable.ndria.dev/)
- **Issues**: [GitHub Issues](https://github.com/nDriaDev/futurable/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nDriaDev/futurable/discussions)
- **Email**: info@ndria.dev

---

<div align="center">

**If you find Futurable useful, please consider giving it a ⭐ on [GitHub](https://github.com/nDriaDev/futurable)!**

</div>