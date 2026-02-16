# cancel()

Cancel all running and future executions of the task.

## Syntax

```typescript
task.cancel(): void
```

## Parameters

None.

## Return Value

`void`

## Description

The `cancel()` method aborts all running and future executions of the task. When called:

1. Aborts the internal AbortSignal
2. Executes all registered task-level `onCancel()` callbacks
3. Cancels all Futurables created by `run()` that haven't completed yet
4. Prevents new executions from starting (they will remain pending)

This method is **idempotent** - calling it multiple times has no additional effect.

## Examples

### Basic Cancellation

```typescript
const task = FuturableTask.of(() =&gt; {
  console.log('Starting...');
  return longRunningOperation();
});

const execution = task.run();

// Cancel the task
task.cancel();
// The execution will be cancelled
```

### Cancel Before Execution

```typescript
const task = FuturableTask.of(() =&gt; expensiveOperation());

// Cancel before running
task.cancel();

// This won't execute
const result = task.run(); // Will remain pending
```

### Cancel During Execution

```typescript
const task = FuturableTask.of((resolve, reject, { signal }) =&gt; {
  const interval = setInterval(() =&gt; {
    if (signal.aborted) {
      clearInterval(interval);
      return;
    }
    console.log('Working...');
  }, 100);
});

const execution = task.run();

// Cancel after 500ms
setTimeout(() =&gt; task.cancel(), 500);
```

### Cancel Multiple Executions

```typescript
const task = FuturableTask.of(() =&gt; fetchData());

// Start multiple executions
const run1 = task.run();
const run2 = task.run();
const run3 = task.run();

// Cancel all at once
task.cancel();
// All three executions are cancelled
```

### With Cleanup Callbacks

```typescript
const task = FuturableTask
  .of(() =&gt; {
    const resource = allocateResource();
    return processResource(resource);
  })
  .onCancel(() =&gt; {
    console.log('Cleaning up resources');
    cleanupResources();
  });

task.cancel(); // Logs: "Cleaning up resources"
```

### React Component Cleanup

```typescript
function DataFetcher({ id }) {
  const [data, setData] = useState(null);

  useEffect(() =&gt; {
    const task = FuturableTask
      .fetch(`/api/data/${id}`)
      .map(res =&gt; res.json());

    task.run().then(setData);

    // Cancel on unmount or id change
    return () =&gt; task.cancel();
  }, [id]);

  return &lt;div&gt;{data?.name}&lt;/div&gt;;
}
```

### Timeout Pattern

```typescript
const task = FuturableTask.of(() =&gt; slowOperation());

// Auto-cancel after timeout
setTimeout(() =&gt; task.cancel(), 5000);

try {
  const result = await task.run();
} catch (error) {
  console.log('Operation timed out or cancelled');
}
```

### User-Initiated Cancellation

```typescript
let currentTask: FuturableTask&lt;any&gt; | null = null;

function startOperation() {
  // Cancel previous operation if exists
  if (currentTask) {
    currentTask.cancel();
  }

  currentTask = FuturableTask.of(() =&gt; performOperation());
  return currentTask.run();
}

function cancelOperation() {
  if (currentTask) {
    currentTask.cancel();
    currentTask = null;
  }
}
```

## Behavior Details

### Idempotent

```typescript
const task = FuturableTask.of(() =&gt; work());

task.cancel();
task.cancel(); // No effect
task.cancel(); // No effect
```

### Signal State

```typescript
const task = FuturableTask.of(() =&gt; work());

console.log(task.signal.aborted); // false
task.cancel();
console.log(task.signal.aborted); // true
```

### Pending Executions

```typescript
const task = FuturableTask.of(() =&gt; work());

task.cancel();

// This will create a Futurable but won't execute
const execution = task.run();

// The execution remains pending indefinitely
await execution; // Never resolves or rejects
```

### Cleanup Order

```typescript
const task = FuturableTask
  .of(() =&gt; work())
  .onCancel(() =&gt; console.log('Cleanup 1'))
  .onCancel(() =&gt; console.log('Cleanup 2'))
  .onCancel(() =&gt; console.log('Cleanup 3'));

task.cancel();
// Logs in order:
// "Cleanup 1"
// "Cleanup 2"
// "Cleanup 3"
```

