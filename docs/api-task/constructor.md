# Constructor

Create a new FuturableTask instance.

## Syntax

```typescript
new FuturableTask&lt;T&gt;(
  executor: FuturableExecutor&lt;T&gt;,
  externalSignal?: AbortSignal
)
```

## Parameters

### `executor`

A function that defines the task's computation. Unlike Futurable, this function is **not executed until `.run()` is called**.

```typescript
type FuturableExecutor&lt;T&gt; = (
  resolve: (value: T | FuturableLike&lt;T&gt; | PromiseLike&lt;T&gt;) =&gt; void,
  reject: (reason?: any) =&gt; void,
  utils: FuturableUtils&lt;T&gt;
) =&gt; void
```

The executor receives three parameters:

- **`resolve`**: Function to fulfill the task with a value
- **`reject`**: Function to reject the task with a reason
- **`utils`**: Object containing utility methods and the abort signal

### `externalSignal` (optional)

An external `AbortSignal` to control the task's cancellation. If provided, the task will be cancelled when this signal is aborted.

## Return Value

A new `FuturableTask&lt;T&gt;` instance.

## Description

The `FuturableTask` constructor creates a lazy async computation. Unlike `Futurable`, creating a `FuturableTask` **does not execute** the executor function. Execution only happens when you call `.run()`.

### Key Characteristics

1. **Lazy Evaluation**: The executor is not called until `.run()` is invoked
2. **Reusable**: Can be run multiple times, each execution is independent
3. **Cancellable**: Can be cancelled before or during execution
4. **Composable**: Can be transformed and chained before execution

## Examples

### Basic Usage

```typescript
import { FuturableTask } from '@ndriadev/futurable';

// Creating the task doesn't execute it
const task = new FuturableTask((resolve, reject) =&gt; {
  console.log('Executing!');
  setTimeout(() =&gt; resolve('Done!'), 1000);
});
// Nothing logged yet

// Execute when ready
const result = await task.run(); // Logs: "Executing!"
console.log(result); // "Done!"
```

### With Cancellation Support

```typescript
const task = new FuturableTask((resolve, reject, { signal, onCancel }) =&gt; {
  const timeoutId = setTimeout(() =&gt; {
    resolve('Completed');
  }, 5000);

  // Register cleanup
  onCancel(() =&gt; {
    console.log('Cleaning up...');
    clearTimeout(timeoutId);
  });

  // Or use signal directly
  signal.addEventListener('abort', () =&gt; {
    clearTimeout(timeoutId);
    reject(new Error('Cancelled'));
  });
});

// Cancel before running
task.cancel();
await task.run(); // Won't execute

// Or cancel during execution
const execution = task.run();
setTimeout(() =&gt; task.cancel(), 1000);
```

### With External AbortSignal

```typescript
const controller = new AbortController();

const task = new FuturableTask(
  (resolve, reject) =&gt; {
    setTimeout(() =&gt; resolve('Done'), 1000);
  },
  controller.signal // External signal
);

// Cancel via external controller
controller.abort();
```

### Async Executor

```typescript
const task = new FuturableTask(async (resolve, reject, { signal }) =&gt; {
  try {
    const response = await fetch('https://api.example.com/data', { signal });
    const data = await response.json();
    resolve(data);
  } catch (error) {
    reject(error);
  }
});
```

### Using Utils Methods

```typescript
const task = new FuturableTask(async (resolve, reject, utils) =&gt; {
  try {
    // Wait 1 second
    await utils.sleep(1000);

    // Make a fetch request (automatically cancelled if task is cancelled)
    const response = await utils.fetch('https://api.example.com/data');
    const data = await response.json();

    resolve(data);
  } catch (error) {
    reject(error);
  }
});
```

### With Cleanup Logic

```typescript
const task = new FuturableTask((resolve, reject, { onCancel }) =&gt; {
  const ws = new WebSocket('wss://example.com');

  ws.onmessage = (event) =&gt; {
    resolve(event.data);
  };

  ws.onerror = (error) =&gt; {
    reject(error);
  };

  // Cleanup is called on cancellation
  onCancel(() =&gt; {
    ws.close();
  });
});

// Cleanup runs when cancelled
task.cancel();
```

