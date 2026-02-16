# Advanced Patterns

This guide explores advanced patterns and techniques for building complex workflows with FuturableTask.

## Complex Workflows

### Pipeline Pattern

Build complex data processing pipelines:

```typescript
const processPipeline = FuturableTask
  .of(() => fetchRawData())
  .map(data => validateData(data))
  .filter(data => data.isValid, 'Invalid data')
  .map(data => normalizeData(data))
  .map(data => enrichData(data))
  .flatMap(data =>
    FuturableTask.of(() => saveToDatabase(data))
  )
  .tap(result => logSuccess(result))
  .recover(error => {
    logError(error);
    return fallbackData;
  });
```

### Saga Pattern

Coordinate multiple operations with rollback:

```typescript
class Saga<T> {
  private compensations: Array<() => Promise<void>> = [];

  step<U>(
    forward: () => Promise<U>,
    backward: () => Promise<void>
  ): FuturableTask<U> {
    return FuturableTask.of(async () => {
      try {
        const result = await forward();
        this.compensations.unshift(backward);
        return result;
      } catch (error) {
        await this.rollback();
        throw error;
      }
    });
  }

  async rollback() {
    for (const compensate of this.compensations) {
      try {
        await compensate();
      } catch (error) {
        console.error('Compensation failed:', error);
      }
    }
    this.compensations = [];
  }
}

// Usage
const saga = new Saga();

const transaction = FuturableTask.sequence([
  saga.step(
    () => createUser(userData),
    () => deleteUser(userId)
  ),
  saga.step(
    () => createAccount(accountData),
    () => deleteAccount(accountId)
  ),
  saga.step(
    () => sendWelcomeEmail(email),
    () => {} // Email can't be unsent
  )
]);
```

### Fan-Out/Fan-In Pattern

Parallelize work then aggregate results:

```typescript
async function fanOutFanIn<T, U>(
  items: T[],
  processor: (item: T) => FuturableTask<U>,
  aggregator: (results: U[]) => any
) {
  const limiter = FuturableTask.createLimiter(10);

  const tasks = items.map(item =>
    limiter(processor(item))
  );

  const results = await FuturableTask
    .parallel(tasks)
    .run();

  return aggregator(results);
}

// Usage
const result = await fanOutFanIn(
  urls,
  url => FuturableTask.fetch(url).map(r => r.json()),
  results => results.reduce((acc, r) => ({ ...acc, ...r }), {})
);
```

## State Machines

### Finite State Machine

```typescript
type State = 'idle' | 'loading' | 'success' | 'error';

class TaskStateMachine<T> {
  private state: State = 'idle';
  private data: T | null = null;
  private error: any = null;

  execute(task: FuturableTask<T>): FuturableTask<void> {
    return FuturableTask.of(async () => {
      this.transition('loading');

      const result = await task.runSafe();

      if (result.success) {
        this.data = result.data;
        this.transition('success');
      } else {
        this.error = result.error;
        this.transition('error');
      }
    });
  }

  private transition(newState: State) {
    console.log(`${this.state} → ${newState}`);
    this.state = newState;
  }

  getState() {
    return {
      state: this.state,
      data: this.data,
      error: this.error
    };
  }
}
```

## Caching Strategies

### LRU Cache with Tasks

```typescript
class TaskCache<K, V> {
  private cache = new Map<K, { data: V; timestamp: number }>();
  private maxSize = 100;
  private ttl = 60000; // 1 minute

  getOrCompute(
    key: K,
    compute: () => FuturableTask<V>
  ): FuturableTask<V> {
    return FuturableTask.of(async () => {
      const cached = this.cache.get(key);

      if (cached && Date.now() - cached.timestamp < this.ttl) {
        return cached.data;
      }

      const data = await compute().run();

      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });

      // Evict oldest if cache is full
      if (this.cache.size > this.maxSize) {
        const oldest = Array.from(this.cache.keys())[0];
        this.cache.delete(oldest);
      }

      return data;
    });
  }
}
```

### Stale-While-Revalidate

```typescript
function staleWhileRevalidate<T>(
  fetch: () => FuturableTask<T>,
  cache: Map<string, T>,
  key: string
): FuturableTask<T> {
  return FuturableTask.of(async () => {
    const cached = cache.get(key);

    // Start revalidation in background
    fetch().run().then(fresh => {
      cache.set(key, fresh);
    });

    // Return stale data immediately if available
    if (cached) {
      return cached;
    }

    // Otherwise wait for fresh data
    return await fetch().run();
  });
}
```

## Coordination Patterns

### Barrier Pattern

Wait for multiple tasks before proceeding:

