# Timing & Delays

FuturableTask provides powerful tools to control when and how tasks execute, including delays, timeouts, debouncing, and scheduling.

## Delaying Execution

### delay()

Add a delay before task execution:

```typescript
const task = FuturableTask
  .of(() => sendNotification())
  .delay(5000); // Wait 5 seconds before executing

await task.run();
```

### Use Cases

**Rate Limiting:**
```typescript
const tasks = ids.map((id, index) =>
  FuturableTask
    .fetch(`/api/data/${id}`)
    .delay(index * 100) // Stagger by 100ms
);

await FuturableTask.parallel(tasks).run();
```

**Retry with Delay:**
```typescript
const task = FuturableTask
  .of(() => unreliableAPI())
  .retry(3, { delay: 1000 }); // 1s between retries
```

**User Experience:**
```typescript
// Show loading indicator after short delay
const showLoading = FuturableTask
  .of(() => setLoading(true))
  .delay(200); // Only show if takes > 200ms
```

## Timeouts

### timeout()

Automatically fail if operation takes too long:

```typescript
const task = FuturableTask
  .fetch('/api/slow-endpoint')
  .timeout(5000); // Fail after 5 seconds

try {
  const result = await task.run();
} catch (error) {
  console.log('Request timed out');
}
```

### Timeout Strategies

**Per-Operation Timeouts:**
```typescript
const pipeline = FuturableTask
  .fetch('/api/step1')
  .timeout(2000)
  .flatMap(r1 =>
    FuturableTask.fetch('/api/step2')
      .timeout(3000)
  )
  .flatMap(r2 =>
    FuturableTask.fetch('/api/step3')
      .timeout(5000)
  );
```

**Timeout with Retry:**
```typescript
const resilient = FuturableTask
  .fetch('/api/data')
  .timeout(3000)    // Each attempt times out after 3s
  .retry(3, {        // Retry up to 3 times
    delay: 1000
  });
```

**Timeout with Fallback:**
```typescript
const task = FuturableTask
  .fetch('/api/primary')
  .timeout(2000)
  .orElse(() =>
    FuturableTask.fetch('/api/backup')
      .timeout(3000)
  )
  .fallbackTo(() => CACHED_DATA);
```

## Debouncing

### debounce()

Delay execution until after inactivity period:

```typescript
const searchTask = FuturableTask
  .of((query: string) => searchAPI(query))
  .debounce(300);

// User types rapidly
searchTask.run('a');   // Cancelled
searchTask.run('ab');  // Cancelled
searchTask.run('abc'); // Executes after 300ms
```

### Debouncing Patterns

**Search Input:**
```typescript
const searchUsers = FuturableTask
  .of((query: string) =>
    fetch(`/api/search?q=${query}`)
      .then(r => r.json())
  )
  .debounce(300);

input.addEventListener('input', (e) => {
  searchUsers.run(e.target.value)
    .then(results => displayResults(results));
});
```

**Auto-Save:**
```typescript
const autoSave = FuturableTask
  .of((data: FormData) =>
    fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  )
  .debounce(1000);

formInputs.forEach(input => {
  input.addEventListener('change', () => {
    autoSave.run(getFormData());
  });
});
```

**Window Resize:**
```typescript
const recalculateLayout = FuturableTask
  .of(() => {
    updateDimensions();
    reflowContent();
    updateCharts();
  })
  .debounce(150);

window.addEventListener('resize', () => {
  recalculateLayout.run();
});
```

## Scheduling Patterns

### Sequential with Delays

```typescript
const steps = [
  FuturableTask.of(() => step1()).delay(0),
  FuturableTask.of(() => step2()).delay(1000),
  FuturableTask.of(() => step3()).delay(2000)
];

await FuturableTask.sequence(steps).run();
```

### Polling with Interval

```typescript
let attempts = 0;
const MAX_ATTEMPTS = 10;

const pollUntilReady = FuturableTask
  .until(
    async () => {
      attempts++;
      const status = await checkStatus();
      return status === 'ready' || attempts >= MAX_ATTEMPTS;
    },
    FuturableTask.of(() => fetch('/api/status'))
      .delay(1000) // Poll every second
  );

await pollUntilReady.run();
```

