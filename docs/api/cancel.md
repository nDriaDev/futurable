# cancel()

Cancel the futurable operation.

## Syntax

```typescript
futurable.cancel(): void
```

## Parameters

None.

## Return Value

`void` - This method doesn't return anything.

## Description

The `cancel()` method aborts the futurable operation. When called:

1. The internal `AbortSignal` is triggered
2. All registered `onCancel` callbacks are executed
3. Any ongoing async operations should be cleaned up
4. The futurable is rejected with an `AbortError` (if not already settled)

Calling `cancel()` on an already settled (fulfilled or rejected) futurable has no effect.

## Examples

### Basic Cancellation

```typescript
import { Futurable } from '@ndriadev/futurable';

const futurable = new Futurable((resolve, reject, { signal }) => {
  const timeout = setTimeout(() => resolve('Done'), 5000);
  
  signal.addEventListener('abort', () => {
    clearTimeout(timeout);
    reject(new Error('Operation cancelled'));
  });
});

// Cancel after 2 seconds
setTimeout(() => futurable.cancel(), 2000);

futurable
  .then(result => console.log('Success:', result))
  .catch(error => console.log('Error:', error.message)); // "Operation cancelled"
```

### Cancel Fetch Request

```typescript
const request = Futurable.fetch('https://api.example.com/large-file');

// Start download
request
  .then(response => response.blob())
  .then(blob => console.log('Downloaded:', blob.size))
  .catch(error => {
    if (error.name === 'AbortError') {
      console.log('Download cancelled');
    }
  });

// Cancel after 3 seconds
setTimeout(() => request.cancel(), 3000);
```

### Cancel in Promise Chain

```typescript
const operation = Futurable
  .fetch('/api/users')
  .then(response => response.json())
  .then(users => {
    console.log('Processing users...');
    return users.map(u => u.name);
  });

// Cancelling works anywhere in the chain
operation.cancel();

// The fetch will be aborted, preventing .then callbacks from running
```

### Multiple Operations

```typescript
const operation1 = Futurable.fetch('/api/data1');
const operation2 = Futurable.fetch('/api/data2');
const operation3 = Futurable.fetch('/api/data3');

// Cancel all
operation1.cancel();
operation2.cancel();
operation3.cancel();
```

### Cancel with Futurable.all

```typescript
const allOperations = Futurable.all([
  Futurable.fetch('/api/users'),
  Futurable.fetch('/api/posts'),
  Futurable.fetch('/api/comments')
]);

// Cancelling the combined futurable cancels all sub-operations
allOperations.cancel();
```

### Cancel with Polling

```typescript
const polling = Futurable.polling(
  () => Futurable.fetch('/api/status').then(r => r.json()),
  5000 // Poll every 5 seconds
);

// Stop polling after 30 seconds
setTimeout(() => polling.cancel(), 30000);
```

## Common Patterns

### Cleanup Pattern

```typescript
const futurable = new Futurable((resolve, reject, { signal }) => {
  const resources = allocateResources();
  
  signal.addEventListener('abort', () => {
    // Clean up resources when cancelled
    resources.cleanup();
  });
  
  // Async work
  doWork(resources)
    .then(resolve)
    .catch(reject);
});

// Later
futurable.cancel(); // Resources are cleaned up
```

### User Cancellation

```typescript
// User can cancel long operation
function downloadFile(url, onProgress) {
  const download = Futurable
    .fetch(url)
    .then(response => {
      const reader = response.body.getReader();
      // Process stream...
    });
  
  // Return cancel function
  return {
    promise: download,
    cancel: () => download.cancel()
  };
}

// Usage
const { promise, cancel } = downloadFile('https://example.com/file.zip');

// Show cancel button to user
document.getElementById('cancel-btn').onclick = cancel;
```

### Timeout Pattern

```typescript
function withTimeout(futurable, timeoutMs) {
  const timeout = setTimeout(() => {
    futurable.cancel();
  }, timeoutMs);
  
  return futurable.finally(() => clearTimeout(timeout));
}

// Usage
const operation = Futurable.fetch('/api/slow-endpoint');
const withTimeout = withTimeout(operation, 5000);

withTimeout
  .then(result => console.log('Success:', result))
  .catch(error => {
    if (error.name === 'AbortError') {
      console.log('Operation timed out');
    }
  });
```

### React Cleanup

```jsx
import { useEffect } from 'react';
import { Futurable } from '@ndriadev/futurable';

function Component() {
  useEffect(() => {
    const request = Futurable
      .fetch('/api/data')
      .then(r => r.json())
      .then(setData);
    
    // Cancel on unmount
    return () => request.cancel();
  }, []);
  
  return <div>Component</div>;
}
```

## Notes

### Idempotent Operation

Calling `cancel()` multiple times is safe and has no additional effect:

```typescript
const futurable = Futurable.sleep(1000);

futurable.cancel(); // Cancels
futurable.cancel(); // No-op
futurable.cancel(); // No-op
```

### Already Settled

Cancelling a settled futurable has no effect:

```typescript
const futurable = Futurable.resolve('value');

futurable.cancel(); // No effect, already resolved

await futurable; // Still resolves to 'value'
```

### Synchronous

The `cancel()` method is synchronous - it returns immediately:

```typescript
const futurable = Futurable.sleep(1000);

console.log('Before cancel');
futurable.cancel();
console.log('After cancel'); // Executes immediately
```

### Error Type

When a futurable is cancelled, it's typically rejected with an error that has:
- `name: 'AbortError'` (for fetch operations)
- Or a custom error message

```typescript
futurable
  .catch(error => {
    console.log(error.name); // 'AbortError' or similar
    console.log(error.message); // Error message
  });
```

## See Also

- [onCancel()](/api/on-cancel) - Register cancellation callbacks
- [Constructor](/api/constructor) - Creating cancellable operations
- [Cancellation Guide](/guide/cancellation) - Learn about cancellation patterns
- [Futurable.all()](/api/static-all) - Cancel multiple operations
- [fetch()](/api/fetch) - Cancellable fetch requests
