# memoize()

Cache the result of the first execution and reuse it for subsequent runs.

## Syntax

```typescript
task.memoize(catchErrors?: boolean): FuturableTask&lt;T&gt;
```

## Parameters

### `catchErrors` (optional)

- `false` (default): Only cache successful results
- `true`: Cache both success and error results

## Return Value

A new `FuturableTask&lt;T&gt;` that caches its result.

## Description

The `memoize()` method caches the result of the first execution. Subsequent calls to `run()` will return the cached result without re-executing the task.

This is useful for expensive operations that should only execute once.

## Examples

### Basic Memoization

```typescript
let counter = 0;

const task = FuturableTask
  .of(() =&gt; {
    console.log('Computing...');
    return ++counter;
  })
  .memoize();

await task.run(); // Logs: "Computing...", returns 1
await task.run(); // Returns 1 (cached, no log)
await task.run(); // Returns 1 (cached, no log)
```

### Expensive API Call

```typescript
const fetchConfig = FuturableTask
  .fetch('/api/config')
  .map(res =&gt; res.json())
  .memoize();

// First call - fetches from API
const config1 = await fetchConfig.run();

// Subsequent calls - use cached result
const config2 = await fetchConfig.run();
const config3 = await fetchConfig.run();
```

### Caching Errors

```typescript
let attempts = 0;

const unstableTask = FuturableTask
  .of(() =&gt; {
    attempts++;
    if (attempts === 1) {
      throw new Error('First attempt failed');
    }
    return 'success';
  })
  .memoize(false); // Don't cache errors

try {
  await unstableTask.run(); // Fails
} catch (error) {
  console.log('First attempt failed');
}

const result = await unstableTask.run(); // Tries again, succeeds
```

### Caching Both Success and Errors

```typescript
const task = FuturableTask
  .of(() =&gt; {
    throw new Error('Always fails');
  })
  .memoize(true); // Cache errors too

try {
  await task.run(); // Fails and caches the error
} catch (error) {
  console.log('Failed:', error);
}

try {
  await task.run(); // Returns cached error
} catch (error) {
  console.log('Cached error:', error);
}
```

## Use Cases

### Configuration Loading

```typescript
const loadAppConfig = FuturableTask
  .of(async () =&gt; {
    console.log('Loading configuration...');
    const res = await fetch('/api/config');
    return res.json();
  })
  .memoize();

// Use throughout your app
const config = await loadAppConfig.run();
```

### Reference Data

```typescript
const getCountries = FuturableTask
  .of(() =&gt; fetch('/api/countries'))
  .map(res =&gt; res.json())
  .memoize();

const getLanguages = FuturableTask
  .of(() =&gt; fetch('/api/languages'))
  .map(res =&gt; res.json())
  .memoize();

// These only fetch once
const countries = await getCountries.run();
const languages = await getLanguages.run();
```

### Expensive Computation

```typescript
const computeStatistics = FuturableTask
  .of(() =&gt; {
    console.log('Computing statistics...');
    // Complex, time-consuming calculations
    return analyzeData(largeDataset);
  })
  .memoize();

// First call computes
const stats1 = await computeStatistics.run();

// Subsequent calls are instant
const stats2 = await computeStatistics.run();
```

### Singleton Pattern

```typescript
class DatabaseConnection {
  static connect = FuturableTask
    .of(async () =&gt; {
      console.log('Connecting to database...');
      return await createConnection();
    })
    .memoize();
}

// Only connects once
const conn1 = await DatabaseConnection.connect.run();
const conn2 = await DatabaseConnection.connect.run(); // Same instance
```

## Behavior Details

### Caching Success Only (default)

```typescript
let attempts = 0;

const task = FuturableTask
  .of(() =&gt; {
    attempts++;
    if (attempts &lt; 3) {
      throw new Error('Failed');
    }
    return 'success';
  })
  .memoize(); // catchErrors = false

try {
  await task.run(); // Fails, not cached
} catch {}

try {
  await task.run(); // Fails, not cached
} catch {}

const result = await task.run(); // Succeeds, cached
const result2 = await task.run(); // Returns cached success
```

### Caching Everything

```typescript
const task = FuturableTask
  .of(() =&gt; {
    throw new Error('Error');
  })
  .memoize(true); // Cache errors

try {
  await task.run(); // Fails, error is cached
} catch {}

try {
  await task.run(); // Returns cached error immediately
} catch {}
```

## Comparison with Non-Memoized

```typescript
// Without memoization
const nonMemoized = FuturableTask.of(() =&gt; {
  console.log('Executing');
  return expensiveOperation();
});

await nonMemoized.run(); // Logs: "Executing"
await nonMemoized.run(); // Logs: "Executing" again
await nonMemoized.run(); // Logs: "Executing" again

// With memoization
const memoized = FuturableTask.of(() =&gt; {
  console.log('Executing');
  return expensiveOperation();
}).memoize();

await memoized.run(); // Logs: "Executing"
await memoized.run(); // No log (cached)
await memoized.run(); // No log (cached)
```

## Performance Benefits

```typescript
// Slow operation without memoization
const slow = FuturableTask.of(() =&gt; {
  let sum = 0;
  for (let i = 0; i &lt; 1000000000; i++) {
    sum += i;
  }
  return sum;
});

console.time('Run 1');
await slow.run();
console.timeEnd('Run 1'); // ~500ms

console.time('Run 2');
await slow.run();
console.timeEnd('Run 2'); // ~500ms again

// Fast with memoization
const fast = slow.memoize();

console.time('First');
await fast.run();
console.timeEnd('First'); // ~500ms

console.time('Second');
await fast.run();
console.timeEnd('Second'); // &lt;1ms (cached)
```

## Best Practices

### 1. Memoize Pure Operations

```typescript
// ✅ Good - deterministic result
const getPiValue = FuturableTask
  .of(() =&gt; Math.PI)
  .memoize();

// ❌ Bad - non-deterministic
const getCurrentTime = FuturableTask
  .of(() =&gt; Date.now())
  .memoize(); // Will always return first timestamp
```

### 2. Memoize Expensive Operations

```typescript
// ✅ Good - expensive to compute
const parseHugeFile = FuturableTask
  .of(() =&gt; parseJSON(hugeFile))
  .memoize();

// ❌ Bad - cheap operation
const addNumbers = FuturableTask
  .of(() =&gt; 1 + 2)
  .memoize(); // Overhead not worth it
```

### 3. Consider Memory Usage

```typescript
// ✅ Good - small result
const getConfig = FuturableTask
  .of(() =&gt; loadConfig())
  .memoize();

// ⚠️ Careful - large result stays in memory
const loadEntireDatabase = FuturableTask
  .of(() =&gt; fetchAllRecords())
  .memoize(); // May cause memory issues
```

### 4. Cache Errors Selectively

```typescript
// ✅ Good - don't cache transient errors
const fetchData = FuturableTask
  .fetch('/api/data')
  .memoize(false); // Retry on network errors

// ✅ Good - cache validation errors
const validateInput = FuturableTask
  .of(() =&gt; validate(input))
  .memoize(true); // Input won't change
```

## Notes

- Caching happens on first successful execution (or first execution if `catchErrors: true`)
- Cached value persists for the lifetime of the task instance
- Each task instance has its own cache
- No way to invalidate/clear the cache
- Memory is held until task is garbage collected
- Works with all other FuturableTask methods

## See Also

- [run()](/api-task/run) - Execute the task
- [of()](/api-task/of) - Create tasks
- [Concurrency Guide](/guide-task/concurrency) - Caching strategies
