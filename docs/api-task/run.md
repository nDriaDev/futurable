# run()

Execute the task and return a Futurable.

## Syntax

```typescript
task.run(signal?: AbortSignal): Futurable&lt;T&gt;
```

## Parameters

### `signal` (optional)

An external `AbortSignal` that can cancel this specific execution. This is combined with the task's internal signal.

## Return Value

A `Futurable&lt;T&gt;` that resolves with the task's result or rejects with an error.

## Description

The `run()` method executes the task's computation and returns a `Futurable`. This is where the actual work happens - creating a task is lazy, but calling `run()` triggers execution.

### Key Behaviors

- **Lazy Execution**: The task only executes when `run()` is called
- **Multiple Runs**: Each call to `run()` is an independent execution
- **Cancellable**: The returned Futurable can be cancelled
- **Signal Chaining**: External signals are combined with the task's signal
- **Memoization**: If enabled, subsequent runs return cached results

## Examples

### Basic Usage

```typescript
const task = FuturableTask.of(() =&gt; {
  console.log('Executing...');
  return 42;
});

// First run
const result1 = await task.run(); // Logs: "Executing..."
console.log(result1); // 42

// Second run (independent)
const result2 = await task.run(); // Logs: "Executing..." again
console.log(result2); // 42
```

### With External Signal

```typescript
const task = FuturableTask.of(() =&gt; longOperation());

const controller = new AbortController();

// Run with external signal
const execution = task.run(controller.signal);

// Cancel this specific execution
setTimeout(() =&gt; controller.abort(), 1000);

try {
  await execution;
} catch (error) {
  console.log('Execution cancelled');
}
```

### Multiple Independent Executions

```typescript
let counter = 0;

const task = FuturableTask.of(() =&gt; {
  return ++counter;
});

// Run multiple times
const run1 = task.run();
const run2 = task.run();
const run3 = task.run();

const results = await Promise.all([run1, run2, run3]);
console.log(results); // [1, 2, 3] - each is independent
```

### With Cancellation

```typescript
const task = FuturableTask.of(() =&gt; {
  console.log('Starting...');
  return new Promise(resolve =&gt; {
    setTimeout(() =&gt; resolve('Done'), 5000);
  });
}).onCancel(() =&gt; {
  console.log('Cleanup!');
});

const execution = task.run();

// Cancel the execution
setTimeout(() =&gt; {
  execution.cancel(); // Logs: "Cleanup!"
}, 1000);
```

### Checking Task Cancellation

```typescript
const task = FuturableTask.of(() =&gt; slowOperation());

// Cancel the task itself
task.cancel();

// This execution won't start
const execution = task.run();

// The execution will be in a pending state
// (won't resolve or reject)
```

### With Memoization

```typescript
let executionCount = 0;

const task = FuturableTask.of(() =&gt; {
  executionCount++;
  console.log(`Execution ${executionCount}`);
  return expensiveOperation();
}).memoize();

await task.run(); // Logs: "Execution 1"
await task.run(); // Returns cached result, no log
await task.run(); // Returns cached result, no log

console.log(executionCount); // 1
```

## Working with the Returned Futurable

### Chaining

```typescript
const task = FuturableTask.of(() =&gt; fetch('/api/data'));

const result = await task
  .run()
  .then(res =&gt; res.json())
  .then(data =&gt; processData(data));
```

### Cancelling the Execution

```typescript
const execution = task.run();

// Cancel this specific execution
execution.cancel();

// Or with onCancel
execution.onCancel(() =&gt; {
  console.log('Execution cancelled');
});
```

### Error Handling

```typescript
const task = FuturableTask.of(() =&gt; riskyOperation());

try {
  const result = await task.run();
  console.log('Success:', result);
} catch (error) {
  console.error('Failed:', error);
}
```

## Execution Lifecycle

### 1. Pre-Execution Checks

```typescript
const task = FuturableTask.of(() =&gt; work());

// If task is cancelled before run()
task.cancel();

const execution = task.run();
// Execution enters pending state, never starts
```

### 2. During Execution

```typescript
const task = FuturableTask.of((resolve, reject, { signal }) =&gt; {
  const interval = setInterval(() =&gt; {
    if (signal.aborted) {
      clearInterval(interval);
      return; // Stop work
    }
    doWork();
  }, 100);
});

const execution = task.run();

// Cancel during execution
setTimeout(() =&gt; execution.cancel(), 500);
```

### 3. Post-Execution

