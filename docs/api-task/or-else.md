# orElse()

Provide an alternative task to try if this one fails.

## Syntax

```typescript
task.orElse(fn: (error: any) =&gt; FuturableTask&lt;T&gt;): FuturableTask&lt;T&gt;
```

## Parameters

### `fn`
Function that receives the error and returns an alternative FuturableTask.

## Examples

```typescript
const task = FuturableTask
  .fetch('/api/primary')
  .orElse(() =&gt; FuturableTask.fetch('/api/backup'))
  .orElse(() =&gt; FuturableTask.resolve(CACHED_DATA));
```

### Fallback Chain

```typescript
const getData = FuturableTask
  .fetch('/api/v2/data')
  .orElse(() =&gt; FuturableTask.fetch('/api/v1/data'))
  .orElse(() =&gt; FuturableTask.of(() =&gt; loadFromLocalStorage()));
```

## See Also

- [retry()](/api-task/retry)
