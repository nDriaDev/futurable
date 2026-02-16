# FuturableTask: Lazy Computation

`FuturableTask` is a powerful abstraction for lazy async computation in Futurable. While `Futurable` extends Promise and executes eagerly, `FuturableTask` provides lazy evaluation with functional composition capabilities.

## What is FuturableTask?

`FuturableTask` is a **lazy computation wrapper** that represents an async operation that hasn't executed yet. Think of it as a recipe or blueprint that defines what should happen, but doesn't actually cook the meal until you tell it to.

```typescript
import { FuturableTask } from '@ndriadev/futurable';

// Creating a task doesn't execute it
const task = FuturableTask.of(() => {
  console.log('Executing!');
  return fetch('/api/data');
});
// Nothing logged yet, no fetch made

// Execution happens only when you call run()
const result = await task.run(); // Now it executes
```

## Key Differences: Futurable vs FuturableTask

| Feature | Futurable | FuturableTask |
|---------|-----------|---------------|
| **Execution** | Eager (immediate) | Lazy (on demand) |
| **Reusability** | Single use | Multiple independent runs |
| **Composition** | Via `.then()` chains | Via functional methods |
| **Side Effects** | Immediate on creation | Only on `.run()` |
| **Base** | Extends Promise | Independent class |

### When to use Futurable?

Use `Futurable` when you want Promise-like behavior with cancellation:
- Drop-in Promise replacement
- React/Vue effects cleanup
- Immediate execution needed
- Working with Promise APIs

### When to use FuturableTask?

Use `FuturableTask` when you need:
- Lazy evaluation
- Multiple executions of the same operation
- Complex functional composition
- Advanced patterns (retry, debounce, memoization)
- Concurrency control

## Core Philosophy

### Lazy Evaluation

Tasks don't execute until you call `.run()`:

```typescript
// Define what should happen (no execution)
const fetchUsers = FuturableTask
  .of(() => fetch('/api/users'))
  .map(res => res.json())
  .map(users => users.filter(u => u.active));

// Execute when needed
const users = await fetchUsers.run();

// Execute again (independent run)
const moreUsers = await fetchUsers.run();
```

### Functional Composition

Build complex pipelines with pure functions:

```typescript
const pipeline = FuturableTask
  .of(() => readFile('data.json'))
  .map(JSON.parse)
  .map(data => data.items)
  .filter(items => items.length > 0)
  .map(items => items.map(processItem))
  .retry(3)
  .timeout(5000);

// All transformations happen during execution
const result = await pipeline.run();
```

### Separation of Definition and Execution

Define your logic once, execute when and where needed:

```typescript
// Define reusable tasks
const fetchUserById = (id: number) =>
  FuturableTask
    .of(() => fetch(`/api/users/${id}`))
    .map(res => res.json())
    .retry(3)
    .timeout(5000);

// Use in different contexts
async function loadUserProfile(userId: number) {
  const user = await fetchUserById(userId).run();
  return user;
}

async function loadMultipleUsers(ids: number[]) {
  const tasks = ids.map(fetchUserById);
  const users = await FuturableTask.parallel(tasks).run();
  return users;
}
```

## Basic Concepts

### Creating Tasks

Multiple ways to create a `FuturableTask`:

```typescript
// From a sync function
const task1 = FuturableTask.of(() => 42);

// From an async function
const task2 = FuturableTask.of(async () => {
  const res = await fetch('/api/data');
  return res.json();
});

// From a Futurable
const futurable = Futurable.fetch('/api/data');
const task3 = FuturableTask.from(futurable);

// From the constructor
const task4 = new FuturableTask((resolve, reject, utils) => {
  setTimeout(() => resolve('done'), 1000);
});

// Static constructors
const task5 = FuturableTask.resolve('value');
const task6 = FuturableTask.reject(new Error('failed'));
```

### Running Tasks

Execute tasks with `.run()`:

```typescript
const task = FuturableTask.of(() => fetch('/api/data'));

// Simple run
const result1 = await task.run();

// Run with external signal
const controller = new AbortController();
const result2 = await task.run(controller.signal);

// Run safely (returns Result type)
const result3 = await task.runSafe();
if (result3.success) {
  console.log(result3.data);
} else {
  console.error(result3.error);
}
```

### Transforming Tasks

Transform results with functional methods:

```typescript
const task = FuturableTask
  .of(() => fetch('/api/users'))
  .map(res => res.json())                    // Transform
  .map(users => users.filter(u => u.active)) // Chain transformations
  .flatMap(users =>                          // Flatten nested tasks
    FuturableTask.of(() => enrichUsers(users))
  );
```

## Comparison Examples

### Promise vs Futurable vs FuturableTask

```typescript
// ❌ Promise: Executes immediately
const promise = fetch('/api/data')
  .then(res => res.json());
// Fetch already started!

// ✅ Futurable: Executes immediately but cancellable
const futurable = Futurable.fetch('/api/data')
  .then(res => res.json());
// Fetch already started!
futurable.cancel(); // Can cancel

// ✅ FuturableTask: Lazy, cancellable, reusable
const task = FuturableTask
  .of(() => fetch('/api/data'))
  .map(res => res.json());
// Nothing executed yet!

const result1 = await task.run(); // Now it executes
const result2 = await task.run(); // Executes again independently
task.cancel(); // Cancel all future runs
```

## Benefits

### 1. No Premature Execution

```typescript
// With Promise - executes immediately
function createPromise() {
  console.log('Executing!');
  return Promise.resolve(42);
}
const p = createPromise(); // Logs "Executing!" right away

// With FuturableTask - lazy
function createTask() {
  return FuturableTask.of(() => {
    console.log('Executing!');
    return 42;
  });
}
const t = createTask(); // Nothing logged
await t.run(); // Logs "Executing!" only now
```

### 2. Reusability

```typescript
// Promise - single use
const promise = fetch('/api/data');
await promise; // First use
await promise; // Same result (cached)

// FuturableTask - multiple independent executions
const task = FuturableTask.of(() => fetch('/api/data'));
await task.run(); // First execution
await task.run(); // Second independent execution
```

### 3. Composition Before Execution

```typescript
// Build complex pipelines without executing
const basePipeline = FuturableTask
  .of(() => fetch('/api/data'))
  .map(res => res.json());

// Extend the pipeline
const pipelineWithRetry = basePipeline.retry(3);
const pipelineWithTimeout = basePipeline.timeout(5000);
const pipelineWithBoth = basePipeline.retry(3).timeout(5000);

// Execute only the one you need
const result = await pipelineWithBoth.run();
```

### 4. Better Testing

```typescript
// Easy to test without execution
describe('Task Pipeline', () => {
  it('should compose correctly', () => {
    const task = FuturableTask
      .of(() => fetch('/api/data'))
      .map(res => res.json())
      .map(data => data.users);

    // Can inspect the task structure without running it
    expect(task).toBeDefined();
  });

  it('should execute correctly', async () => {
    // Mock the fetch
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ users: [] })))
    );

    const task = FuturableTask
      .of(() => fetch('/api/data'))
      .map(res => res.json())
      .map(data => data.users);

    const result = await task.run();
    expect(result).toEqual([]);
  });
});
```

## Next Steps

Explore the different capabilities of FuturableTask:

- [Functional Composition](/guide-task/composition) - Transform and chain tasks
- [Error Handling](/guide-task/error-handling) - Retry, catchError, and fallback
- [Concurrency Control](/guide-task/concurrency) - Limit, debounce, and throttle
- [Advanced Patterns](/guide-task/advanced-patterns) - Complex workflows
- [API Reference](/api-task/constructor) - Complete API documentation
