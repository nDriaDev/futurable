# fallbackTo()

Provide a fallback value or task if this task fails.

## Syntax

```typescript
task.fallbackTo(fallback: T | FuturableTask&lt;T&gt; | (() =&gt; T | FuturableTask&lt;T&gt;)): FuturableTask&lt;T&gt;
```

## Parameters

### `fallback`

Can be one of:
- A direct value of type `T`
- A `FuturableTask&lt;T&gt;` to execute on failure
- A function returning `T` or `FuturableTask&lt;T&gt;`

## Return Value

A new `FuturableTask&lt;T&gt;` that falls back to the provided value/task on failure.

## Description

The `fallbackTo()` method provides a simple way to specify a fallback when a task fails. It's similar to `orElse()` but more flexible, accepting direct values, tasks, or factory functions.

## Examples

### Direct Value Fallback

```typescript
const task = FuturableTask
  .fetch('/api/data')
  .map(res =&gt; res.json())
  .fallbackTo({ default: 'data' });

const result = await task.run(); // Returns default on failure
```

### Task Fallback

```typescript
const primary = FuturableTask.fetch('/api/primary');
const backup = FuturableTask.fetch('/api/backup');

const task = primary.fallbackTo(backup);
const result = await task.run();
```

### Factory Function

```typescript
const task = FuturableTask
  .of(() =&gt; fetchFromAPI())
  .fallbackTo(() =&gt; {
    console.log('Primary failed, loading from cache');
    return loadFromCache();
  });
```

### Lazy Task Creation

```typescript
const task = FuturableTask
  .fetch('/api/data')
  .fallbackTo(() =&gt;
    FuturableTask.of(() =&gt; loadFromLocalStorage())
  );
```

## Use Cases

### Configuration Loading

```typescript
const loadConfig = FuturableTask
  .fetch('/api/config')
  .map(res =&gt; res.json())
  .fallbackTo({
    theme: 'light',
    language: 'en',
    notifications: true
  });
```

### User Data with Defaults

```typescript
const getUserPreferences = (userId: number) =&gt;
  FuturableTask
    .fetch(`/api/users/${userId}/preferences`)
    .map(res =&gt; res.json())
    .fallbackTo({
      theme: 'system',
      fontSize: 14,
      autoSave: true
    });
```

### Cascade Fallback Chain

```typescript
const getData = FuturableTask
  .fetch('/api/v3/data')
  .fallbackTo(() =&gt; FuturableTask.fetch('/api/v2/data'))
  .fallbackTo(() =&gt; FuturableTask.fetch('/api/v1/data'))
  .fallbackTo(() =&gt; loadFromCache())
  .fallbackTo(DEFAULT_DATA);
```

### Conditional Fallback

```typescript
const task = FuturableTask
  .of(() =&gt; fetchLiveData())
  .fallbackTo(() =&gt; {
    const cached = getFromCache();
    if (cached &amp;&amp; !isStale(cached)) {
      return cached;
    }
    return DEFAULT_DATA;
  });
```

## Comparison with Other Methods

### fallbackTo vs orElse

```typescript
// fallbackTo - accepts values, tasks, or functions
task.fallbackTo(DEFAULT_VALUE);
task.fallbackTo(backupTask);
task.fallbackTo(() =&gt; computeFallback());

// orElse - only accepts functions returning tasks
task.orElse(error =&gt; FuturableTask.resolve(DEFAULT_VALUE));
task.orElse(() =&gt; backupTask);
```

### fallbackTo vs recover

```typescript
// fallbackTo - doesn't receive error
task.fallbackTo(DEFAULT_VALUE);

// recover - receives error for inspection
task.recover(error =&gt; {
  console.log('Error:', error);
  return DEFAULT_VALUE;
});
```

## Advanced Examples

### Smart Caching

```typescript
const cache = new Map&lt;string, any&gt;();

const fetchWithCache = (key: string) =&gt;
  FuturableTask
    .fetch(`/api/data/${key}`)
    .map(res =&gt; res.json())
    .tap(data =&gt; cache.set(key, data))
    .fallbackTo(() =&gt; {
      const cached = cache.get(key);
      if (cached) {
        console.log('Using cached data');
        return cached;
      }
      throw new Error('No cache available');
    })
    .fallbackTo(EMPTY_DATA);
```

### Progressive Enhancement

