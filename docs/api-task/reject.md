# FuturableTask.reject()

Create a task that immediately fails with an error.

## Syntax

```typescript
FuturableTask.reject&lt;T = never&gt;(reason: any): FuturableTask&lt;T&gt;
```

## Parameters

### `reason`
The error or reason for rejection.

## Return Value

A `FuturableTask&lt;T&gt;` that fails with the provided reason.

## Description

Creates a task that immediately fails when executed. Useful for error handling chains, testing, or representing known error states.

## Examples

### Basic Usage

```typescript
const task = FuturableTask.reject(new Error('Failed'));

try {
  await task.run();
} catch (error) {
  console.log(error.message); // "Failed"
}
```

### Error Handling Chain

```typescript
const task = FuturableTask
  .reject(new Error('Primary failed'))
  .fallbackTo(() =&gt; fallbackValue);

const result = await task.run(); // fallbackValue
```

### Conditional Errors

```typescript
const validateTask = (data: any) =&gt;
  data.valid
    ? FuturableTask.resolve(data)
    : FuturableTask.reject(new Error('Invalid data'));
```

### Testing Error Paths

```typescript
// Test error handling in your application
const mockError = FuturableTask.reject(
  new Error('Network error')
);

const result = await mockError.runSafe();
expect(result.success).toBe(false);
```

### With orElse

```typescript
const task = FuturableTask
  .reject(new Error('First attempt'))
  .orElse(() =&gt; FuturableTask.of(() =&gt; secondAttempt()))
  .orElse(() =&gt; FuturableTask.resolve(defaultValue));
```

## See Also

- [resolve()](/api-task/resolve) - Create a successful task
- [fallbackTo()](/api-task/fallback-to) - Handle errors
- [orElse()](/api-task/or-else) - Alternative tasks