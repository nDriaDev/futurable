# Concurrency Control

FuturableTask provides powerful tools to control how multiple async operations execute, including rate limiting, debouncing, throttling, and advanced parallel execution patterns.

## Rate Limiting

### createLimiter()

Create a limiter that restricts how many tasks can run concurrently.

```typescript
import { FuturableTask } from '@ndriadev/futurable';

// Allow max 3 concurrent tasks
const limiter = FuturableTask.createLimiter(3);

// Wrap tasks with the limiter
const tasks = urls.map(url =>
  limiter(FuturableTask.fetch(url))
);

// Only 3 will run at once
await FuturableTask.parallel(tasks).run();
```

**Signature:**
```typescript
createLimiter(
  concurrency: number,
  events?: LimiterEvents
): FuturableTaskLimiter
```

**Limiter Properties:**
```typescript
type FuturableTaskLimiter = {
  readonly activeCount: number;   // Currently running tasks
  readonly pendingCount: number;  // Tasks waiting to run
  readonly concurrency: number;   // Max concurrent tasks

  // Use as a function to wrap tasks
  <T>(task: FuturableTask<T>): FuturableTask<T>
};
```

### Basic Rate Limiting

```typescript
const limiter = FuturableTask.createLimiter(2);

console.log(limiter.concurrency);  // 2
console.log(limiter.activeCount);  // 0
console.log(limiter.pendingCount); // 0

const task1 = limiter(FuturableTask.of(() => slowOperation(1)));
const task2 = limiter(FuturableTask.of(() => slowOperation(2)));
const task3 = limiter(FuturableTask.of(() => slowOperation(3)));

// task1 and task2 start immediately
// task3 waits until one completes
await Promise.all([task1.run(), task2.run(), task3.run()]);
```

### With Event Monitoring

```typescript
const limiter = FuturableTask.createLimiter(3, {
  onActive: (task) => {
    console.log('Task started');
    console.log('Active:', limiter.activeCount);
    console.log('Pending:', limiter.pendingCount);
  },
  onCompleted: (result) => {
    console.log('Task completed:', result);
  },
  onError: (error) => {
    console.error('Task failed:', error);
  },
  onIdle: () => {
    console.log('All tasks finished, queue empty');
  }
});

const tasks = Array.from({ length: 10 }, (_, i) =>
  limiter(FuturableTask.of(() => processItem(i)))
);

await FuturableTask.parallel(tasks).run();
```

### Real-World Example: API Rate Limiting

```typescript
// Respect API rate limit of 5 requests per second
const apiLimiter = FuturableTask.createLimiter(5, {
  onActive: () => console.log(`Active: ${apiLimiter.activeCount}/5`),
  onIdle: () => console.log('All API calls complete')
});

const fetchUserData = (userId: number) =>
  apiLimiter(
    FuturableTask.fetch(`/api/users/${userId}`)
      .map(res => res.json())
      .retry(3)
  );

// Fetch 100 users, but only 5 requests at a time
const userIds = Array.from({ length: 100 }, (_, i) => i + 1);
const tasks = userIds.map(id => fetchUserData(id));

const users = await FuturableTask.parallel(tasks).run();
```

### File Processing Example

```typescript
const fileProcessor = FuturableTask.createLimiter(3, {
  onActive: (task) => updateProgress('Processing...'),
  onCompleted: (result) => console.log('Processed:', result.filename),
  onError: (error) => console.error('Failed:', error),
  onIdle: () => console.log('All files processed')
});

const processFiles = (filePaths: string[]) => {
  const tasks = filePaths.map(path =>
    fileProcessor(
      FuturableTask.of(() => readFile(path))
        .map(content => parseContent(content))
        .map(data => transformData(data))
        .tap(result => saveToDatabase(result))
    )
  );

  return FuturableTask.parallel(tasks);
};

await processFiles(files).run();
```

## Debouncing

### debounce()

Delay execution until after a period of inactivity.

```typescript
const searchTask = FuturableTask
  .of((query: string) => searchAPI(query))
  .debounce(300); // Wait 300ms after last call

// User types rapidly
searchTask.run('a');   // Cancelled
searchTask.run('ab');  // Cancelled
searchTask.run('abc'); // Executes after 300ms of no new calls
```

**Signature:**
```typescript
debounce(delayMs: number): FuturableTask<T>
```

**How It Works:**
- Multiple rapid calls cancel previous pending executions
- Only the last call executes after the delay period
- Perfect for user input handling

### Search Input Example

```typescript
import { FuturableTask } from '@ndriadev/futurable';

const searchUsers = FuturableTask
  .of((query: string) => fetch(`/api/users/search?q=${query}`))
  .map(res => res.json())
  .debounce(300);

// In your UI framework
function SearchBox() {
  const [results, setResults] = useState([]);

  const handleSearch = (query: string) => {
    if (!query) return;

    searchUsers.run(query)
      .then(setResults)
      .catch(console.error);
  };

  return (
    <input
      type="search"
      onChange={(e) => handleSearch(e.target.value)}
      placeholder="Search users..."
    />
  );
}
```

