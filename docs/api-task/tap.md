# tap()

Perform side effects without changing the result.

## Syntax

```typescript
task.tap(fn: (value: T) =&gt; void | Promise&lt;void&gt;): FuturableTask&lt;T&gt;
```

## Parameters

### `fn`
Function to execute for side effects. Return value is ignored.

## Return Value

A new `FuturableTask&lt;T&gt;` with the same result value.

## Examples

### Logging

```typescript
const task = FuturableTask
  .of(() =&gt; fetchData())
  .tap(data =&gt; console.log('Received:', data))
  .map(data =&gt; processData(data));
```

### Progress Tracking

```typescript
const task = FuturableTask
  .of(() =&gt; readFile())
  .tap(() =&gt; updateProgress(33))
  .map(data =&gt; parseData(data))
  .tap(() =&gt; updateProgress(66))
  .map(parsed =&gt; transformData(parsed))
  .tap(() =&gt; updateProgress(100));
```

### Caching

```typescript
const task = FuturableTask
  .fetch('/api/data')
  .map(res =&gt; res.json())
  .tap(data =&gt; cache.set('key', data))
  .map(data =&gt; data.items);
```

### Analytics

```typescript
const task = FuturableTask
  .of(() =&gt; performAction())
  .tap(result =&gt; analytics.track('action_completed', result));
```

## See Also

- [tapError()](/api-task/tap-error)
- [map()](/api-task/map)