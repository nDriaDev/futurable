# Error Handling

FuturableTask provides powerful error handling capabilities that go beyond try-catch, including automatic retries, fallbacks, and safe execution patterns.

## Basic Error Handling

### FuturableTask.try()

Create a lazy task from any function — synchronous, asynchronous, or one that may throw — and have its errors captured automatically as rejections:

```typescript
// Synchronous function that may throw
const task = FuturableTask.try(() => JSON.parse(rawInput));

// The function is NOT called yet (lazy)
const result = await task.runSafe();

if (result.success) {
  console.log('Parsed:', result.data);
} else {
  console.error('Invalid JSON:', result.error);
}
```

Unlike `FuturableTask.of()`, `try()` makes the "catch sync throws" contract explicit and mirrors the `Promise.try()` standard API. It does not receive `FuturableUtils` — use `of()` if you need `signal`, `delay`, `fetch`, etc.

```typescript
// Unified interface for sync and async callbacks
function buildTask(action: () => unknown) {
  return FuturableTask.try(action)
    .retry(3)
    .timeout(5000);
}

buildTask(() => loadFromCache());         // sync
buildTask(async () => fetchFromAPI());    // async
buildTask(() => { throw new Error(); });  // sync throw — caught on run()
```

Each call to `run()` invokes the function independently:

```typescript
const task = FuturableTask.try(() => computeValue());
const r1 = await task.run(); // independent execution
const r2 = await task.run(); // independent execution
```

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
type SafeResult<T> =
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
  showError(result.error);  // TypeScript knows result.error exists
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

Automatically retry failed operations with an optional fixed delay between attempts.

**Signature:**
```typescript
retry(retries: number, delayMs?: number): FuturableTask<T>
```

- `retries` — number of additional attempts after the first. Total attempts = `retries + 1`.
- `delayMs` — optional fixed delay in milliseconds between attempts (default: `0`).

**Basic usage:**
```typescript
const task = FuturableTask
  .of(() => unreliableAPI())
  .retry(3); // Up to 4 total attempts

const result = await task.run();
```

**With fixed delay between retries:**
```typescript
const task = FuturableTask
  .of(() => fetch('/api/data'))
  .retry(5, 1000); // Retry up to 5 times, wait 1s between each
```

**Combine with timeout — each attempt has its own timeout:**
```typescript
const resilient = FuturableTask
  .fetch('/api/data')
  .timeout(5000)
  .retry(3, 1000);
```

## Timeout Protection

### timeout()

Automatically fail the task if it does not complete within the specified duration.

**Signature:**
```typescript
timeout(ms: number, reason?: any): FuturableTask<T>
```

- `ms` — timeout duration in milliseconds.
- `reason` — the rejection value if the timeout is reached (default: `"TimeoutExceeded"`). Can be any value, typically an `Error`.

**Examples:**
```typescript
// Default reason
const task = FuturableTask
  .of(() => slowOperation())
  .timeout(5000); // Rejects with "TimeoutExceeded" after 5s

try {
  const result = await task.run();
} catch (reason) {
  console.log(reason); // "TimeoutExceeded"
}

// Custom reason
const task = FuturableTask
  .fetch('/api/data')
  .timeout(3000, new Error('API request timed out after 3s'));

// Per-step timeouts in a pipeline
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

## Recovery Strategies

### catchError()

Handle errors by providing a fallback task. The callback receives the error and must return a new `FuturableTask`.

**Signature:**
```typescript
catchError<U>(fn: (err: any) => FuturableTask<U>): FuturableTask<T | U>
```

**Examples:**
```typescript
// Fallback to a static value
const userData = await FuturableTask
  .of(() => fetchUser(id))
  .catchError(() => FuturableTask.resolve({ id, name: 'Unknown', email: '' }))
  .run();

// Error-dependent fallback
const data = await FuturableTask
  .of(() => fetchFromPrimary())
  .catchError(error => {
    if (error.status === 404) {
      return FuturableTask.of(() => fetchFromArchive());
    }
    return FuturableTask.reject(error); // Re-throw if not recoverable
  })
  .run();
```

### orElse()

Provide an alternative task to execute if this one fails. Similar to `catchError()`, but enforces the same result type `T`.

**Signature:**
```typescript
orElse(fn: (err: any) => FuturableTask<T>): FuturableTask<T>
```

**Examples:**
```typescript
// Fallback chain
const getData = FuturableTask
  .of(() => fetchFromFastAPI())
  .orElse(() => FuturableTask.of(() => fetchFromSlowAPI()))
  .orElse(() => FuturableTask.of(() => getFromCache()))
  .orElse(() => FuturableTask.resolve(DEFAULT_DATA));

// Conditional fallback
const fetchUser = FuturableTask
  .of(() => fetchFromDatabase(id))
  .orElse(error => {
    if (error.code === 'DB_UNAVAILABLE') {
      return FuturableTask.of(() => fetchFromCache(id));
    }
    return FuturableTask.reject(error);
  });
```

### fallbackTo()

Provide a static default value if the task fails. Shorthand for `orElse(() => FuturableTask.resolve(value))`.

**Signature:**
```typescript
fallbackTo<U>(fallback: U): FuturableTask<T | U>
```

**Examples:**
```typescript
// Return null instead of throwing
const user = await FuturableTask
  .of(() => fetchUser(id))
  .fallbackTo(null)
  .run();

