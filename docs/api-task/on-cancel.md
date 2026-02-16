# onCancel()

Register a callback to execute when the task is cancelled.

## Syntax

```typescript
task.onCancel(callback: () =&gt; void): FuturableTask&lt;T&gt;
```

## Parameters

### `callback`

A function to execute when the task is cancelled. The callback receives no arguments.

## Return Value

Returns `this` for method chaining.

## Description

The `onCancel()` method registers a callback that will be executed when the task is cancelled via `cancel()`. Multiple callbacks can be registered and they will be executed in the order they were added.

### Key Behaviors

- **Eager Registration**: Callbacks are registered at the task level, not per execution
- **Multiple Callbacks**: Can register multiple callbacks on the same task
- **Execution Order**: Callbacks execute in registration order
- **Chainable**: Returns `this` for fluent API
- **One-Time**: Each callback executes once when cancelled

## Examples

### Basic Usage

```typescript
const task = FuturableTask
  .of(() =&gt; longOperation())
  .onCancel(() =&gt; {
    console.log('Task was cancelled');
  });

task.cancel(); // Logs: "Task was cancelled"
```

### Resource Cleanup

```typescript
const task = FuturableTask.of((resolve, reject) =&gt; {
  const ws = new WebSocket('wss://example.com');
  const timer = setTimeout(() =&gt; resolve('done'), 5000);

  // Cleanup on cancellation
  task.onCancel(() =&gt; {
    clearTimeout(timer);
    ws.close();
    console.log('Resources cleaned up');
  });

  ws.onmessage = (msg) =&gt; resolve(msg.data);
});
```

### Multiple Callbacks

```typescript
const task = FuturableTask
  .of(() =&gt; fetchData())
  .onCancel(() =&gt; console.log('Cleanup 1'))
  .onCancel(() =&gt; console.log('Cleanup 2'))
  .onCancel(() =&gt; console.log('Cleanup 3'));

task.cancel();
// Logs in order:
// "Cleanup 1"
// "Cleanup 2"
// "Cleanup 3"
```

### Method Chaining

```typescript
const task = FuturableTask
  .of(() =&gt; fetchData())
  .map(data =&gt; processData(data))
  .onCancel(() =&gt; console.log('Cancelled'))
  .retry(3)
  .timeout(5000)
  .onCancel(() =&gt; console.log('All cleanup done'));
```

### State Management

```typescript
let isRunning = false;

const task = FuturableTask
  .of(() =&gt; {
    isRunning = true;
    return heavyComputation();
  })
  .onCancel(() =&gt; {
    isRunning = false;
    console.log('Computation stopped');
  });

const execution = task.run();

// Cancel and update state
setTimeout(() =&gt; task.cancel(), 1000);
```

### UI Integration

```typescript
function LoadingButton({ onClick }) {
  const [loading, setLoading] = useState(false);

  const handleClick = () =&gt; {
    const task = FuturableTask
      .of(() =&gt; performAction())
      .onCancel(() =&gt; {
        setLoading(false);
        showMessage('Action cancelled');
      });

    setLoading(true);
    task.run()
      .then(() =&gt; setLoading(false))
      .catch(() =&gt; setLoading(false));

    // Save task reference for cancellation
    window.currentTask = task;
  };

  return (
    &lt;button onClick={handleClick} disabled={loading}&gt;
      {loading ? 'Loading...' : 'Click Me'}
    &lt;/button&gt;
  );
}
```

### File Upload Cancellation

```typescript
const uploadTask = FuturableTask
  .of(() =&gt; {
    const formData = new FormData();
    formData.append('file', file);
    return fetch('/upload', { method: 'POST', body: formData });
  })
  .onCancel(() =&gt; {
    console.log('Upload cancelled');
    updateProgressBar(0);
    showNotification('Upload cancelled by user');
  });

// User clicks cancel button
cancelButton.addEventListener('click', () =&gt; {
  uploadTask.cancel();
});
```

### Database Transaction Rollback

```typescript
const transaction = FuturableTask
  .of(async () =&gt; {
    await db.begin();
    await db.execute('INSERT INTO users ...');
    await db.execute('UPDATE accounts ...');
    await db.commit();
  })
  .onCancel(async () =&gt; {
    console.log('Rolling back transaction');
    await db.rollback();
  });
```

### Network Request Abort

```typescript
const controller = new AbortController();

const task = FuturableTask
  .of(() =&gt; fetch('/api/data', { signal: controller.signal }))
  .onCancel(() =&gt; {
    controller.abort();
    console.log('Network request aborted');
  });
```

### Timer Cleanup