```typescript
const loadFeature = FuturableTask
  .of(() =&gt; loadAdvancedFeature())
  .fallbackTo(() =&gt; {
    console.log('Advanced feature unavailable, loading basic');
    return loadBasicFeature();
  })
  .fallbackTo(() =&gt; {
    console.log('Basic feature unavailable, loading minimal');
    return loadMinimalFeature();
  });
```

### Environment-Based Fallback

```typescript
const getAPIEndpoint = FuturableTask
  .of(() =&gt; {
    if (process.env.NODE_ENV === 'production') {
      return fetchFromProdAPI();
    }
    throw new Error('Not production');
  })
  .fallbackTo(() =&gt; {
    if (process.env.NODE_ENV === 'staging') {
      return fetchFromStagingAPI();
    }
    throw new Error('Not staging');
  })
  .fallbackTo(() =&gt; fetchFromDevAPI());
```

### Retry with Fallback

```typescript
const resilientFetch = FuturableTask
  .fetch('/api/data')
  .retry(3, { delay: 1000 })
  .fallbackTo(() =&gt; {
    console.log('All retries failed, using backup');
    return FuturableTask.fetch('/api/backup');
  })
  .fallbackTo(CACHED_DATA);
```

## Type Safety

```typescript
interface Config {
  theme: string;
  lang: string;
}

const defaultConfig: Config = {
  theme: 'light',
  lang: 'en'
};

// ✅ Type-safe
const task = FuturableTask
  .fetch('/api/config')
  .map(res =&gt; res.json() as Config)
  .fallbackTo(defaultConfig);

// ❌ Type error
const wrong = FuturableTask
  .of(() =&gt; 42)
  .fallbackTo('string'); // Error: string not assignable to number
```

## Multiple Fallbacks

```typescript
const loadData = FuturableTask
  .fetch('/api/latest')
  .map(res =&gt; res.json())
  .fallbackTo(() =&gt; {
    console.log('Latest API failed, trying archive');
    return FuturableTask.fetch('/api/archive').map(r =&gt; r.json());
  })
  .fallbackTo(() =&gt; {
    console.log('Archive failed, trying cache');
    return loadFromCache();
  })
  .fallbackTo(() =&gt; {
    console.log('Cache empty, using defaults');
    return DEFAULT_DATA;
  });
```

## Best Practices

### 1. Use Direct Values for Simple Defaults

```typescript
// ✅ Good - simple default
.fallbackTo([])

// ❌ Overcomplicated
.fallbackTo(() =&gt; FuturableTask.resolve([]))
```

### 2. Use Functions for Computed Fallbacks

```typescript
// ✅ Good - computed on demand
.fallbackTo(() =&gt; computeExpensiveFallback())

// ❌ Bad - computed immediately
const fallback = computeExpensiveFallback();
task.fallbackTo(fallback);
```

### 3. Log Fallback Usage

```typescript
// ✅ Good - know when fallbacks are used
.fallbackTo(() =&gt; {
  console.log('Using fallback at', new Date());
  return DEFAULT_VALUE;
})
```

### 4. Provide Meaningful Defaults

```typescript
// ✅ Good - meaningful default
.fallbackTo({
  status: 'unavailable',
  message: 'Service temporarily down',
  retryAfter: 60
})

// ❌ Bad - empty/null
.fallbackTo(null)
```

## Performance Considerations

```typescript
// Lazy evaluation - only computed when needed
const task = FuturableTask
  .of(() =&gt; primarySource())
  .fallbackTo(() =&gt; {
    // This expensive computation only runs on failure
    return expensiveComputation();
  });

// Eager evaluation - computed immediately
const eagerFallback = expensiveComputation();
const task2 = FuturableTask
  .of(() =&gt; primarySource())
  .fallbackTo(eagerFallback); // Already computed
```

## Notes

- Fallback is only used if the task fails
- Direct values are wrapped in `FuturableTask.resolve()`
- Functions are called lazily (only on failure)
- Tasks are executed lazily (only on failure)
- Can be chained multiple times for cascade fallbacks
- Type-safe - fallback must match task type
- Does not receive error information (use `recover()` for that)

## See Also

- [orElse()](/api-task/or-else) - Alternative task on failure
- [retry()](/api-task/retry) - Automatic retries
- [Error Handling Guide](/guide-task/error-handling) - Error patterns