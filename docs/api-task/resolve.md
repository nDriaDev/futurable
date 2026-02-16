# FuturableTask.resolve()

Create a task that immediately resolves with a value.

## Syntax

```typescript
FuturableTask.resolve&lt;T&gt;(value: T): FuturableTask&lt;T&gt;
```

## Parameters

### `value`
The value to resolve with.

## Return Value

A `FuturableTask&lt;T&gt;` that resolves with the provided value.

## Description

Creates a task that immediately succeeds with the given value when executed. Useful for starting task chains or providing default values.

## Examples

### Basic Usage

```typescript
const task = FuturableTask.resolve(42);
const result = await task.run(); // 42
```

### Starting a Chain

```typescript
const task = FuturableTask
  .resolve([1, 2, 3, 4, 5])
  .map(arr =&gt; arr.filter(x =&gt; x &gt; 2))
  .map(arr =&gt; arr.map(x =&gt; x * 2));

const result = await task.run(); // [6, 8, 10]
```

### Conditional Tasks

```typescript
const task = condition
  ? FuturableTask.resolve(cachedData)
  : FuturableTask.fetch('/api/data').map(r =&gt; r.json());
```

### Default Values

```typescript
const getData = (useCache: boolean) =&gt;
  useCache
    ? FuturableTask.resolve(CACHED_VALUE)
    : FuturableTask.of(() =&gt; fetchFreshData());
```

### Testing

```typescript
// Mock async operations in tests
const mockFetch = FuturableTask.resolve({
  id: 1,
  name: 'Test User'
});
```

## See Also

- [reject()](/api-task/reject) - Create a failing task
- [of()](/api-task/of) - Create from function
- [Constructor](/api-task/constructor)