```typescript
const task = FuturableTask.of((resolve) =&gt; {
  const timers: NodeJS.Timeout[] = [];

  timers.push(setTimeout(() =&gt; console.log('Step 1'), 1000));
  timers.push(setTimeout(() =&gt; console.log('Step 2'), 2000));
  timers.push(setTimeout(() =&gt; resolve('done'), 3000));

  // Cleanup all timers on cancel
  task.onCancel(() =&gt; {
    timers.forEach(timer =&gt; clearTimeout(timer));
    console.log('All timers cleared');
  });
});
```

### EventSource Cleanup

```typescript
const task = FuturableTask.of(() =&gt; {
  const eventSource = new EventSource('/events');

  return new Promise((resolve) =&gt; {
    eventSource.onmessage = (event) =&gt; {
      resolve(event.data);
    };
  });
}).onCancel(() =&gt; {
  eventSource.close();
  console.log('EventSource closed');
});
```

## Combining with Executor onCancel

You can use both executor-level and task-level cancellation:

```typescript
const task = new FuturableTask((resolve, reject, { onCancel }) =&gt; {
  const timer = setTimeout(() =&gt; resolve('done'), 5000);

  // Executor-level cleanup (runs per execution)
  onCancel(() =&gt; {
    clearTimeout(timer);
    console.log('Execution cancelled');
  });
});

// Task-level cleanup (runs once for the task)
task.onCancel(() =&gt; {
  console.log('Task cancelled');
});

task.cancel();
// Logs:
// "Task cancelled" (task-level)
// "Execution cancelled" (executor-level, for any running execution)
```

## Common Patterns

### Cleanup Manager

```typescript
class ResourceManager {
  private resources: any[] = [];

  createTask&lt;T&gt;(work: () =&gt; T) {
    return FuturableTask.of(work).onCancel(() =&gt; {
      this.cleanup();
    });
  }

  addResource(resource: any) {
    this.resources.push(resource);
  }

  cleanup() {
    this.resources.forEach(r =&gt; r.dispose());
    this.resources = [];
  }
}
```

### Progress Reset

```typescript
const task = FuturableTask
  .of(() =&gt; processLargeFile())
  .onCancel(() =&gt; {
    progressBar.reset();
    statusText.innerText = 'Processing cancelled';
  });
```

### Analytics Tracking

```typescript
const task = FuturableTask
  .of(() =&gt; performOperation())
  .onCancel(() =&gt; {
    analytics.track('operation_cancelled', {
      timestamp: Date.now(),
      reason: 'user_initiated'
    });
  });
```

### Notification Display

```typescript
const task = FuturableTask
  .of(() =&gt; longProcess())
  .onCancel(() =&gt; {
    toast.show({
      message: 'Operation cancelled',
      type: 'warning',
      duration: 3000
    });
  });
```

## Best Practices

### 1. Always Cleanup Resources

```typescript
// ✅ Good - cleanup all resources
const task = FuturableTask
  .of(() =&gt; {
    const resource = allocate();
    return process(resource);
  })
  .onCancel(() =&gt; {
    resource.dispose();
  });

// ❌ Bad - resource leak
const task = FuturableTask.of(() =&gt; {
  const resource = allocate();
  return process(resource);
});
```

### 2. Keep Callbacks Simple

```typescript
// ✅ Good - simple, focused callback
.onCancel(() =&gt; {
  cleanup();
  updateUI();
})

// ❌ Bad - complex logic
.onCancel(() =&gt; {
  if (condition1) {
    // lots of logic
  } else if (condition2) {
    // more logic
  }
  // ...
})
```

### 3. Don't Throw in Callbacks

```typescript
// ✅ Good - handle errors internally
.onCancel(() =&gt; {
  try {
    riskyCleanup();
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
})

// ❌ Bad - throwing errors
.onCancel(() =&gt; {
  riskyCleanup(); // May throw
})
```

### 4. Use for Side Effects Only

```typescript
// ✅ Good - side effects only
.onCancel(() =&gt; {
  logCancellation();
  closeConnections();
})

// ❌ Bad - trying to change task behavior
.onCancel(() =&gt; {
  return 'cancelled'; // Ignored
})
```

## Execution Timing

```typescript
const task = FuturableTask
  .of(() =&gt; work())
  .onCancel(() =&gt; console.log('1'))
  .onCancel(() =&gt; console.log('2'));

console.log('Before cancel');
task.cancel();
console.log('After cancel');

// Output:
// "Before cancel"
// "1"
// "2"
// "After cancel"
```

## Notes

- Callbacks are executed synchronously when `cancel()` is called
- Callbacks execute even if the task was never run
- Return values from callbacks are ignored
- Errors thrown in callbacks are not caught (wrap in try-catch)
- Multiple calls to `onCancel()` add more callbacks
- Callbacks are called only once per `cancel()` invocation
- Works in combination with executor-level `onCancel()`

## See Also

- [cancel()](/api-task/cancel) - Cancel the task
- [signal](/api-task/signal) - Access the abort signal
- [Constructor](/api-task/constructor) - Executor-level onCancel
- [run()](/api-task/run) - Execute the task