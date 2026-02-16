# FuturableTask.createLimiter()

Create a limiter that restricts concurrent task execution.

## Syntax

```typescript
FuturableTask.createLimiter(
  concurrency: number,
  events?: LimiterEvents
): FuturableTaskLimiter
```

## Parameters

### `concurrency`
Maximum number of concurrent tasks.

### `events` (optional)
Event hooks for monitoring:
- `onActive(task)` - Task starts
- `onCompleted(result)` - Task completes
- `onError(error)` - Task fails
- `onIdle()` - All tasks finished

## Return Value

A limiter function with properties:
- `activeCount` - Currently running tasks
- `pendingCount` - Tasks waiting to run
- `concurrency` - Max concurrent tasks

## Examples

```typescript
const limiter = FuturableTask.createLimiter(3);

const tasks = urls.map(url =&gt;
  limiter(FuturableTask.fetch(url))
);

await FuturableTask.parallel(tasks).run();
// Only 3 requests run at once
```

### With Events

```typescript
const limiter = FuturableTask.createLimiter(5, {
  onActive: () =&gt; console.log(`Active: ${limiter.activeCount}/5`),
  onCompleted: (result) =&gt; console.log('Done:', result),
  onIdle: () =&gt; console.log('All finished')
});
```

### API Rate Limiting

```typescript
const apiLimiter = FuturableTask.createLimiter(10);

const fetchUsers = (ids: number[]) =&gt; {
  const tasks = ids.map(id =&gt;
    apiLimiter(
      FuturableTask.fetch(`/api/users/${id}`)
        .map(res =&gt; res.json())
    )
  );
  return FuturableTask.parallel(tasks);
};
```

## See Also

- [parallel()](/api-task/parallel)
- [Concurrency Guide](/guide-task/concurrency)