// Default configuration
const config = await FuturableTask
  .of(() => loadUserConfig())
  .fallbackTo(DEFAULT_CONFIG)
  .run();
```

### bimap()

Transform both the success value and the error into new values without changing the task's resolution behavior.

**Signature:**
```typescript
bimap<U, V>(onSuccess: (value: T) => U, onError: (error: any) => V): FuturableTask<U>
```

Note: `onError` transforms the rejection reason passed to `rej()`, but the task type is still governed by `onSuccess`'s return type `U`.

**Examples:**
```typescript
const task = FuturableTask
  .of(() => riskyOperation())
  .bimap(
    result => ({ status: 'success', data: result }),
    error  => new CustomError(error.message)
  );

// Normalizing API responses
const normalized = await fetchData()
  .bimap(
    data => ({ status: 'ok' as const, data }),
    err  => ({ status: 'error' as const, message: err.message })
  )
  .run();
```

## Combining Error Strategies

### Retry + Fallback

```typescript
const task = FuturableTask
  .of(() => primaryAPI())
  .retry(3, 1000)
  .orElse(() => FuturableTask.of(() => backupAPI()))
  .fallbackTo(DEFAULT_DATA);
```

### Timeout + Retry + Fallback

```typescript
const robustTask = FuturableTask
  .of(() => remoteAPI())
  .timeout(5000)                                         // Timeout per attempt
  .retry(3, 1000)                                        // Retry with fixed delay
  .orElse(() => FuturableTask.of(() => fallbackAPI()))   // Try fallback
  .catchError(error => {                                 // Final handler
    console.error('All attempts failed:', error);
    return FuturableTask.resolve(DEFAULT_VALUE);
  });
```

## Advanced Patterns

### Circuit Breaker

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
    .retry(2, 500)
    .catchError(async error => {
      console.warn('Full data unavailable, falling back to partial data');
      return FuturableTask.of(() => getPartialData());
    });
```

### Error Aggregation

Run multiple tasks and collect both successes and failures without short-circuiting:

```typescript
const fetchMultiple = (urls: string[]) => {
  const tasks = urls.map(url =>
    FuturableTask.fetch(url)
      .map(res => res.json())
      .map(data => ({ success: true as const, data }))
      .catchError(err => FuturableTask.resolve({ success: false as const, error: err }))
  );

  return FuturableTask.parallel(tasks)
    .map(results => ({
      successes: results.filter(r => r.success).map(r => (r as any).data),
      failures:  results.filter(r => !r.success).map(r => (r as any).error)
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
      return FuturableTask.delay(1000).flatMap(() => tryTask());
    });

  return tryTask();
};

const result = await retryUntilSuccess(
  FuturableTask.of(() => unreliableOperation()),
  10
).run();
```

## Best Practices

### 1. Fail Fast on Permanent Errors

```typescript
// ❌ Retrying on permanent errors wastes time
FuturableTask.of(() => fetch('/api/invalid-endpoint'))
  .retry(5);

// ✅ Use catchError to filter retryable errors manually
FuturableTask.of(() => fetch('/api/data'))
  .retry(3, 500)
  .catchError(error => {
    if (error.status >= 400 && error.status < 500) {
      return FuturableTask.reject(error); // Don't retry 4xx
    }
    return FuturableTask.resolve(DEFAULT_DATA);
  });
```

### 2. Use Realistic Timeouts

```typescript
// ❌ Too short for the operation
FuturableTask.of(() => uploadLargeFile())
  .timeout(500);

// ✅ Appropriate for the expected duration
FuturableTask.of(() => uploadLargeFile())
  .timeout(30000);
```

### 3. Provide Meaningful Fallbacks

```typescript
// ❌ Silent failure loses context
FuturableTask.of(() => fetchCriticalData())
  .fallbackTo(null);

// ✅ Log and provide a meaningful default
FuturableTask.of(() => fetchCriticalData())
  .catchError(error => {
    logger.error('Critical data fetch failed:', error);
    return FuturableTask.resolve(DEFAULT_CRITICAL_DATA);
  });
```

### 4. Use runSafe() for Expected Failures

```typescript
// ✅ When failure is a normal outcome, avoid try-catch
const result = await FuturableTask
  .of(() => optionalOperation())
  .runSafe();

if (result.success) {
  processData(result.data);
} else {
  useDefaultBehavior();
}
```

### 5. Use Custom Error Types for Clarity

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
  .retry(3, 1000)
  .catchError(error => {
    if (error instanceof APIError && error.status === 404) {
      return FuturableTask.resolve(null);
    }
    return FuturableTask.reject(error);
  });
```

## See Also

- [API Reference: try()](/api-task/try) — lazy sync/async entry point
- [API Reference: retry()](/api-task/retry) — retry configuration
- [API Reference: timeout()](/api-task/timeout) — timeout configuration
- [API Reference: runSafe()](/api-task/run-safe) — safe execution API
- [API Reference: orElse()](/api-task/or-else) — alternative task on failure
- [API Reference: fallbackTo()](/api-task/fallback-to) — static fallback value