### Auto-Save Example

```typescript
const autoSave = FuturableTask
  .of((data: FormData) => saveToServer(data))
  .debounce(1000);

// User types
formInput.addEventListener('input', () => {
  const data = gatherFormData();
  autoSave.run(data); // Only saves after 1s of no changes
});
```

### Resize Handler Example

```typescript
const handleResize = FuturableTask
  .of(() => {
    recalculateLayout();
    updateCharts();
    reflowContent();
  })
  .debounce(150);

window.addEventListener('resize', () => {
  handleResize.run();
});
```

## Memoization

### memoize()

Cache the result of the first execution and reuse it.

```typescript
const expensiveTask = FuturableTask
  .of(() => expensiveComputation())
  .memoize();

const result1 = await expensiveTask.run(); // Executes
const result2 = await expensiveTask.run(); // Returns cached result
const result3 = await expensiveTask.run(); // Returns cached result
```

**Signature:**
```typescript
memoize(catchErrors?: boolean): FuturableTask<T>
```

**Options:**
- `catchErrors: false` (default) - Only cache successful results
- `catchErrors: true` - Cache both success and error results

### Basic Memoization

```typescript
let counter = 0;

const task = FuturableTask
  .of(() => {
    console.log('Computing...');
    return ++counter;
  })
  .memoize();

await task.run(); // Logs: "Computing...", returns 1
await task.run(); // Returns 1 (cached, no log)
await task.run(); // Returns 1 (cached, no log)
```

### Caching Success Only

```typescript
const fetchData = FuturableTask
  .of(() => fetch('/api/data'))
  .map(res => res.json())
  .memoize(); // Default: catchErrors = false

try {
  const data1 = await fetchData.run(); // May fail
} catch (error) {
  // Not cached
}

const data2 = await fetchData.run(); // Tries again
const data3 = await fetchData.run(); // Uses cached success
```

### Caching Errors Too

```typescript
const riskyOperation = FuturableTask
  .of(() => mightFail())
  .memoize(true); // Cache errors too

try {
  await riskyOperation.run(); // Fails
} catch (error) {
  // Error is cached
}

try {
  await riskyOperation.run(); // Returns cached error
} catch (error) {
  console.log('Cached error:', error);
}
```

### Use Cases

```typescript
// Configuration loading
const loadConfig = FuturableTask
  .of(() => fetch('/api/config'))
  .map(res => res.json())
  .memoize();

// Reference data
const getCountries = FuturableTask
  .of(() => fetch('/api/countries'))
  .map(res => res.json())
  .memoize();

// Expensive computation
const calculateStatistics = FuturableTask
  .of(() => {
    // Complex calculations...
    return computeStats(largeDataset);
  })
  .memoize();
```

## Parallel Execution

### parallel()

Execute multiple tasks concurrently, waiting for all to complete.

```typescript
const tasks = [
  FuturableTask.fetch('/api/users'),
  FuturableTask.fetch('/api/posts'),
  FuturableTask.fetch('/api/comments')
];

const [users, posts, comments] = await FuturableTask
  .parallel(tasks)
  .run();
```

**Signature:**
```typescript
static parallel<T>(
  tasks: FuturableTask<T>[],
  signal?: AbortSignal
): FuturableTask<T[]>
```

**Behavior:**
- All tasks start immediately
- Returns when all complete
- Fails if any task fails
- All tasks are cancelled if one fails

### With Rate Limiting

```typescript
const limiter = FuturableTask.createLimiter(5);

const tasks = urls.map(url =>
  limiter(FuturableTask.fetch(url))
);

const results = await FuturableTask.parallel(tasks).run();
```

### Parallel with Error Handling

```typescript
const tasks = ids.map(id =>
  FuturableTask
    .fetch(`/api/data/${id}`)
    .map(res => res.json())
    .fallbackTo(error => ({ id, error: error.message }))
);

const results = await FuturableTask.parallel(tasks).run();
// All results, even failed ones (as error objects)
```

## Sequential Execution

### sequence()

Execute tasks one after another, in order.

```typescript
const tasks = [
  FuturableTask.of(() => step1()),
  FuturableTask.of(() => step2()),
  FuturableTask.of(() => step3())
];

const results = await FuturableTask
  .sequence(tasks)
  .run();
```

**Signature:**
```typescript
static sequence<T>(
  tasks: FuturableTask<T>[],
  signal?: AbortSignal
): FuturableTask<T[]>
```

**Behavior:**
- Tasks execute one at a time
- Each task waits for the previous to complete
- Stops on first error
- Returns array of all results

### Use Cases

