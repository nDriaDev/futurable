# delay()

Delay the execution of the task by a specified time.

## Syntax

```typescript
task.delay(ms: number): FuturableTask&lt;T&gt;
```

## Parameters

### `ms`
Delay in milliseconds before execution.

## Examples

```typescript
const task = FuturableTask
  .of(() =&gt; sendNotification())
  .delay(1000); // Wait 1 second before sending

await task.run();
```

### Rate Limiting

```typescript
const tasks = ids.map(id =&gt;
  FuturableTask
    .of(() =&gt; fetchData(id))
    .delay(id * 100) // Stagger requests
);
```

## See Also

- [timeout()](/api-task/timeout)
- [debounce()](/api-task/debounce)
