# FuturableTask.of()

Create a FuturableTask from a function (recommended constructor).

## Syntax

```typescript
FuturableTask.of&lt;T&gt;(fn: () =&gt; T | Promise&lt;T&gt;): FuturableTask&lt;T&gt;
```

## Parameters

### `fn`
A function that returns the value or Promise.

## Examples

```typescript
// Sync function
const task = FuturableTask.of(() =&gt; 42);

// Async function
const task = FuturableTask.of(async () =&gt; {
  const res = await fetch('/api/data');
  return res.json();
});

// With complex logic
const task = FuturableTask.of(() =&gt; {
  const data = processData();
  return validateData(data);
});
```

## See Also

- [Constructor](/api-task/constructor)
- [resolve()](/api-task/resolve)
- [reject()](/api-task/reject)