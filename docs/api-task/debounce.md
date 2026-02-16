# debounce()

Delay execution until after a period of inactivity.

## Syntax

```typescript
task.debounce(delayMs: number): FuturableTask&lt;T&gt;
```

## Parameters

### `delayMs`
Milliseconds to wait after the last call.

## Examples

```typescript
const searchTask = FuturableTask
  .of((query: string) =&gt; searchAPI(query))
  .debounce(300);

// User types rapidly
searchTask.run('a');   // Cancelled
searchTask.run('ab');  // Cancelled
searchTask.run('abc'); // Executes after 300ms
```

### Auto-Save

```typescript
const autoSave = FuturableTask
  .of((data: FormData) =&gt; saveToServer(data))
  .debounce(1000);

formInput.addEventListener('input', () =&gt; {
  autoSave.run(getFormData());
});
```

## See Also

- [delay()](/api-task/delay)
- [Concurrency Guide](/guide-task/concurrency)
