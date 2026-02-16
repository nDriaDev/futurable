# FuturableTask.traverse()

Map an array of values to tasks and execute them sequentially.

## Syntax

```typescript
FuturableTask.traverse&lt;T, U&gt;(
  values: T[],
  fn: (value: T, index: number) =&gt; FuturableTask&lt;U&gt;,
  signal?: AbortSignal
): FuturableTask&lt;U[]&gt;
```

## Parameters

### `values`
Array of values to map over.

### `fn`
Function that maps each value to a FuturableTask. Receives the value and its index.

### `signal` (optional)
AbortSignal for cancellation.

## Return Value

A `FuturableTask&lt;U[]&gt;` that resolves with an array of all results.

## Description

Combines mapping and sequential execution. Takes an array of values, applies a function to each to create a task, then executes all tasks sequentially.

## Examples

### Fetch Users by ID

```typescript
const userIds = [1, 2, 3, 4, 5];

const users = await FuturableTask
  .traverse(
    userIds,
    id =&gt; FuturableTask.fetch(`/api/users/${id}`)
      .map(res =&gt; res.json())
  )
  .run();
```

### Process Files

```typescript
const filePaths = ['file1.txt', 'file2.txt', 'file3.txt'];

const contents = await FuturableTask
  .traverse(
    filePaths,
    path =&gt; FuturableTask.of(() =&gt; readFile(path))
  )
  .run();
```

### With Index

```typescript
const items = ['a', 'b', 'c'];

const results = await FuturableTask
  .traverse(
    items,
    (item, index) =&gt; FuturableTask.of(() =&gt; `${index}: ${item}`)
  )
  .run();
// ['0: a', '1: b', '2: c']
```

### Transform and Save

```typescript
const data = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' }
];

await FuturableTask
  .traverse(
    data,
    item =&gt; FuturableTask.of(async () =&gt; {
      const transformed = transformItem(item);
      await saveToDatabase(transformed);
      return transformed;
    })
  )
  .run();
```

### With Rate Limiting

```typescript
const limiter = FuturableTask.createLimiter(3);

const results = await FuturableTask
  .traverse(
    urls,
    url =&gt; limiter(
      FuturableTask.fetch(url).map(r =&gt; r.json())
    )
  )
  .run();
```

## Comparison with sequence()

```typescript
// traverse - create tasks from values
const result1 = await FuturableTask.traverse(
  [1, 2, 3],
  n =&gt; FuturableTask.of(() =&gt; n * 2)
).run();

// sequence - execute existing tasks
const tasks = [1, 2, 3].map(n =&gt;
  FuturableTask.of(() =&gt; n * 2)
);
const result2 = await FuturableTask.sequence(tasks).run();

// Both produce [2, 4, 6]
```

## See Also

- [sequence()](/api-task/sequence) - Execute tasks sequentially
- [parallel()](/api-task/parallel) - Execute tasks in parallel
- [map()](/api-task/map) - Transform task values