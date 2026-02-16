# Functional Composition

FuturableTask provides a rich set of functional methods for transforming and composing async operations. These methods allow you to build complex pipelines in a declarative, functional style.

## Core Transformation Methods

### map()

Transform the result of a task with a function.

```typescript
const task = FuturableTask
  .of(() => fetch('/api/users'))
  .map(res => res.json())                    // Parse JSON
  .map(users => users.filter(u => u.active)) // Filter active users
  .map(users => users.length);               // Get count

const count = await task.run(); // 42
```

**Signature:**
```typescript
map<U>(fn: (value: T) => U | Promise<U>): FuturableTask<U>
```

**Examples:**
```typescript
// Sync transformation
FuturableTask.of(() => 5)
  .map(x => x * 2)
  .run(); // 10

// Async transformation
FuturableTask.of(() => 'user-123')
  .map(async id => await fetchUser(id))
  .run(); // User object

// Chaining transformations
FuturableTask.of(() => [1, 2, 3, 4, 5])
  .map(arr => arr.filter(x => x > 2))  // [3, 4, 5]
  .map(arr => arr.map(x => x * 2))     // [6, 8, 10]
  .map(arr => arr.reduce((a, b) => a + b, 0)) // 24
  .run();
```

### flatMap()

Transform the result to another task and flatten the result.

```typescript
const getUserPosts = (userId: number) =>
  FuturableTask.of(() => fetch(`/api/users/${userId}/posts`))
    .map(res => res.json());

const task = FuturableTask
  .of(() => fetch('/api/current-user'))
  .map(res => res.json())
  .flatMap(user => getUserPosts(user.id));

const posts = await task.run();
```

**Signature:**
```typescript
flatMap<U>(fn: (value: T) => FuturableTask<U>): FuturableTask<U>
```

**Use Cases:**
```typescript
// Sequential dependent operations
const enrichUser = FuturableTask
  .of(() => fetchUser(123))
  .flatMap(user =>
    FuturableTask.of(() => fetchUserSettings(user.id))
      .map(settings => ({ ...user, settings }))
  );

// Conditional task execution
FuturableTask.of(() => checkCache(key))
  .flatMap(cached =>
    cached
      ? FuturableTask.resolve(cached)
      : FuturableTask.of(() => fetchFromAPI(key))
  );
```

### filter()

Conditionally succeed or fail based on a predicate.

```typescript
const task = FuturableTask
  .of(() => fetch('/api/user'))
  .map(res => res.json())
  .filter(user => user.age >= 18); // Fails if user is under 18

try {
  const adult = await task.run();
} catch (error) {
  console.log('User is not an adult');
}
```

**Signature:**
```typescript
filter(predicate: (value: T) => boolean | Promise<boolean>): FuturableTask<T>
```

**Examples:**
```typescript
// Sync predicate
FuturableTask.of(() => 42)
  .filter(x => x > 0)
  .run(); // 42

FuturableTask.of(() => -5)
  .filter(x => x > 0)
  .run(); // Throws Error

// Async predicate
FuturableTask.of(() => fetchUser(123))
  .filter(async user => await hasPermission(user))
  .run();

// With custom error message
FuturableTask.of(() => fetchAge())
  .filter(age => age >= 18, 'Must be 18 or older')
  .run();
```

### ap()

Apply a task of functions to a task of values (applicative functor pattern).

```typescript
const add = (a: number) => (b: number) => a + b;

const taskFn = FuturableTask.of(() => add(5));
const taskValue = FuturableTask.of(() => 10);

const result = taskValue.ap(taskFn);
await result.run(); // 15
```

**Signature:**
```typescript
ap<U, V>(taskFn: FuturableTask<(value: T) => U>): FuturableTask<U>
```

**Use Cases:**
```typescript
// Parallel operations with function application
const multiply = (a: number) => (b: number) => (c: number) => a * b * c;

const result = FuturableTask.of(() => 2)
  .ap(FuturableTask.of(() => multiply(3)))
  .ap(FuturableTask.of(() => 4));

await result.run(); // 24
```

## Side Effect Methods

### tap()

Perform side effects without changing the result.

```typescript
const task = FuturableTask
  .of(() => fetch('/api/data'))
  .map(res => res.json())
  .tap(data => console.log('Received:', data)) // Log without changing
  .map(data => data.items);

const items = await task.run();
```

