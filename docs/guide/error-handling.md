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

When a Futurable is cancelled, it throws an AbortError:

```typescript
const request = Futurable.fetch('/api/data')
  .catch(error => {
    if (error.name === 'AbortError') {
      console.log('Request was cancelled');
      return null;
    }
    throw error; // Re-throw other errors
  });

// Cancel after 1 second
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

- [safe()](/api/safe) - Safe error handling
- [catch()](/api/catch) - Traditional error catching
- [onCancel()](/api/on-cancel) - Cancellation callbacks
- [cancel()](/api/cancel) - Cancelling operations
