# flatMap()

Transform the result to another task and flatten the result.

## Syntax

```typescript
task.flatMap&lt;U&gt;(fn: (value: T) =&gt; FuturableTask&lt;U&gt;): FuturableTask&lt;U&gt;
```

## Parameters

### `fn`

A function that takes the task's result and returns a new FuturableTask.

## Return Value

A new `FuturableTask&lt;U&gt;` with the flattened result.

## Description

The `flatMap()` method (also known as `chain()`) is used when your transformation function returns a FuturableTask instead of a plain value. It automatically flattens the nested task structure.

## Examples

### Basic Usage

```typescript
const task = FuturableTask
  .of(() =&gt; 5)
  .flatMap(x =&gt; FuturableTask.of(() =&gt; x * 2));

await task.run(); // 10
```

### Sequential API Calls

```typescript
const getUserPosts = FuturableTask
  .fetch('/api/current-user')
  .map(res =&gt; res.json())
  .flatMap(user =&gt;
    FuturableTask.fetch(`/api/users/${user.id}/posts`)
      .map(res =&gt; res.json())
  );
```

### Dependent Operations

```typescript
const workflow = FuturableTask
  .of(() =&gt; validateInput(data))
  .flatMap(validated =&gt;
    FuturableTask.of(() =&gt; processData(validated))
  )
  .flatMap(processed =&gt;
    FuturableTask.of(() =&gt; saveToDatabase(processed))
  );
```

### Conditional Task Execution

```typescript
const task = FuturableTask
  .of(() =&gt; checkCache(key))
  .flatMap(cached =&gt;
    cached
      ? FuturableTask.resolve(cached)
      : FuturableTask.fetch(`/api/data/${key}`)
          .map(res =&gt; res.json())
  );
```

### Error Handling Chain

```typescript
const resilient = FuturableTask
  .fetch('/api/primary')
  .map(res =&gt; res.json())
  .flatMap(data =&gt; {
    if (data.needsEnrichment) {
      return FuturableTask.fetch('/api/enrich')
        .map(res =&gt; res.json())
        .map(enrichment =&gt; ({ ...data, ...enrichment }));
    }
    return FuturableTask.resolve(data);
  });
```

## When to Use

Use `flatMap()` when:
- The transformation returns a FuturableTask
- You need sequential dependent operations
- Conditional task execution based on previous results

Use `map()` when:
- The transformation returns a plain value
- Simple data transformations

## Comparison

```typescript
// ❌ Wrong - creates nested task
const wrong = FuturableTask
  .of(() =&gt; 5)
  .map(x =&gt; FuturableTask.of(() =&gt; x * 2));
// Type: FuturableTask&lt;FuturableTask&lt;number&gt;&gt;

// ✅ Correct - flattens automatically
const correct = FuturableTask
  .of(() =&gt; 5)
  .flatMap(x =&gt; FuturableTask.of(() =&gt; x * 2));
// Type: FuturableTask&lt;number&gt;
```

## See Also

- [map()](/api-task/map) - Transform values
- [Composition Guide](/guide-task/composition)