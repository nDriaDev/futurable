# runSafe()

Execute the task without throwing errors, returning a Result type instead.

## Syntax

```typescript
task.runSafe(signal?: AbortSignal): Futurable&lt;SafeResult&lt;T&gt;&gt;
```

## Return Value

A Futurable that resolves to:
```typescript
type SafeResult&lt;T&gt; =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: any };
```

## Examples

```typescript
const result = await task.runSafe();

if (result.success) {
  console.log('Data:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### With Early Return

```typescript
async function fetchUser(id: number) {
  const result = await FuturableTask
    .fetch(`/api/users/${id}`)
    .map(res =&gt; res.json())
    .runSafe();

  if (!result.success) {
    console.error('Failed:', result.error);
    return null;
  }

  return result.data;
}
```

## See Also

- [run()](/api-task/run)
- [safe() for Futurable](/api/safe)