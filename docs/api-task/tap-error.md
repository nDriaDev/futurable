# tapError()

Perform side effects on errors without changing the error.

## Syntax

```typescript
task.tapError(fn: (error: any) =&gt; void | Promise&lt;void&gt;): FuturableTask&lt;T&gt;
```

## Parameters

### `fn`

Function to execute when the task fails. The return value is ignored.

- **Input**: The error that occurred
- **Output**: Ignored (void)

## Return Value

A new `FuturableTask&lt;T&gt;` that executes the function on error but propagates the original error.

## Description

The `tapError()` method allows you to perform side effects (like logging or analytics) when a task fails, without modifying the error or handling it. The error continues to propagate after the side effect.

This is the error equivalent of `tap()` for success values.

## Examples

### Error Logging

```typescript
const task = FuturableTask
  .of(() =&gt; riskyOperation())
  .tapError(error =&gt; console.error('Operation failed:', error))
  .retry(3);
```

### Analytics Tracking

```typescript
const task = FuturableTask
  .fetch('/api/data')
  .tapError(error =&gt; {
    analytics.track('api_error', {
      endpoint: '/api/data',
      error: error.message,
      timestamp: Date.now()
    });
  });
```

### Multiple Error Handlers

```typescript
const task = FuturableTask
  .of(() =&gt; complexOperation())
  .tapError(error =&gt; console.error('Error:', error))
  .tapError(error =&gt; logger.error(error))
  .tapError(error =&gt; notifyAdmins(error))
  .recover(error =&gt; fallbackValue);
```

### Conditional Logging

```typescript
const task = FuturableTask
  .fetch('/api/data')
  .tapError(error =&gt; {
    if (error.status &gt;= 500) {
      console.error('Server error:', error);
      alertOps(error);
    }
  });
```

## Use Cases

### Error Reporting Service

```typescript
const task = FuturableTask
  .of(() =&gt; criticalOperation())
  .tapError(error =&gt; {
    errorReportingService.report({
      error,
      context: {
        user: getCurrentUser(),
        route: getCurrentRoute(),
        timestamp: new Date()
      }
    });
  });
```

### Debug Logging

```typescript
const task = FuturableTask
  .of(() =&gt; computation())
  .tap(result =&gt; console.log('Success:', result))
  .tapError(error =&gt; console.error('Failed:', error));

// See both success and failure in logs
```

### Metric Collection

```typescript
const task = FuturableTask
  .fetch('/api/expensive-operation')
  .tap(() =&gt; metrics.increment('operation.success'))
  .tapError(() =&gt; metrics.increment('operation.failure'));
```

### User Feedback

```typescript
const task = FuturableTask
  .of(() =&gt; saveDocument())
  .tap(() =&gt; showToast('Document saved!'))
  .tapError(error =&gt; {
    showToast(`Failed to save: ${error.message}`, 'error');
  });
```

### Retry with Logging

```typescript
const task = FuturableTask
  .of(() =&gt; unreliableAPI())
  .tapError((error) =&gt; {
    console.log('Attempt failed, will retry:', error);
  })
  .retry(3, { delay: 1000 });

// Logs each failure before retry
```

### Error Categorization

```typescript
const task = FuturableTask
  .fetch('/api/data')
  .tapError(error =&gt; {
    if (error.name === 'NetworkError') {
      networkErrorCount++;
    } else if (error.status === 404) {
      notFoundErrorCount++;
    } else {
      unknownErrorCount++;
    }
  });
```

## Combining with Other Methods

### With tap()

```typescript
const task = FuturableTask
  .of(() =&gt; operation())
  .tap(result =&gt; console.log('✅ Success:', result))
  .tapError(error =&gt; console.error('❌ Failed:', error));

// Logs either success or failure, never both
```

### With recover()

```typescript
const task = FuturableTask
  .of(() =&gt; riskyOperation())
  .tapError(error =&gt; {
    console.error('Primary failed:', error);
    logToFile(error);
  })
  .recover(error =&gt; {
    console.log('Using fallback');
    return fallbackValue;
  });
```

