# signal

Access the task's internal AbortSignal.

## Syntax

```typescript
task.signal: AbortSignal
```

## Return Value

The internal `AbortSignal` that is aborted when the task is cancelled.

## Description

The `signal` property provides read-only access to the task's internal AbortSignal. This signal is aborted when `cancel()` is called on the task, and all executions created by `run()` will listen to this signal.

## Examples

### Check Cancellation State

```typescript
const task = FuturableTask.of(() =&gt; longOperation());

console.log(task.signal.aborted); // false
task.cancel();
console.log(task.signal.aborted); // true
```

### Listen to Abort Event

```typescript
const task = FuturableTask.of(() =&gt; operation());

task.signal.addEventListener('abort', () =&gt; {
  console.log('Task was cancelled');
});

task.cancel(); // Logs: "Task was cancelled"
```

### Pass to Native APIs

```typescript
const task = FuturableTask.of(() =&gt; {
  // Pass signal to fetch
  return fetch('/api/data', { signal: task.signal });
});
```

### Manual Polling with Signal

```typescript
const task = new FuturableTask((resolve, reject, { signal }) =&gt; {
  const interval = setInterval(() =&gt; {
    if (signal.aborted) {
      clearInterval(interval);
      reject(new Error('Cancelled'));
      return;
    }

    checkStatus().then(status =&gt; {
      if (status === 'ready') {
        clearInterval(interval);
        resolve(status);
      }
    });
  }, 1000);
});
```

### Coordinating Cancellation

```typescript
const parentTask = FuturableTask.of(() =&gt; mainOperation());

// Child task inherits parent's signal
const childTask = new FuturableTask(
  (resolve) =&gt; {
    resolve(childOperation());
  },
  parentTask.signal // Use parent's signal
);

// Cancelling parent cancels child
parentTask.cancel();
console.log(childTask.signal.aborted); // true
```

## Use Cases

### Resource Cleanup

```typescript
const task = new FuturableTask((resolve, reject, utils) =&gt; {
  const resource = allocateResource();

  utils.signal.addEventListener('abort', () =&gt; {
    resource.cleanup();
  });

  processResource(resource).then(resolve);
});
```

### Abort Controller Integration

```typescript
const task = FuturableTask.of(() =&gt; {
  const controller = new AbortController();

  // Link signals
  task.signal.addEventListener('abort', () =&gt; {
    controller.abort();
  });

  return fetch('/api/data', { signal: controller.signal });
});
```

### Conditional Logic

```typescript
const task = new FuturableTask(async (resolve, reject, { signal }) =&gt; {
  for (let i = 0; i &lt; 100; i++) {
    if (signal.aborted) {
      reject(new Error('Cancelled at iteration ' + i));
      return;
    }

    await processItem(i);
  }

  resolve('Complete');
});
```

## Notes

- The signal is aborted when `cancel()` is called
- Cannot be modified (read-only property)
- Shared across all executions of the task
- Compatible with native AbortSignal APIs
- Once aborted, cannot be reset

## See Also

- [cancel()](/api-task/cancel) - Cancel the task
- [onCancel()](/api-task/on-cancel) - Register cancellation callbacks
- [run()](/api-task/run) - Execute the task
- [Constructor](/api-task/constructor) - Create tasks with signals