**Signature:**
```typescript
tap(fn: (value: T) => void | Promise<void>): FuturableTask<T>
```

**Examples:**
```typescript
// Logging
FuturableTask.of(() => expensiveOperation())
  .tap(result => console.log('Result:', result))
  .tap(result => logger.info('Computed:', result))
  .map(result => result.value)
  .run();

// Progress tracking
const processLargeFile = FuturableTask
  .of(() => readFile('large.dat'))
  .tap(data => updateProgress(33))
  .map(data => parseData(data))
  .tap(parsed => updateProgress(66))
  .map(parsed => transformData(parsed))
  .tap(transformed => updateProgress(100));

// Caching side effect
FuturableTask.of(() => fetchExpensiveData())
  .tap(data => cache.set('key', data))
  .run();
```

### tapError()

Perform side effects on errors without changing the error.

```typescript
const task = FuturableTask
  .of(() => riskyOperation())
  .tapError(err => console.error('Error occurred:', err))
  .tapError(err => logger.error(err))
  .fallbackTo(err => fallbackValue);
```

**Signature:**
```typescript
tapError(fn: (error: any) => void | Promise<void>): FuturableTask<T>
```

**Examples:**
```typescript
// Error logging
FuturableTask.of(() => apiCall())
  .tapError(err => logger.error('API failed:', err))
  .retry(3);

// Error analytics
FuturableTask.of(() => complexOperation())
  .tapError(err => analytics.track('operation_failed', { error: err }))
  .fallbackTo(err => defaultValue);
```

## Composition Utilities

### bimap()

Map both success and error paths.

```typescript
const task = FuturableTask
  .of(() => riskyOperation())
  .bimap(
    result => ({ success: true, data: result }),
    error => ({ success: false, error: error.message })
  );

const outcome = await task.run();
```

**Signature:**
```typescript
bimap<U>(
  onSuccess: (value: T) => U | Promise<U>,
  onError: (error: any) => any
): FuturableTask<U>
```

### flatMap()

Chains this task with another task, creating a sequential composition.

```typescript
const task = FuturableTask
  .of(() => getUserId())
  .flatMap(id => FuturableTask.of(() => fetchUser(id)))
  .flatMap(user => FuturableTask.of(() => enrichUser(user)));
```

## Combining Multiple Tasks

### zip()

Combine two tasks into a tuple.

```typescript
const task1 = FuturableTask.of(() => fetch('/api/users'));
const task2 = FuturableTask.of(() => fetch('/api/posts'));

const combined = task1.zip(task2);
const [users, posts] = await combined.run();
```

**Signature:**
```typescript
zip<U>(other: FuturableTask<U>): FuturableTask<[T, U]>
```

**Examples:**
```typescript
// Parallel data fetching
const userTask = FuturableTask.fetch('/api/user');
const settingsTask = FuturableTask.fetch('/api/settings');

const [user, settings] = await userTask
  .zip(settingsTask)
  .map(([u, s]) => [u.json(), s.json()])
  .run();

// Multiple zips
const result = task1
  .zip(task2)
  .zip(task3)
  .map(([[a, b], c]) => ({ a, b, c }))
  .run();
```

### zipWith()

Combine two tasks with a custom function.

```typescript
const task1 = FuturableTask.of(() => 5);
const task2 = FuturableTask.of(() => 3);

const sum = task1.zipWith(task2, (a, b) => a + b);
await sum.run(); // 8
```

**Signature:**
```typescript
zipWith<U, V>(
  other: FuturableTask<U>,
  fn: (a: T, b: U) => V | Promise<V>
): FuturableTask<V>
```

**Examples:**
```typescript
// Combine user and permissions
const userTask = FuturableTask.of(() => fetchUser(123));
const permsTask = FuturableTask.of(() => fetchPermissions(123));

const userWithPerms = userTask.zipWith(
  permsTask,
  (user, permissions) => ({ ...user, permissions })
);

// Mathematical operations
const width = FuturableTask.of(() => getWidth());
const height = FuturableTask.of(() => getHeight());

const area = width.zipWith(height, (w, h) => w * h);
```

## Sequential Composition

### andThen()

Execute another task after this one completes, ignoring this task's result.

```typescript
const task = FuturableTask
  .of(() => saveData(data))
  .andThen(FuturableTask.of(() => sendNotification()))
  .andThen(FuturableTask.of(() => updateUI()));

await task.run();
```

