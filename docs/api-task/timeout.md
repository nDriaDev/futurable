# timeout()

Automatically fail if the operation takes too long.

## Syntax

```typescript
task.timeout(ms: number, message?: string): FuturableTask&lt;T&gt;
```

## Parameters

### `ms`
Timeout in milliseconds.

### `message` (optional)
Custom error message. Default: "Task timed out after {ms}ms"

## Examples

```typescript
const task = FuturableTask
  .fetch('/api/slow')
  .timeout(5000); // Fail after 5 seconds
```

### With Retry

```typescript
const task = FuturableTask
  .fetch('/api/data')
  .timeout(3000)
  .retry(3);
```

### Custom Message

```typescript
const task = FuturableTask
  .of(() =&gt; slowOperation())
  .timeout(5000, 'Operation took too long');
```

## See Also

- [retry()](/api-task/retry)
- [delay()](/api-task/delay)