## Common Patterns

### Cancellable Search

```typescript
class SearchManager {
  private currentSearch: FuturableTask&lt;any&gt; | null = null;

  search(query: string) {
    // Cancel previous search
    if (this.currentSearch) {
      this.currentSearch.cancel();
    }

    this.currentSearch = FuturableTask
      .fetch(`/api/search?q=${query}`)
      .map(res =&gt; res.json());

    return this.currentSearch.run();
  }

  clearSearch() {
    if (this.currentSearch) {
      this.currentSearch.cancel();
      this.currentSearch = null;
    }
  }
}
```

### Request Deduplication

```typescript
const cache = new Map&lt;string, FuturableTask&lt;any&gt;&gt;();

function fetchWithDedup(url: string) {
  if (cache.has(url)) {
    const existing = cache.get(url)!;
    return existing.run();
  }

  const task = FuturableTask.fetch(url).map(r =&gt; r.json());
  cache.set(url, task);

  return task.run();
}

function invalidateCache(url: string) {
  const task = cache.get(url);
  if (task) {
    task.cancel();
    cache.delete(url);
  }
}
```

### Cancellation Token

```typescript
class CancellationToken {
  private tasks: Set&lt;FuturableTask&lt;any&gt;&gt; = new Set();

  register&lt;T&gt;(task: FuturableTask&lt;T&gt;): FuturableTask&lt;T&gt; {
    this.tasks.add(task);
    return task;
  }

  cancelAll() {
    this.tasks.forEach(task =&gt; task.cancel());
    this.tasks.clear();
  }
}

const token = new CancellationToken();

token.register(FuturableTask.of(() =&gt; op1())).run();
token.register(FuturableTask.of(() =&gt; op2())).run();
token.register(FuturableTask.of(() =&gt; op3())).run();

// Cancel all operations
token.cancelAll();
```

## Difference from Futurable.cancel()

```typescript
// Futurable: cancels a specific execution
const futurable = Futurable.fetch('/api/data');
futurable.cancel(); // Only this execution

// FuturableTask: cancels all executions
const task = FuturableTask.fetch('/api/data');
const run1 = task.run();
const run2 = task.run();
task.cancel(); // Both run1 and run2 are cancelled
```

## Best Practices

### 1. Always Cleanup Resources

```typescript
const task = FuturableTask
  .of(() =&gt; {
    const ws = new WebSocket(url);
    return listenToSocket(ws);
  })
  .onCancel(() =&gt; {
    ws.close(); // Always cleanup
  });
```

### 2. Cancel on Component Unmount

```typescript
useEffect(() =&gt; {
  const task = FuturableTask.of(() =&gt; fetchData());
  task.run().then(setData);

  return () =&gt; task.cancel(); // Cleanup
}, []);
```

### 3. Cancel Previous Operations

```typescript
let currentTask: FuturableTask&lt;any&gt; | null = null;

function startNew() {
  currentTask?.cancel(); // Cancel old
  currentTask = FuturableTask.of(() =&gt; newOperation());
  return currentTask.run();
}
```

### 4. Use with Timeouts

```typescript
const task = FuturableTask.of(() =&gt; operation());

const timeout = setTimeout(() =&gt; task.cancel(), 5000);

try {
  const result = await task.run();
  clearTimeout(timeout);
} catch (error) {
  // Handle cancellation or error
}
```

## Notes

- Calling `cancel()` multiple times is safe (idempotent)
- Cancelled tasks cannot be "uncancelled"
- Executions started after cancellation will remain pending
- All `onCancel()` callbacks are executed when cancelled
- The internal signal is aborted permanently
- Does not throw errors - cancellation is silent

## See Also

- [onCancel()](/api-task/on-cancel) - Register cancellation callbacks
- [run()](/api-task/run) - Execute the task
- [signal](/api-task/signal) - Access the abort signal
- [Constructor](/api-task/constructor) - Create tasks