```typescript
class Barrier {
  private tasks: FuturableTask<any>[] = [];

  add<T>(task: FuturableTask<T>) {
    this.tasks.push(task);
    return this;
  }

  wait(): FuturableTask<any[]> {
    return FuturableTask.parallel(this.tasks);
  }
}

const barrier = new Barrier();

barrier.add(task1);
barrier.add(task2);
barrier.add(task3);

const results = await barrier.wait().run();
```

### Rendezvous Pattern

Synchronize two concurrent operations:

```typescript
function rendezvous<T, U, R>(
  task1: FuturableTask<T>,
  task2: FuturableTask<U>,
  combiner: (a: T, b: U) => R
): FuturableTask<R> {
  return task1.zip(task2).map(([a, b]) => combiner(a, b));
}

const result = await rendezvous(
  FuturableTask.fetch('/api/users'),
  FuturableTask.fetch('/api/settings'),
  (users, settings) => ({ users, settings })
).run();
```

## Error Recovery Strategies

### Graceful Degradation

```typescript
function gracefulDegradation<T>(
  primary: FuturableTask<T>,
  fallbacks: FuturableTask<T>[]
): FuturableTask<T> {
  let task = primary;

  for (const fallback of fallbacks) {
    task = task.orElse(() => fallback);
  }

  return task;
}

const data = await gracefulDegradation(
  FuturableTask.fetch('/api/v2/data'),
  [
    FuturableTask.fetch('/api/v1/data'),
    FuturableTask.of(() => loadFromCache()),
    FuturableTask.resolve(DEFAULT_DATA)
  ]
).run();
```

### Bulkhead Pattern

Isolate failures:

```typescript
class Bulkhead {
  private limiters = new Map<string, FuturableTaskLimiter>();

  getLimiter(name: string, concurrency: number) {
    if (!this.limiters.has(name)) {
      this.limiters.set(
        name,
        FuturableTask.createLimiter(concurrency)
      );
    }
    return this.limiters.get(name)!;
  }

  wrap<T>(
    name: string,
    task: FuturableTask<T>,
    concurrency: number = 10
  ): FuturableTask<T> {
    const limiter = this.getLimiter(name, concurrency);
    return limiter(task);
  }
}

// Isolate different services
const bulkhead = new Bulkhead();

const userService = bulkhead.wrap(
  'users',
  FuturableTask.fetch('/api/users'),
  5
);

const orderService = bulkhead.wrap(
  'orders',
  FuturableTask.fetch('/api/orders'),
  3
);
```

## Performance Optimization

### Request Deduplication

```typescript
class RequestDeduplicator<K, V> {
  private pending = new Map<K, FuturableTask<V>>();

  deduplicate(
    key: K,
    factory: () => FuturableTask<V>
  ): FuturableTask<V> {
    return FuturableTask.of(async () => {
      if (this.pending.has(key)) {
        return await this.pending.get(key)!.run();
      }

      const task = factory();
      this.pending.set(key, task);

      try {
        const result = await task.run();
        return result;
      } finally {
        this.pending.delete(key);
      }
    });
  }
}
```

### Batch Processing

```typescript
function batchProcess<T, U>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => FuturableTask<U[]>
): FuturableTask<U[]> {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return FuturableTask
    .traverse(batches, batch => processor(batch))
    .map(results => results.flat());
}

// Process 1000 items in batches of 100
const results = await batchProcess(
  items,
  100,
  batch => FuturableTask.of(() => processBatch(batch))
).run();
```

## Testing Patterns

### Mock Tasks

```typescript
class MockTask {
  static success<T>(value: T, delay: number = 0) {
    return FuturableTask
      .resolve(value)
      .delay(delay);
  }

  static failure(error: any, delay: number = 0) {
    return FuturableTask
      .reject(error)
      .delay(delay);
  }

  static flaky<T>(
    value: T,
    failureRate: number = 0.5
  ): FuturableTask<T> {
    return FuturableTask.of(() => {
      if (Math.random() < failureRate) {
        throw new Error('Random failure');
      }
      return value;
    });
  }
}

// Usage in tests
const mockAPI = MockTask.success({ id: 1 }, 100);
const result = await mockAPI.run();
```

### Test Utilities

```typescript
async function expectTaskToSucceed<T>(
  task: FuturableTask<T>,
  expected: T
) {
  const result = await task.runSafe();
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data).toEqual(expected);
  }
}

async function expectTaskToFail(
  task: FuturableTask<any>,
  errorMessage?: string
) {
  const result = await task.runSafe();
  expect(result.success).toBe(false);
  if (!result.success && errorMessage) {
    expect(result.error.message).toBe(errorMessage);
  }
}
```

## See Also

- [Composition Guide](/guide-task/composition)
- [Error Handling](/guide-task/error-handling)
- [Concurrency](/guide-task/concurrency)
- [Timing](/guide-task/timing)