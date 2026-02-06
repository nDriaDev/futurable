# Constructor

Create a new Futurable instance.

## Syntax

```typescript
new Futurable<T>(executor: FuturableExecutor<T>, signal?: AbortSignal)
```

## Parameters

### `executor`

A function that is executed immediately by the Futurable constructor. It receives three parameters:

- **`resolve`**: Function to fulfill the futurable with a value
- **`reject`**: Function to reject the futurable with a reason
- **`utils`**: Object containing utility methods and the abort signal

```typescript
type FuturableExecutor<T> = (
  resolve: (value: T | FuturableLike<T> | PromiseLike<T>) => void,
  reject: (reason?: any) => void,
  utils: FuturableUtils<T>
) => void
```

### `signal` (optional)

An external `AbortSignal` to control the futurable's cancellation. If provided, the futurable will be cancelled when this signal is aborted.

## Return Value

A new `Futurable<T>` instance.

## Description

The `Futurable` constructor creates a new futurable object. The executor function is executed immediately by the constructor, before the Futurable object is returned.

The `utils` parameter provides several useful methods and properties:

| Property/Method | Type | Description |
|----------------|------|-------------|
| `signal` | `AbortSignal` | Internal abort signal for cancellation |
| `cancel` | `() => void` | Cancel the futurable |
| `onCancel` | `(cb: () => void) => void` | Register a cancellation callback |
| `sleep` | `(timer: number) => FuturableLike<void>` | Wait for specified milliseconds |
| `delay` | `<TResult>(cb: () => TResult, timer: number) => FuturableLike<TResult>` | Delay execution of a callback |
| `fetch` | `(url: string, opts?: RequestInit) => Futurable<Response>` | Make a cancellable fetch request |
| `futurizable` | `<TResult>(promise: Promise<TResult>) => Futurable<TResult>` | Convert a promise to futurable |

## Examples

### Basic Usage

```typescript
import { Futurable } from '@ndriadev/futurable';

const futurable = new Futurable((resolve, reject, { signal }) => {
  const timeoutId = setTimeout(() => {
    resolve('Operation completed!');
  }, 1000);

  signal.addEventListener('abort', () => {
    clearTimeout(timeoutId);
    reject(new Error('Operation cancelled'));
  });
});

// Use it
futurable.then(result => console.log(result));
```

### With External AbortSignal

```typescript
const controller = new AbortController();

const futurable = new Futurable(
  (resolve, reject) => {
    setTimeout(() => resolve('Done'), 1000);
  },
  controller.signal // External signal
);

// Cancel via external controller
controller.abort();
```

### Using Utils Methods

```typescript
const futurable = new Futurable(async (resolve, reject, { signal, sleep, fetch }) => {
  try {
    // Wait 1 second
    await sleep(1000);
    
    // Make a fetch request (automatically cancelled if futurable is cancelled)
    const response = await fetch('https://api.example.com/data');
    const data = await response.json();
    
    resolve(data);
  } catch (error) {
    reject(error);
  }
});

// Cancel everything
futurable.cancel();
```

### With Cleanup Logic

```typescript
const futurable = new Futurable((resolve, reject, { signal, onCancel }) => {
  const ws = new WebSocket('wss://example.com');
  
  ws.onmessage = (event) => {
    resolve(event.data);
  };
  
  ws.onerror = (error) => {
    reject(error);
  };
  
  // Register cleanup
  onCancel(() => {
    ws.close();
  });
});

// Cleanup is automatically called
futurable.cancel();
```

### Async Executor

```typescript
const futurable = new Futurable(async (resolve, reject, { signal }) => {
  try {
    const response = await fetch('https://api.example.com/data', { signal });
    const data = await response.json();
    resolve(data);
  } catch (error) {
    reject(error);
  }
});
```

### With Immediate Cancellation Check

```typescript
const futurable = new Futurable((resolve, reject, { signal }) => {
  // Check if already cancelled
  if (signal.aborted) {
    reject(new Error('Already cancelled'));
    return;
  }
  
  // Proceed with operation
  setTimeout(() => resolve('Done'), 1000);
});
```

## Common Patterns

### Resource Management

```typescript
function managedResource() {
  return new Futurable((resolve, reject, { onCancel }) => {
    const resource = allocateResource();
    
    // Register cleanup
    onCancel(() => {
      resource.cleanup();
    });
    
    resource.process()
      .then(resolve)
      .catch(reject);
  });
}
```

### Multiple Async Operations

```typescript
const futurable = new Futurable(async (resolve, reject, { signal }) => {
  try {
    const [users, posts] = await Promise.all([
      fetch('/api/users', { signal }).then(r => r.json()),
      fetch('/api/posts', { signal }).then(r => r.json())
    ]);
    
    resolve({ users, posts });
  } catch (error) {
    reject(error);
  }
});
```

### Conditional Resolution

```typescript
const futurable = new Futurable((resolve, reject, { signal }) => {
  const interval = setInterval(() => {
    if (signal.aborted) {
      clearInterval(interval);
      reject(new Error('Cancelled'));
      return;
    }
    
    const condition = checkCondition();
    if (condition) {
      clearInterval(interval);
      resolve('Condition met!');
    }
  }, 100);
});
```

## Type Parameters

### `T`

The type of value the futurable will resolve to.

```typescript
// Resolve with string
const stringFuturable = new Futurable<string>((resolve) => {
  resolve('hello');
});

// Resolve with object
interface User {
  id: number;
  name: string;
}

const userFuturable = new Futurable<User>((resolve) => {
  resolve({ id: 1, name: 'John' });
});

// Resolve with void
const voidFuturable = new Futurable<void>((resolve) => {
  resolve();
});
```

## Notes

- The executor function is called synchronously when the Futurable is created
- If the executor throws an error, the futurable is rejected with that error
- The `signal` parameter in utils is always available, even if no external signal is provided
- Multiple calls to `resolve` or `reject` have no effect after the first call
- The utils methods are bound to the futurable instance and can be safely destructured

## See Also

- [cancel()](/api/cancel) - Cancel the futurable
- [onCancel()](/api/on-cancel) - Register cancellation callbacks
- [Static Methods](/api/static-all) - Static futurable methods
- [Cancellation Guide](/guide/cancellation) - Learn about cancellation patterns
