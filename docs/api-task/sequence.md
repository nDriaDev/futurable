# FuturableTask.sequence()

Execute tasks one after another, in order.

## Syntax

```typescript
FuturableTask.sequence&lt;T&gt;(
  tasks: FuturableTask&lt;T&gt;[],
  signal?: AbortSignal
): FuturableTask&lt;T[]&gt;
```

## Parameters

### `tasks`
Array of tasks to execute sequentially.

### `signal` (optional)
AbortSignal for cancellation.

## Examples

```typescript
const tasks = [
  FuturableTask.of(() =&gt; step1()),
  FuturableTask.of(() =&gt; step2()),
  FuturableTask.of(() =&gt; step3())
];

const results = await FuturableTask
  .sequence(tasks)
  .run();
```

### Database Migrations

```typescript
const migrations = [
  FuturableTask.of(() =&gt; migrateSchema1()),
  FuturableTask.of(() =&gt; migrateSchema2()),
  FuturableTask.of(() =&gt; migrateSchema3())
];

await FuturableTask.sequence(migrations).run();
```

## See Also

- [parallel()](/api-task/parallel)
- [traverse()](/api-task/traverse)