## Alternative Constructors

### FuturableTask.of()

Create a task from a function (recommended):

```typescript
const task = FuturableTask.of(() =&gt; {
  return expensiveOperation();
});

// With async function
const asyncTask = FuturableTask.of(async () =&gt; {
  const res = await fetch('/api/data');
  return res.json();
});
```

### FuturableTask.resolve()

Create an immediately successful task:

```typescript
const task = FuturableTask.resolve(42);
await task.run(); // 42
```

### FuturableTask.reject()

Create an immediately failed task:

```typescript
const task = FuturableTask.reject(new Error('Failed'));
await task.run(); // Throws Error
```

### FuturableTask.from()

Convert a Futurable to a FuturableTask:

```typescript
const futurable = Futurable.fetch('/api/data');
const task = FuturableTask.from(futurable);
```

## Common Patterns

### Resource Management

```typescript
function managedResource() {
  return new FuturableTask((resolve, reject, { onCancel }) =&gt; {
    const resource = allocateResource();

    // Register cleanup
    onCancel(() =&gt; {
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
const task = new FuturableTask(async (resolve, reject, { signal }) =&gt; {
  try {
    const [users, posts] = await Promise.all([
      fetch('/api/users', { signal }).then(r =&gt; r.json()),
      fetch('/api/posts', { signal }).then(r =&gt; r.json())
    ]);

    resolve({ users, posts });
  } catch (error) {
    reject(error);
  }
});
```

### Conditional Execution

```typescript
const task = new FuturableTask((resolve, reject, { signal }) =&gt; {
  const interval = setInterval(() =&gt; {
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

### Progress Tracking

```typescript
const task = new FuturableTask(async (resolve, reject, { signal }) =&gt; {
  const steps = [step1, step2, step3, step4];

  for (let i = 0; i &lt; steps.length; i++) {
    if (signal.aborted) {
      reject(new Error('Cancelled'));
      return;
    }

    updateProgress((i + 1) / steps.length * 100);
    await steps[i]();
  }

  resolve('Complete');
});
```

## Type Parameters

### `T`

The type of value the task will resolve to.

```typescript
// Resolve with string
const stringTask = new FuturableTask&lt;string&gt;((resolve) =&gt; {
  resolve('hello');
});

// Resolve with object
interface User {
  id: number;
  name: string;
}

const userTask = new FuturableTask&lt;User&gt;((resolve) =&gt; {
  resolve({ id: 1, name: 'John' });
});

// Resolve with void
const voidTask = new FuturableTask&lt;void&gt;((resolve) =&gt; {
  resolve();
});
```

## Comparison with Futurable Constructor

| Feature | FuturableTask | Futurable |
|---------|---------------|-----------|
| Execution | Lazy (on `.run()`) | Eager (immediate) |
| Reusability | Multiple runs | Single use |
| Base | Independent class | Extends Promise |
| Use case | Composition &amp; reuse | Promise replacement |

```typescript
// Futurable: Executes immediately
const futurable = new Futurable((resolve) =&gt; {
  console.log('Executing now!'); // Logs immediately
  resolve(42);
});

// FuturableTask: Lazy execution
const task = new FuturableTask((resolve) =&gt; {
  console.log('Executing now!'); // Nothing logged
  resolve(42);
});
await task.run(); // Logs: "Executing now!"
```

## Notes

- The executor function is **not called** when the task is created
- Execution only happens when `.run()` is called
- Each call to `.run()` creates a new independent execution
- The `signal` parameter in utils is always available
- Multiple calls to `resolve` or `reject` have no effect after the first call
- The utils methods are bound to the task instance

## See Also

- [run()](/api-task/run) - Execute the task
- [cancel()](/api-task/cancel) - Cancel the task
- [onCancel()](/api-task/on-cancel) - Register cancellation callbacks
- [FuturableTask.of()](/api-task/of) - Alternative constructor
- [Introduction](/guide-task/introduction) - Learn about FuturableTask