```typescript
const task = FuturableTask.of(() =&gt; 42);

const execution = task.run();
const result = await execution;

console.log(result); // 42

// Cancelling after completion has no effect
execution.cancel();
```

## Common Patterns

### Fire and Forget

```typescript
// Start execution but don't wait
task.run();

// Or explicitly ignore the promise
void task.run();
```

### Parallel Execution

```typescript
const task = FuturableTask.of(() =&gt; fetchData());

// Run multiple times in parallel
const executions = [
  task.run(),
  task.run(),
  task.run()
];

const results = await Promise.all(executions);
```

### Sequential Execution

```typescript
const task = FuturableTask.of(() =&gt; processItem());

// Run sequentially
for (let i = 0; i &lt; 5; i++) {
  await task.run();
}
```

### Conditional Execution

```typescript
const task = FuturableTask.of(() =&gt; expensiveOperation());

let result;

if (needsData) {
  result = await task.run();
} else {
  result = getCachedData();
}
```

### Timeout Pattern

```typescript
async function runWithTimeout&lt;T&gt;(
  task: FuturableTask&lt;T&gt;,
  timeout: number
): Promise&lt;T&gt; {
  const controller = new AbortController();

  const timer = setTimeout(() =&gt; controller.abort(), timeout);

  try {
    return await task.run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

const result = await runWithTimeout(task, 5000);
```

### Retry Pattern

```typescript
async function retryRun&lt;T&gt;(
  task: FuturableTask&lt;T&gt;,
  attempts: number
): Promise&lt;T&gt; {
  for (let i = 0; i &lt; attempts; i++) {
    try {
      return await task.run();
    } catch (error) {
      if (i === attempts - 1) throw error;
      await new Promise(resolve =&gt; setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('All retries failed');
}

const result = await retryRun(task, 3);
```

## Performance Considerations

### Memoization for Expensive Operations

```typescript
// ❌ Without memoization - computes every time
const expensiveTask = FuturableTask.of(() =&gt; {
  return veryExpensiveComputation();
});

await expensiveTask.run(); // Slow
await expensiveTask.run(); // Slow again

// ✅ With memoization - computes once
const cachedTask = FuturableTask.of(() =&gt; {
  return veryExpensiveComputation();
}).memoize();

await cachedTask.run(); // Slow (first time)
await cachedTask.run(); // Fast (cached)
```

### Cancellation for Resource Management

```typescript
const task = FuturableTask.of((resolve, reject, { signal, onCancel }) =&gt; {
  const resources = [];

  // Allocate resources
  resources.push(allocateResource1());
  resources.push(allocateResource2());

  // Cleanup on cancellation
  onCancel(() =&gt; {
    resources.forEach(r =&gt; r.cleanup());
  });

  // Do work with resources
  performWork(resources)
    .then(resolve)
    .catch(reject);
});

const execution = task.run();

// If cancelled, resources are cleaned up
execution.cancel();
```

## Type Safety

```typescript
// TypeScript infers the return type
const numberTask = FuturableTask.of(() =&gt; 42);
const result: number = await numberTask.run(); // Type is number

// Explicit type annotation
const userTask = FuturableTask.of(async () =&gt; {
  const res = await fetch('/api/user');
  return res.json();
}) as FuturableTask&lt;User&gt;;

const user: User = await userTask.run();
```

## Comparison with runSafe()

| Method | Returns | On Success | On Error |
|--------|---------|------------|----------|
| `run()` | `Futurable&lt;T&gt;` | Resolves with value | Rejects |
| `runSafe()` | `Futurable&lt;Result&lt;T&gt;&gt;` | `{ success: true, data, error: null }` | `{ success: false, data: null, error }` |

```typescript
const task = FuturableTask.of(() =&gt; riskyOperation());

// Using run() - throws on error
try {
  const result = await task.run();
  console.log(result);
} catch (error) {
  console.error(error);
}

// Using runSafe() - never throws
const result = await task.runSafe();
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

## Notes

- Each call to `run()` creates a new independent execution
- Memoized tasks reuse the cached result across runs
- External signals are combined (AND logic) with the task's signal
- Cancelling the task cancels all future runs
- Cancelling an execution only cancels that specific run
- The returned Futurable inherits all Promise methods

## See Also

- [runSafe()](/api-task/run-safe) - Execute without throwing errors
- [cancel()](/api-task/cancel) - Cancel the task
- [memoize()](/api-task/memoize) - Cache execution results
- [Constructor](/api-task/constructor) - Create tasks
- [Introduction](/guide-task/introduction) - Learn about lazy evaluation
