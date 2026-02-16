# Error Handling

FuturableTask provides powerful error handling capabilities that go beyond try-catch, including automatic retries, fallbacks, fallbackToy strategies, and safe execution patterns.

## Basic Error Handling

### try-catch with run()

The traditional approach still works:

```typescript
const task = FuturableTask.of(() => riskyOperation());

try {
  const result = await task.run();
  console.log('Success:', result);
} catch (error) {
  console.error('Failed:', error);
}
```

### runSafe()

Execute a task and get a Result type instead of throwing:

```typescript
const task = FuturableTask.of(() => riskyOperation());

const result = await task.runSafe();

if (result.success) {
  console.log('Data:', result.data);
  console.log('Error is null:', result.error);
} else {
  console.log('Error:', result.error);
  console.log('Data is null:', result.data);
}
```

**Type signature:**
```typescript
type Result<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: any };
```

**Benefits:**
- No try-catch needed
- Type-safe error handling
- Explicit success/failure paths
- Works well with TypeScript discriminated unions

**Examples:**
```typescript
// Pattern matching style
const result = await fetchUser(id).runSafe();

if (result.success) {
  displayUser(result.data); // TypeScript knows result.data exists
} else {
  showError(result.error); // TypeScript knows result.error exists
}

// Early returns
async function loadUserData(id: number) {
  const result = await fetchUser(id).runSafe();
  if (!result.success) return null;

  return processUser(result.data);
}
```

## Retry Strategies

### retry()

Automatically retry failed operations with configurable strategies.

**Basic Usage:**
```typescript
const task = FuturableTask
  .of(() => unreliableAPI())
  .retry(3); // Retry up to 3 times

const result = await task.run();
```

**Signature:**
```typescript
retry(times: number, options?: {
  delay?: number;
  backoff?: number;
  shouldRetry?: (error: any, attempt: number) => boolean | Promise<boolean>;
}): FuturableTask<T>
```

### Fixed Delay Retry

Wait a fixed amount of time between retries:

```typescript
const task = FuturableTask
  .of(() => fetch('/api/data'))
  .retry(5, {
    delay: 1000  // Wait 1 second between retries
  });
```

### Exponential Backoff

Increase delay between retries exponentially:

```typescript
const task = FuturableTask
  .of(() => fetch('/api/data'))
  .retry(5, {
    delay: 1000,    // Initial delay
    backoff: 2      // Multiply by 2 each time
  });
// Delays: 1s, 2s, 4s, 8s, 16s
```

### Conditional Retry

Only retry on specific errors:

```typescript
const task = FuturableTask
  .of(() => fetch('/api/data'))
  .retry(3, {
    shouldRetry: (error, attempt) => {
      // Only retry on network errors, not 4xx errors
      return error.name === 'NetworkError';
    }
  });
```

**Advanced Examples:**
```typescript
// Retry with increasing delays and conditions
const resilientTask = FuturableTask
  .of(() => criticalOperation())
  .retry(5, {
    delay: 1000,
    backoff: 2,
    shouldRetry: async (error, attempt) => {
      // Check if service is available before retrying
      const isAvailable = await checkServiceHealth();
      return isAvailable && attempt < 3;
    }
  });

// Different strategies for different errors
const smartRetry = FuturableTask
  .of(() => apiCall())
  .retry(3, {
    delay: 500,
    shouldRetry: (error) => {
      // Fast retry for rate limits
      if (error.status === 429) return true;
      // No retry for client errors
      if (error.status >= 400 && error.status < 500) return false;
      // Retry for server errors
      return error.status >= 500;
    }
  });
```

## fallbackToy Strategies

### catchError()

fallbackTo from errors by providing a fallback value or function:

```typescript
const task = FuturableTask
  .of(() => riskyOperation())
  .catchError(error => {
    console.error('Operation failed:', error);
    return FuturableTask.of(defaultValue);
  });

const result = await task.run(); // Always succeeds
```

**Signature:**
```typescript
catchError(fn: (error: any) => FuturableTask<U>): FuturableTask<T | U>
```

**Examples:**
```typescript
// Simple fallback
const userData = await FuturableTask
  .of(() => fetchUser(id))
  .catchError(() => ({ id, name: 'Unknown', email: '' }))
  .run();

// Async fallbackToy
const config = await FuturableTask
  .of(() => loadRemoteConfig())
  .catchError(async () => await loadLocalConfig())
  .run();

// Error-dependent fallbackToy
const data = await FuturableTask
  .of(() => fetchFromPrimary())
  .catchError(error => {
    if (error.status === 404) {
      return fetchFromArchive();
    }
    throw error; // Re-throw if not 404
  })
  .run();
```

