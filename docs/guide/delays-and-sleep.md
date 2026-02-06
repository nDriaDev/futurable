# Delays & Sleep

Add timing control to your async operations with Futurable's delay and sleep utilities.

## Sleep

The `sleep()` method pauses execution for a specified time:

### Instance Method

```typescript
import { Futurable } from '@ndriadev/futurable';

const futurable = new Futurable((resolve) => {
  resolve('initial value');
});

// Sleep for 2 seconds, then continue
await futurable.sleep(2000);
console.log('2 seconds passed');
```

### Static Method

```typescript
// Simple sleep
await Futurable.sleep(1000);
console.log('Slept for 1 second');

// With cancellation
const sleep = Futurable.sleep(5000);
setTimeout(() => sleep.cancel(), 2000); // Cancel after 2 seconds
```

## Delay

The `delay()` method waits, then executes a callback:

### Instance Method

```typescript
const result = await new Futurable((resolve) => {
  resolve('initial');
}).delay(() => 'delayed value', 2000);

console.log(result); // 'delayed value' after 2 seconds
```

### Static Method

```typescript
const result = await Futurable.delay(
  () => 'computed value',
  1000
);

console.log(result); // 'computed value' after 1 second
```

## Use Cases

### Debouncing

```typescript
function debounceSearch(query) {
  return Futurable.sleep(300).then(() => {
    return fetch(`/api/search?q=${query}`);
  });
}

// Usage
debounceSearch('react').then(results => console.log(results));
```

### Retry with Backoff

```typescript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await Futurable.fetch(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await Futurable.sleep(delay);
    }
  }
}

// Usage
const data = await fetchWithRetry('/api/unreliable');
```

### Polling with Delay

```typescript
async function pollUntilReady(url) {
  while (true) {
    const response = await Futurable.fetch(url);
    const data = await response.json();
    
    if (data.ready) {
      return data;
    }
    
    // Wait before next poll
    await Futurable.sleep(2000);
  }
}
```

### Simulated Loading

```typescript
function fakeApiCall() {
  return Futurable
    .sleep(1500)
    .then(() => ({ success: true, data: [...] }));
}

// Usage in React
function Component() {
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const request = fakeApiCall().then(data => {
      setData(data);
      setLoading(false);
    });
    
    return () => request.cancel();
  }, []);
}
```

### Throttling

```typescript
class ThrottledFetcher {
  private lastCall = 0;
  private minInterval = 1000; // 1 second

  async fetch(url) {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCall;
    
    if (timeSinceLastCall < this.minInterval) {
      await Futurable.sleep(this.minInterval - timeSinceLastCall);
    }
    
    this.lastCall = Date.now();
    return Futurable.fetch(url);
  }
}
```

## Cancellable Sleep

Sleep operations are fully cancellable:

```typescript
const sleep = Futurable.sleep(10000);

// Cancel after 2 seconds
setTimeout(() => sleep.cancel(), 2000);

try {
  await sleep;
} catch (error) {
  console.log('Sleep was cancelled');
}
```

## Delay vs Sleep

| Feature | sleep() | delay() |
|---------|---------|---------|
| **Purpose** | Just wait | Wait then execute |
| **Callback** | No | Yes |
| **Return value** | void | Callback result |
| **Use case** | Pausing | Transforming |

## Best Practices

### 1. Use Sleep for Pauses

```typescript
// ✅ Good
await Futurable.sleep(1000);
doSomething();

// ❌ Avoid
await Futurable.delay(() => {}, 1000);
doSomething();
```

### 2. Use Delay for Transformations

```typescript
// ✅ Good
const result = await futurable.delay(() => transform(data), 500);

// ❌ Avoid
await futurable.sleep(500);
const result = transform(data);
```

### 3. Cancel Long Sleeps

```typescript
// ✅ Good - cancellable
const sleep = Futurable.sleep(60000);
cleanup(() => sleep.cancel());

// ❌ Risky - no cancellation
await Futurable.sleep(60000);
```

## Advanced Patterns

### Progressive Delay

```typescript
async function progressiveRetry(fn, attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === attempts - 1) throw error;
      
      // Fibonacci backoff: 1s, 1s, 2s, 3s, 5s...
      const delays = [1000, 1000, 2000, 3000, 5000];
      await Futurable.sleep(delays[i]);
    }
  }
}
```

### Conditional Delay

```typescript
async function delayIf(condition, ms) {
  if (condition) {
    await Futurable.sleep(ms);
  }
}

// Usage
const isDevelopment = process.env.NODE_ENV === 'development';
await delayIf(isDevelopment, 1000); // Simulate network delay in dev
```

### Minimum Duration

```typescript
async function withMinimumDuration(promise, minMs) {
  const [result] = await Promise.all([
    promise,
    Futurable.sleep(minMs)
  ]);
  return result;
}

// Ensure loading shows for at least 500ms
const data = await withMinimumDuration(
  fetchData(),
  500
);
```

## See Also

- [sleep()](/api/sleep) - Sleep method API
- [delay()](/api/delay) - Delay method API
- [Futurable.sleep()](/api/static-sleep) - Static sleep
- [Futurable.delay()](/api/static-delay) - Static delay