```typescript
// Database migrations
const migrations = [
  FuturableTask.of(() => migrateSchema1()),
  FuturableTask.of(() => migrateSchema2()),
  FuturableTask.of(() => migrateSchema3())
];

await FuturableTask.sequence(migrations).run();

// Multi-step workflow
const workflow = [
  FuturableTask.of(() => validateInput()),
  FuturableTask.of(() => processData()),
  FuturableTask.of(() => saveResults()),
  FuturableTask.of(() => sendNotification())
];

await FuturableTask.sequence(workflow).run();
```

## Advanced Patterns

### Race Conditions

```typescript
const fastest = await FuturableTask.race([
  FuturableTask.fetch('/api/server1/data'),
  FuturableTask.fetch('/api/server2/data'),
  FuturableTask.fetch('/api/server3/data')
]).run();

console.log('Fastest server responded:', fastest);
```

### Parallel with Limit

```typescript
async function parallelLimit<T>(
  tasks: FuturableTask<T>[],
  limit: number
): Promise<T[]> {
  const limiter = FuturableTask.createLimiter(limit);
  const limited = tasks.map(task => limiter(task));
  return FuturableTask.parallel(limited).run();
}

// Process 100 tasks, 10 at a time
const results = await parallelLimit(tasks, 10);
```

### Batch Processing

```typescript
function processBatches<T, U>(
  items: T[],
  batchSize: number,
  process: (batch: T[]) => FuturableTask<U>
): FuturableTask<U[]> {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const tasks = batches.map(batch => process(batch));
  return FuturableTask.sequence(tasks).map(results => results.flat());
}

// Process 1000 items in batches of 100
const results = await processBatches(
  items,
  100,
  batch => FuturableTask.of(() => processBatch(batch))
).run();
```

### Priority Queue

```typescript
class PriorityLimiter {
  private limiter: FuturableTaskLimiter;
  private queue: Array<{ task: FuturableTask<any>; priority: number }> = [];

  constructor(concurrency: number) {
    this.limiter = FuturableTask.createLimiter(concurrency);
  }

  add<T>(task: FuturableTask<T>, priority: number): FuturableTask<T> {
    return FuturableTask.of(async () => {
      this.queue.push({ task, priority });
      this.queue.sort((a, b) => b.priority - a.priority);

      const { task: nextTask } = this.queue.shift()!;
      return this.limiter(nextTask).run();
    });
  }
}

const priorityLimiter = new PriorityLimiter(3);

// High priority tasks run first
priorityLimiter.add(lowPriorityTask, 1);
priorityLimiter.add(highPriorityTask, 10);
priorityLimiter.add(mediumPriorityTask, 5);
```

### Worker Pool

```typescript
class WorkerPool<T, U> {
  private limiter: FuturableTaskLimiter;

  constructor(
    private workers: number,
    private worker: (item: T) => Promise<U>
  ) {
    this.limiter = FuturableTask.createLimiter(workers, {
      onActive: () => console.log(`Workers: ${this.limiter.activeCount}/${workers}`),
      onIdle: () => console.log('Pool idle')
    });
  }

  async process(items: T[]): Promise<U[]> {
    const tasks = items.map(item =>
      this.limiter(
        FuturableTask.of(() => this.worker(item))
      )
    );

    return FuturableTask.parallel(tasks).run();
  }
}

// Create a pool of 5 workers
const pool = new WorkerPool(5, async (file: string) => {
  return await processFile(file);
});

const results = await pool.process(files);
```

## Best Practices

### 1. Choose the Right Concurrency Model

```typescript
// ✅ Use parallel for independent operations
await FuturableTask.parallel([
  fetchUsers(),
  fetchPosts(),
  fetchComments()
]).run();

// ✅ Use sequence for dependent operations
await FuturableTask.sequence([
  validateInput(),
  processData(),
  saveResults()
]).run();

// ✅ Use limiter for rate-limited operations
const limiter = FuturableTask.createLimiter(5);
await FuturableTask.parallel(
  urls.map(url => limiter(fetch(url)))
).run();
```

### 2. Monitor Limiter State

```typescript
const limiter = FuturableTask.createLimiter(3, {
  onActive: () => {
    console.log(`Active: ${limiter.activeCount}`);
    console.log(`Pending: ${limiter.pendingCount}`);
  }
});
```

### 3. Debounce User Input

```typescript
// Always debounce user input
const search = FuturableTask
  .of((query: string) => searchAPI(query))
  .debounce(300);
```

### 4. Memoize Expensive Operations

```typescript
// Cache expensive computations
const config = FuturableTask
  .of(() => loadConfig())
  .memoize();

// Cache reference data
const countries = FuturableTask
  .of(() => fetchCountries())
  .memoize();
```

## Next Steps

- [Advanced Patterns](/guide-task/advanced-patterns) - Complex workflows
- [API Reference: createLimiter()](/api-task/create-limiter) - Limiter API
- [API Reference: debounce()](/api-task/debounce) - Debouncing API
- [API Reference: parallel()](/api-task/parallel) - Parallel execution