**Signature:**
```typescript
andThen<U>(next: FuturableTask<U>): FuturableTask<U>
```

**Examples:**
```typescript
// Sequential operations
FuturableTask.of(() => createUser(userData))
  .andThen(FuturableTask.of(() => sendWelcomeEmail()))
  .andThen(FuturableTask.of(() => logUserCreation()))
  .run();

// Cleanup sequences
FuturableTask.of(() => processFile())
  .andThen(FuturableTask.of(() => moveToArchive()))
  .andThen(FuturableTask.of(() => deleteTemp()))
  .run();
```

## Practical Examples

### Building a Data Pipeline

```typescript
const dataPipeline = FuturableTask
  .of(() => readCSVFile('data.csv'))
  .tap(raw => console.log(`Read ${raw.length} bytes`))
  .map(parseCSV)
  .tap(rows => console.log(`Parsed ${rows.length} rows`))
  .map(rows => rows.filter(row => row.valid))
  .tap(filtered => console.log(`Filtered to ${filtered.length} rows`))
  .map(rows => rows.map(transformRow))
  .tap(transformed => console.log('Transformation complete'))
  .flatMap(rows => FuturableTask.of(() => writeToDatabase(rows)))
  .tap(() => console.log('Pipeline complete'));

const result = await dataPipeline.run();
```

### API Request with Transformations

```typescript
const fetchUserProfile = (userId: number) =>
  FuturableTask
    .fetch(`/api/users/${userId}`)
    .map(res => res.json())
    .filter(user => user.active)
    .flatMap(user =>
      FuturableTask.fetch(`/api/users/${user.id}/avatar`)
        .map(res => res.blob())
        .map(avatar => ({ ...user, avatar }))
    )
    .map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: URL.createObjectURL(user.avatar)
    }));

const profile = await fetchUserProfile(123).run();
```

### Complex Composition

```typescript
const complexWorkflow = FuturableTask
  .of(() => fetchInitialData())
  .map(data => validateData(data))
  .filter(data => data.isValid)
  .flatMap(data =>
    FuturableTask
      .of(() => enrichData(data))
      .retry(3)
      .timeout(5000)
  )
  .tap(enriched => cache.set('enriched', enriched))
  .map(enriched => transformForDisplay(enriched))
  .fallbackTo(error => {
    console.error('Workflow failed:', error);
    return defaultDisplayData;
  });

const result = await complexWorkflow.run();
```

## Best Practices

### 1. Keep Transformations Pure

```typescript
// ❌ Avoid mutations
FuturableTask.of(() => [1, 2, 3])
  .map(arr => {
    arr.push(4); // Mutation!
    return arr;
  });

// ✅ Return new values
FuturableTask.of(() => [1, 2, 3])
  .map(arr => [...arr, 4]); // New array
```

### 2. Use tap() for Side Effects

```typescript
// ❌ Side effects in map
FuturableTask.of(() => getData())
  .map(data => {
    console.log(data); // Side effect
    return data;
  });

// ✅ Use tap for side effects
FuturableTask.of(() => getData())
  .tap(data => console.log(data))
  .map(data => transformData(data));
```

### 3. Prefer flatMap for Nested Tasks

```typescript
// ❌ Nested tasks
FuturableTask.of(() => getUser())
  .map(user => FuturableTask.of(() => getPosts(user.id)))
  .run(); // Returns FuturableTask<FuturableTask<Post[]>>

// ✅ Use flatMap
FuturableTask.of(() => getUser())
  .flatMap(user => FuturableTask.of(() => getPosts(user.id)))
  .run(); // Returns Post[]
```

### 4. Compose Before Execution

```typescript
// ✅ Build pipeline first
const basePipeline = FuturableTask
  .of(() => fetchData())
  .map(data => processData(data));

// Extend as needed
const withRetry = basePipeline.retry(3);
const withTimeout = basePipeline.timeout(5000);
const withBoth = basePipeline.retry(3).timeout(5000);

// Execute only when needed
const result = await withBoth.run();
```

## Next Steps

- [Error Handling](/guide-task/error-handling) - fallbackTo from failures
- [Timing & Delays](/guide-task/timing) - Control execution timing
- [Concurrency](/guide-task/concurrency) - Manage parallel execution
- [API Reference: map()](/api-task/map) - Detailed API docs
