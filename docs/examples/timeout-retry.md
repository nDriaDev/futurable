# Timeout & Retry Patterns

Advanced timeout and retry patterns with Futurable.

## Timeout Pattern

```typescript
function withTimeout(futurable, ms) {
  const timeout = setTimeout(() => futurable.cancel(), ms);
  return futurable.finally(() => clearTimeout(timeout));
}

// Usage
const request = Futurable.fetch('/api/slow');
await withTimeout(request, 5000);
```

## Retry Pattern

```typescript
async function withRetry(fn, maxAttempts = 3, delay = 1000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxAttempts - 1) throw error;
      await Futurable.sleep(delay * (i + 1));
    }
  }
}

// Usage
const data = await withRetry(
  () => Futurable.fetch('/api/data').then(r => r.json()),
  3,
  1000
);
```

## Exponential Backoff

```typescript
async function fetchWithBackoff(url, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await Futurable.fetch(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      await Futurable.sleep(delay);
    }
  }
}
```

## See Also

- [Delays & Sleep](/guide/delays-and-sleep)
- [Examples Overview](/examples/)