### orElse()

Provide an alternative task to try if this one fails:

```typescript
const task = FuturableTask
  .of(() => fetchFromPrimaryAPI())
  .orElse(() => FuturableTask.of(() => fetchFromBackupAPI()))
  .orElse(() => FuturableTask.of(() => fetchFromCache()));

const result = await task.run();
```

**Signature:**
```typescript
orElse(fn: (error: any) => FuturableTask<T>): FuturableTask<T>
```

**Examples:**
```typescript
// Fallback chain
const getData = FuturableTask
  .of(() => fetchFromFastAPI())
  .orElse(() => FuturableTask.of(() => fetchFromSlowAPI()))
  .orElse(() => FuturableTask.of(() => getFromCache()))
  .orElse(() => FuturableTask.resolve(DEFAULT_DATA));

// Conditional fallbacks
const fetchUser = FuturableTask
  .of(() => fetchFromDatabase(id))
  .orElse(error => {
    if (error.code === 'DB_UNAVAILABLE') {
      return FuturableTask.of(() => fetchFromCache(id));
    }
    return FuturableTask.reject(error);
  });

// Multiple fallback strategies
const robustFetch = FuturableTask
  .fetch('/api/v2/data')
  .orElse(() => FuturableTask.fetch('/api/v1/data'))
  .orElse(() => FuturableTask.of(() => loadFromLocalStorage()))
  .catchError(() => EMPTY_DATA);
```

### bimap()

Handle both success and error cases:

```typescript
const task = FuturableTask
  .of(() => riskyOperation())
  .bimap(
    result => ({ status: 'success', data: result }),
    error => ({ status: 'error', message: error.message })
  );

const outcome = await task.run();
console.log(outcome.status); // 'success' or 'error'
```

### fallbackTo()

Provides a default value if the task fails
```typescript
// Nullish values
const user = await FuturableTask.of(() => fetchUser(id))
  .fallbackTo(null)
  .run();
// Returns null instead of throwing on error
```

## Timeout Protection

### timeout()

Automatically fail if the operation takes too long:

```typescript
const task = FuturableTask
  .of(() => slowOperation())
  .timeout(5000); // Fail after 5 seconds

try {
  const result = await task.run();
} catch (error) {
  console.log(error.message); // 'Task timed out after 5000ms'
}
```

**Signature:**
```typescript
timeout(ms: number, message?: string): FuturableTask<T>
```

**Examples:**
```typescript
// Custom timeout message
const task = FuturableTask
  .fetch('/api/data')
  .timeout(3000, 'API request timed out');

// Combine with retry
const resilient = FuturableTask
  .fetch('/api/data')
  .timeout(5000)
  .retry(3, { delay: 1000 });

// Per-operation timeouts
const pipeline = FuturableTask
  .of(() => fetchStep1())
  .timeout(2000)
  .flatMap(result =>
    FuturableTask.of(() => fetchStep2(result))
      .timeout(3000)
  )
  .flatMap(result =>
    FuturableTask.of(() => fetchStep3(result))
      .timeout(5000)
  );
```

## Combining Error Strategies

### Retry + Timeout

```typescript
const task = FuturableTask
  .of(() => unreliableAPI())
  .timeout(5000)        // Each attempt times out after 5s
  .retry(3, {           // Retry up to 3 times
    delay: 1000,
    backoff: 2
  });
```

### Retry + Fallback

```typescript
const task = FuturableTask
  .of(() => primaryAPI())
  .retry(3, { delay: 1000 })
  .orElse(() => FuturableTask.of(() => backupAPI()))
  .catchError(() => cachedData);
```

### Timeout + Retry + Fallback

```typescript
const robustTask = FuturableTask
  .of(() => remoteAPI())
  .timeout(5000)                                    // Timeout per attempt
  .retry(3, { delay: 1000, backoff: 2 })           // Retry with backoff
  .orElse(() => FuturableTask.of(() => fallbackAPI())) // Try fallback
  .catchError(error => {                               // Final fallback
    console.error('All attempts failed:', error);
    return DEFAULT_VALUE;
  });
```

