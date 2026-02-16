# FuturableTask.parallel()

Execute multiple tasks concurrently.

## Syntax

```typescript
FuturableTask.parallel&lt;T&gt;(
  tasks: FuturableTask&lt;T&gt;[],
  signal?: AbortSignal
): FuturableTask&lt;T[]&gt;
```

## Parameters

### `tasks`
Array of tasks to execute in parallel.

### `signal` (optional)
AbortSignal for cancellation.

## Examples

```typescript
const tasks = [
  FuturableTask.fetch('/api/users'),
  FuturableTask.fetch('/api/posts'),
  FuturableTask.fetch('/api/comments')
];

const [users, posts, comments] = await FuturableTask
  .parallel(tasks)
  .run();
```

### With Rate Limiting

```typescript
const limiter = FuturableTask.createLimiter(5);

const tasks = urls.map(url =&gt;
  limiter(FuturableTask.fetch(url))
);

const results = await FuturableTask.parallel(tasks).run();
```

## See Also

- [sequence()](/api-task/sequence)
- [createLimiter()](/api-task/create-limiter)
- [Concurrency Guide](/guide-task/concurrency)