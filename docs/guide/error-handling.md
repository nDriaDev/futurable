# Error Handling with Futurable

Learn how to handle errors effectively when working with Futurable.

## Basic Error Handling

### Using catch()

The traditional Promise way:

```typescript
Futurable.fetch('/api/data')
  .then(res => res.json())
  .catch(error => {
    console.error('Request failed:', error);
    return DEFAULT_DATA;
  });
```

### Using try-catch

With async/await:

```typescript
try {
  const response = await Futurable.fetch('/api/data');
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error('Request failed:', error);
}
```

### Using try()

For code that may be synchronous or asynchronous — and may throw synchronously:

```typescript
// Safe entry point: catches synchronous throws that Futurable.resolve(fn()) would miss
const result = await Futurable.try(() => JSON.parse(rawInput))
  .safe();

if (result.success) {
  console.log('Parsed:', result.data);
} else {
  console.error('Invalid JSON:', result.error);
}
```

`Futurable.try()` is particularly useful when you don't control whether a callback is sync or async:

```typescript
function execute(action: () => unknown) {
  return Futurable.try(action)
    .then(result => console.log('Result:', result))
    .catch(error => console.error('Error:', error));
}

execute(() => 'sync value');                       // ✅
execute(() => { throw new Error('sync error'); }); // ✅ caught
execute(async () => 'async value');                // ✅
execute(async () => { throw new Error(); });       // ✅ caught
```

### Using safe()

For explicit error handling without try-catch:

```typescript
const result = await Futurable.fetch('/api/data')
  .then(res => res.json())
  .safe();

if (result.success) {
  console.log('Data:', result.data);
} else {
  console.error('Error:', result.error);
}
```

## Cancellation Errors

## Cancellation

When a Futurable is cancelled, it stops executing silently — it neither resolves nor rejects.
This means `.catch()` is **not** called on cancellation, and any pending `.then()` callbacks
are also skipped.

The only exception is `fetch`: if a fetch request is in progress and the Futurable is cancelled,
the underlying network request is aborted. Futurable silently suppresses the resulting `AbortError`
internally, so your `.catch()` handler is not triggered for cancellations either.

```typescript
const request = Futurable.fetch('/api/data')
  .then(res => res.json())
  .catch(error => {
    // ⚠️ This is NOT called when cancel() is used
    // It is only called for genuine network errors
    console.error('Request failed:', error);
    return null;
  });

// Cancel after 1 second — no error is thrown or caught
setTimeout(() => request.cancel(), 1000);
```

If you need to react to cancellation, use `onCancel()`:

```typescript
const request = Futurable.fetch('/api/data')
  .onCancel(() => {
    console.log('Request was cancelled');
  });

setTimeout(() => request.cancel(), 1000);
```

## Error Recovery Patterns

### Fallback Chain

Try multiple sources:

```typescript
Futurable.fetch('/api/primary')
  .catch(() => fetch('/api/backup'))
  .catch(() => fetch('/api/cache'))
  .catch(() => DEFAULT_DATA);
```

### Conditional Recovery

Different fallbacks based on error type:

```typescript
Futurable.fetch('/api/data')
  .catch(error => {
    if (error.status === 404) {
      return fetch('/api/default');
    }
    if (error.name === 'NetworkError') {
      return loadFromCache();
    }
    throw error; // Can't recover
  });
```

### Retry Pattern

Retry failed operations:

```typescript
async function fetchWithRetry(url: string, retries: number = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await Futurable.fetch(url);
    } catch (error) {
      if (i === retries - 1) throw error;
      await Futurable.sleep(1000 * (i + 1));
    }
  }
}
```

## React Integration

### Cleanup on Unmount

```typescript
import { useEffect, useState } from 'react';

function DataFetcher() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const request = Futurable.fetch('/api/data')
      .then(res => res.json())
      .then(setData)
      .catch(error => {
        if (error.name !== 'AbortError') {
          setError(error);
        }
      });

    return () => request.cancel();
  }, []);

  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>Loading...</div>;
  return <div>{data.name}</div>;
}
```

### Using safe() in React

```typescript
useEffect(() => {
  const request = Futurable.fetch('/api/data')
    .then(res => res.json())
    .safe()
    .then(result => {
      if (result.success) {
        setData(result.data);
      } else if (result.error.name !== 'AbortError') {
        setError(result.error);
      }
    });

  return () => request.cancel();
}, []);
```

## Best Practices

### 1. Always Handle Errors

```typescript
// ✅ Good
Futurable.fetch('/api/data')
  .then(res => res.json())
  .catch(error => {
    console.error(error);
    return null;
  });

// ❌ Bad - unhandled rejection
Futurable.fetch('/api/data')
  .then(res => res.json());
```

### 2. Handle Cancellation Separately

```typescript
// ✅ Good - distinguish cancellation from errors
.catch(error => {
  if (error.name === 'AbortError') {
    console.log('Cancelled');
    return null;
  }
  console.error('Failed:', error);
  throw error;
})

// ❌ Bad - treating cancellation as error
.catch(error => {
  logError(error); // Logs cancellation as error
})
```

### 3. Provide Meaningful Fallbacks

```typescript
// ✅ Good - meaningful fallback
.catch(error => {
  console.error('Failed to load user data:', error);
  return {
    name: 'Guest',
    permissions: ['read']
  };
})

// ❌ Bad - null without context
.catch(() => null)
```

### 4. Use safe() for Expected Failures

```typescript
// ✅ Good - expected to potentially fail
const result = await validateInput(input).safe();
if (!result.success) {
  showValidationError(result.error);
}

// ❌ Bad - using try-catch for control flow
try {
  await validateInput(input);
} catch (error) {
  showValidationError(error);
}
```

## Common Patterns

### Loading States

```typescript
class LoadingState {
  static idle() {
    return { loading: false, data: null, error: null };
  }

  static loading() {
    return { loading: true, data: null, error: null };
  }

  static success(data: any) {
    return { loading: false, data, error: null };
  }

  static error(error: any) {
    return { loading: false, data: null, error };
  }
}

// Usage
let state = LoadingState.loading();

const result = await Futurable.fetch('/api/data')
  .then(res => res.json())
  .safe();

if (result.success) {
  state = LoadingState.success(result.data);
} else {
  state = LoadingState.error(result.error);
}
```

### Timeout Pattern

```typescript
function withTimeout<T>(
  futurable: Futurable<T>,
  ms: number
): Futurable<T> {
  return new Futurable((resolve, reject, { signal }) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'));
    }, ms);

    futurable
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

// Usage
await withTimeout(
  Futurable.fetch('/api/slow'),
  5000
);
```

### Circuit Breaker

```typescript
class CircuitBreaker {
  private failures = 0;
  private threshold = 5;
  private timeout = 60000;
  private isOpen = false;

  async execute<T>(fn: () => Futurable<T>): Promise<T> {
    if (this.isOpen) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures++;
      if (this.failures >= this.threshold) {
        this.isOpen = true;
        setTimeout(() => {
          this.isOpen = false;
          this.failures = 0;
        }, this.timeout);
      }
      throw error;
    }
  }
}
```

## See Also

- [try()](/api/static-try) - Unified sync/async entry point with error capture
- [safe()](/api/safe) - Safe error handling
- [catch()](/api/catch) - Traditional error catching
- [onCancel()](/api/on-cancel) - Cancellation callbacks
- [cancel()](/api/cancel) - Cancelling operations