## Advanced Patterns

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failures = 0;
  private threshold = 5;
  private resetTimeout = 60000;
  private isOpen = false;

  wrap<T>(task: FuturableTask<T>): FuturableTask<T> {
    return FuturableTask.of(async () => {
      if (this.isOpen) {
        throw new Error('Circuit breaker is open');
      }

      const result = await task.runSafe();

      if (result.success) {
        this.failures = 0;
        return result.data;
      } else {
        this.failures++;
        if (this.failures >= this.threshold) {
          this.isOpen = true;
          setTimeout(() => {
            this.isOpen = false;
            this.failures = 0;
          }, this.resetTimeout);
        }
        throw result.error;
      }
    });
  }
}

const breaker = new CircuitBreaker();
const protectedTask = breaker.wrap(
  FuturableTask.of(() => unreliableService())
);
```

### Graceful Degradation

```typescript
const fetchWithDegradation = (url: string) =>
  FuturableTask
    .fetch(url)
    .map(res => res.json())
    .timeout(3000)
    .retry(2)
    .catchError(async error => {
      console.warn('Full data unavailable, using partial data');
      return await getPartialData();
    });
```

### Error Aggregation

```typescript
const fetchMultiple = (urls: string[]) => {
  const tasks = urls.map(url =>
    FuturableTask.fetch(url)
      .map(res => res.json())
      .runSafe()
  );

  return FuturableTask.parallel(tasks)
    .map(results => ({
      successes: results.filter(r => r.success).map(r => r.data),
      failures: results.filter(r => !r.success).map(r => r.error)
    }));
};

const result = await fetchMultiple(urls).run();
console.log(`${result.successes.length} succeeded, ${result.failures.length} failed`);
```

### Retry Until Success

```typescript
const retryUntilSuccess = <T>(
  task: FuturableTask<T>,
  maxAttempts: number = Infinity
) => {
  let attempts = 0;

  const tryTask = (): FuturableTask<T> =>
    task.orElse(error => {
      attempts++;
      if (attempts >= maxAttempts) {
        return FuturableTask.reject(error);
      }
      return FuturableTask.sleep(1000).flatMap(() => tryTask());
    });

  return tryTask();
};

const result = await retryUntilSuccess(
  FuturableTask.of(() => unreliableOperation()),
  10
).run();
```

## Best Practices

### 1. Fail Fast When Appropriate

```typescript
// ❌ Retrying on permanent errors
FuturableTask.of(() => fetch('/api/invalid-endpoint'))
  .retry(5); // Wastes time on 404 errors

// ✅ Only retry transient errors
FuturableTask.of(() => fetch('/api/data'))
  .retry(3, {
    shouldRetry: error => error.status >= 500
  });
```

### 2. Use Appropriate Timeouts

```typescript
// ❌ Too short
FuturableTask.of(() => uploadLargeFile())
  .timeout(1000); // Will always fail

// ✅ Realistic timeout
FuturableTask.of(() => uploadLargeFile())
  .timeout(30000); // 30 seconds
```

### 3. Provide Meaningful Fallbacks

```typescript
// ❌ Silent failure
FuturableTask.of(() => fetchCriticalData())
  .catchError(() => null);

// ✅ Meaningful fallback
FuturableTask.of(() => fetchCriticalData())
  .catchError(error => {
    logger.error('Critical data fetch failed:', error);
    return getCachedData() || DEFAULT_CRITICAL_DATA;
  });
```

### 4. Log Retry Attempts

```typescript
FuturableTask.of(() => apiCall())
  .retry(3, {
    delay: 1000,
    shouldRetry: (error, attempt) => {
      console.log(`Attempt ${attempt} failed:`, error);
      return attempt < 3;
    }
  });
```

### 5. Use runSafe() for Expected Failures

```typescript
// When errors are expected and should be handled
const result = await FuturableTask
  .of(() => optionalOperation())
  .runSafe();

if (result.success) {
  processData(result.data);
} else {
  // Handle gracefully without try-catch
  useDefaultBehavior();
}
```

## Error Types

### Custom Error Classes

```typescript
class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

const task = FuturableTask
  .of(async () => {
    const res = await fetch('/api/data');
    if (!res.ok) {
      throw new APIError(res.status, `API error: ${res.statusText}`);
    }
    return res.json();
  })
  .retry(3, {
    shouldRetry: (error) => error instanceof APIError && error.status >= 500
  });
```

## Next Steps

- [Timing & Delays](/guide-task/timing) - Control when tasks execute
- [Concurrency](/guide-task/concurrency) - Manage parallel execution
- [API Reference: retry()](/api-task/retry) - Detailed retry options
- [API Reference: runSafe()](/api-task/run-safe) - Safe execution API
