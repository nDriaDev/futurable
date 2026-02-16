# retry()

Automatically retry failed operations with configurable strategies.

## Syntax

```typescript
task.retry(times: number, options?: {
  delay?: number;
  backoff?: number;
  shouldRetry?: (error: any, attempt: number) =&gt; boolean | Promise&lt;boolean&gt;;
}): FuturableTask&lt;T&gt;
```

## Parameters

### `times`
Maximum number of retry attempts.

### `options` (optional)

- **`delay`**: Milliseconds to wait between retries (default: 0)
- **`backoff`**: Multiplier for exponential backoff (default: 1)
- **`shouldRetry`**: Function to determine if retry should happen

## Return Value

A new `FuturableTask&lt;T&gt;` with retry logic.

## Examples

### Basic Retry

```typescript
const task = FuturableTask
  .fetch('/api/data')
  .retry(3); // Retry up to 3 times
```

### Fixed Delay

```typescript
const task = FuturableTask
  .of(() =&gt; unreliableOperation())
  .retry(5, { delay: 1000 }); // Wait 1s between retries
```

### Exponential Backoff

```typescript
const task = FuturableTask
  .fetch('/api/data')
  .retry(5, {
    delay: 1000,
    backoff: 2
  });
// Delays: 1s, 2s, 4s, 8s, 16s
```

### Conditional Retry

```typescript
const task = FuturableTask
  .fetch('/api/data')
  .retry(3, {
    shouldRetry: (error) =&gt; {
      // Only retry on network errors
      return error.name === 'NetworkError';
    }
  });
```

### With Logging

```typescript
const task = FuturableTask
  .of(() =&gt; apiCall())
  .retry(3, {
    delay: 1000,
    shouldRetry: (error, attempt) =&gt; {
      console.log(`Attempt ${attempt} failed:`, error);
      return attempt &lt; 3;
    }
  });
```

## See Also

- [timeout()](/api-task/timeout)
- [Error Handling Guide](/guide-task/error-handling)