### With orElse()

```typescript
const task = FuturableTask
  .fetch('/api/primary')
  .tapError(error =&gt; console.log('Primary failed:', error))
  .orElse(() =&gt;
    FuturableTask.fetch('/api/backup')
      .tapError(error =&gt; console.log('Backup failed:', error))
  )
  .recover(() =&gt; DEFAULT_DATA);
```

### In a Pipeline

```typescript
const pipeline = FuturableTask
  .of(() =&gt; fetchData())
  .tap(data =&gt; console.log('Fetched:', data.length, 'items'))
  .map(data =&gt; validateData(data))
  .tapError(error =&gt; console.error('Validation failed:', error))
  .map(data =&gt; transformData(data))
  .tapError(error =&gt; console.error('Transform failed:', error))
  .flatMap(data =&gt; saveData(data))
  .tapError(error =&gt; console.error('Save failed:', error));
```

## Pattern: Observability

```typescript
class ObservableTask {
  static wrap&lt;T&gt;(name: string, task: FuturableTask&lt;T&gt;) {
    const startTime = Date.now();

    return task
      .tap(result =&gt; {
        const duration = Date.now() - startTime;
        console.log(`✅ ${name} succeeded in ${duration}ms`);
        metrics.timing(`${name}.duration`, duration);
        metrics.increment(`${name}.success`);
      })
      .tapError(error =&gt; {
        const duration = Date.now() - startTime;
        console.error(`❌ ${name} failed in ${duration}ms:`, error);
        metrics.timing(`${name}.duration`, duration);
        metrics.increment(`${name}.failure`);
      });
  }
}
// Usage
const task = ObservableTask.wrap(
  'fetchUserData',
  FuturableTask.fetch('/api/user')
);
```

## Best Practices

### 1. Keep Side Effects Pure

```typescript
// ✅ Good - no mutation
.tapError(error =&gt; {
  console.error(error);
  sendToLogger(error);
})

// ❌ Bad - mutation
.tapError(error =&gt; {
  error.logged = true; // Mutating error
})
```

### 2. Don't Throw in tapError

```typescript
// ✅ Good - catch errors
.tapError(error =&gt; {
  try {
    riskyLogging(error);
  } catch (loggingError) {
    console.error('Logging failed:', loggingError);
  }
})

// ❌ Bad - can throw
.tapError(error =&gt; {
  riskyLogging(error); // May throw and mask original error
})
```

### 3. Use for Observation, Not Handling

```typescript
// ✅ Good - observe and let error propagate
.tapError(error =&gt; console.error(error))
.recover(error =&gt; fallbackValue)

// ❌ Bad - trying to handle in tapError
.tapError(error =&gt; {
  return fallbackValue; // Return value is ignored!
})
```

### 4. Async Side Effects

```typescript
// tapError can be async
const task = FuturableTask
  .of(() =&gt; operation())
  .tapError(async error =&gt; {
    await saveErrorToDatabase(error);
    await notifyAdmin(error);
  });
```

## Comparison with recover()

```typescript
// tapError - observe error, don't handle
const observe = FuturableTask
  .of(() =&gt; fail())
  .tapError(error =&gt; console.log(error))
// Error still propagates

// recover - handle error
const handle = FuturableTask
  .of(() =&gt; fail())
  .recover(error =&gt; {
    console.log(error);
    return 'recovered';
  });
// Error is handled, returns 'recovered'
```

## Notes

- The function is only called if the task fails
- Return value is completely ignored
- Error continues to propagate unchanged
- Can be async (returns Promise&lt;void&gt;)
- Multiple `tapError()` calls can be chained
- Does not catch or handle the error
- Useful for logging, metrics, and monitoring

## See Also

- [tap()](/api-task/tap) - Side effects on success
- [orElse()](/api-task/or-else) - Alternative tasks
- [Composition Guide](/guide-task/composition) - Composition patterns