### Exponential Backoff

```typescript
const withBackoff = FuturableTask
  .of(() => unstableAPI())
  .retry(5, {
    delay: 1000,
    backoff: 2  // 1s, 2s, 4s, 8s, 16s
  });
```

### Jittered Retry

```typescript
const jitteredRetry = FuturableTask
  .of(() => apiCall())
  .retry(5, {
    delay: 1000,
    shouldRetry: (error, attempt) => {
      // Add random jitter to prevent thundering herd
      const jitter = Math.random() * 500;
      return new Promise(resolve =>
        setTimeout(() => resolve(true), jitter)
      );
    }
  });
```

## Advanced Timing Patterns

### Circuit Breaker with Timeout

```typescript
class CircuitBreaker {
  private failures = 0;
  private isOpen = false;

  wrap<T>(task: FuturableTask<T>, timeout: number) {
    return FuturableTask.of(async () => {
      if (this.isOpen) {
        throw new Error('Circuit breaker open');
      }

      const result = await task
        .timeout(timeout)
        .runSafe();

      if (result.success) {
        this.failures = 0;
        return result.data;
      } else {
        this.failures++;
        if (this.failures >= 5) {
          this.isOpen = true;
          setTimeout(() => {
            this.isOpen = false;
            this.failures = 0;
          }, 60000);
        }
        throw result.error;
      }
    });
  }
}
```

### Rate Limiter with Queue

```typescript
class RateLimiter {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(
    private maxConcurrent: number,
    private intervalMs: number
  ) {}

  wrap<T>(task: FuturableTask<T>): FuturableTask<T> {
    return FuturableTask.of(() => {
      return new Promise((resolve, reject) => {
        this.queue.push(() => {
          this.active++;

          task.run()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              this.active--;
              setTimeout(() => this.processQueue(), this.intervalMs);
            });
        });

        this.processQueue();
      });
    });
  }

  private processQueue() {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const next = this.queue.shift();
      next?.();
    }
  }
}
```

### Scheduled Execution

```typescript
function scheduleAt(task: FuturableTask<any>, date: Date) {
  const delay = date.getTime() - Date.now();

  if (delay < 0) {
    throw new Error('Cannot schedule in the past');
  }

  return task.delay(delay);
}

// Schedule for specific time
const scheduledTask = scheduleAt(
  FuturableTask.of(() => sendEmail()),
  new Date('2025-12-31T23:59:59')
);
```

## Best Practices

### 1. Choose Appropriate Timeouts

```typescript
// ✅ Realistic timeouts
FuturableTask.fetch('/api/data')
  .timeout(10000); // 10 seconds for API

FuturableTask.of(() => uploadLargeFile())
  .timeout(60000); // 60 seconds for upload

// ❌ Too short
FuturableTask.of(() => complexComputation())
  .timeout(100); // Will always timeout
```

### 2. Debounce User Input

```typescript
// ✅ Always debounce
const search = FuturableTask
  .of(query => searchAPI(query))
  .debounce(300);

// ❌ No debouncing
input.addEventListener('input', () => {
  searchAPI(query); // Too many requests!
});
```

### 3. Combine Strategies

```typescript
// ✅ Timeout + Retry + Fallback
const robust = FuturableTask
  .fetch('/api/data')
  .timeout(3000)
  .retry(3, { delay: 1000 })
  .orElse(() => FuturableTask.fetch('/api/backup'))
  .fallbackTo(() => CACHED_DATA);
```

### 4. Use Delays for User Experience

```typescript
// ✅ Avoid flickering
const loadData = FuturableTask
  .of(() => fetchQuickData())
  .tap(() => {
    // Only show loading if it takes > 200ms
    FuturableTask.of(() => setLoading(true))
      .delay(200)
      .run();
  });
```

## See Also

- [timeout()](/api-task/timeout) - Timeout API
- [delay()](/api-task/delay) - Delay API
- [debounce()](/api-task/debounce) - Debounce API
- [retry()](/api-task/retry) - Retry API
- [Concurrency Guide](/guide-task/concurrency)