# Cancellation

Learn how to cancel async operations with Futurable.

## Why Cancellation Matters

In modern web applications, you often need to cancel async operations:

- User navigates away from a page
- Component unmounts before request completes
- User triggers a new search while previous one is pending
- Timeout exceeded
- Resource cleanup needed

Native Promises don't support cancellation, leading to:
- Memory leaks
- Unnecessary network traffic
- State updates on unmounted components
- Wasted CPU cycles

Futurable solves this with built-in cancellation support.

## Basic Cancellation

Every Futurable instance has a `cancel()` method:

```typescript
import { Futurable } from '@ndriadev/futurable';

const operation = new Futurable((resolve, reject, { signal }) => {
  const timeout = setTimeout(() => resolve('Done'), 5000);
  
  // Listen for cancellation
  signal.addEventListener('abort', () => {
    clearTimeout(timeout);
    reject(new Error('Cancelled'));
  });
});

// Cancel after 2 seconds
setTimeout(() => operation.cancel(), 2000);
```

## Cancellation in Chains

When you cancel a Futurable, the entire chain stops:

```typescript
const chain = Futurable
  .fetch('/api/data')
  .then(response => response.json())
  .then(data => processData(data))
  .then(result => saveToDatabase(result));

// Cancelling stops the entire chain
chain.cancel();
```

## React Integration

Perfect for React's useEffect cleanup:

```tsx
import { useEffect, useState } from 'react';
import { Futurable } from '@ndriadev/futurable';

function DataComponent({ userId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const request = Futurable
      .fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(setData);

    // Cleanup on unmount or userId change
    return () => request.cancel();
  }, [userId]);

  return <div>{data?.name}</div>;
}
```

## Cancellation Callbacks

Register cleanup logic with `onCancel`:

```typescript
const futurable = new Futurable((resolve, reject, { onCancel }) => {
  const ws = new WebSocket('wss://example.com');
  
  ws.onmessage = (event) => resolve(event.data);
  
  // Clean up on cancellation
  onCancel(() => {
    ws.close();
  });
});

futurable.cancel(); // WebSocket is closed
```

## External AbortSignal

You can pass an external AbortSignal:

```typescript
const controller = new AbortController();

const futurable = new Futurable(
  (resolve, reject) => {
    setTimeout(() => resolve('Done'), 1000);
  },
  controller.signal
);

// Cancel via external controller
controller.abort();
```

## Best Practices

### 1. Always Handle AbortError

```typescript
futurable
  .catch(error => {
    if (error.name === 'AbortError') {
      console.log('Operation was cancelled');
    } else {
      console.error('Operation failed:', error);
    }
  });
```

### 2. Clean Up Resources

```typescript
new Futurable((resolve, reject, { signal, onCancel }) => {
  const resources = allocate();
  
  onCancel(() => {
    resources.cleanup();
  });
  
  // Your async work
});
```

### 3. Idempotent Cancellation

Cancelling multiple times is safe:

```typescript
futurable.cancel();
futurable.cancel(); // No-op
futurable.cancel(); // No-op
```

## Common Patterns

### Timeout Pattern

```typescript
function withTimeout(futurable, ms) {
  const timeout = setTimeout(() => futurable.cancel(), ms);
  return futurable.finally(() => clearTimeout(timeout));
}

const operation = Futurable.fetch('/api/slow');
withTimeout(operation, 5000);
```

### Race with Manual Cancel

```typescript
const requests = [
  Futurable.fetch('/api/server1'),
  Futurable.fetch('/api/server2'),
  Futurable.fetch('/api/server3')
];

const winner = Futurable.race(requests);

winner.then(result => {
  // Cancel the losers
  requests.forEach(req => req !== winner && req.cancel());
});
```

### Debounced Requests

```typescript
let currentRequest = null;

function search(query) {
  // Cancel previous request
  currentRequest?.cancel();
  
  currentRequest = Futurable
    .fetch(`/api/search?q=${query}`)
    .then(r => r.json());
  
  return currentRequest;
}
```

## See Also

- [cancel()](/api/cancel) - Cancel method API
- [onCancel()](/api/on-cancel) - Register cancellation callbacks
- [Constructor](/api/constructor) - Creating cancellable operations
- [React Integration](/examples/react) - React examples
