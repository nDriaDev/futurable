# FuturableTask.try()

Creates a lazy FuturableTask from any callback — synchronous, asynchronous, returning or throwing.

## Syntax

```typescript
FuturableTask.try&lt;T&gt;(func: () =&gt; T | Promise&lt;T&gt;, signal?: AbortSignal): FuturableTask&lt;T&gt;
```

## Parameters

### `func`

A function of any kind. It may:

- Return a plain value synchronously
- Throw synchronously
- Return a `Promise` or be an `async` function

### `signal` (optional)

An `AbortSignal` that, when aborted, will cancel the task.

## Return Value

A new `FuturableTask<T>`. The function is **not invoked** until `run()` is called.

## Description

`FuturableTask.try()` is the lazy counterpart of `Futurable.try()`. Like all `FuturableTask` factory methods, it does not execute anything at creation time. Execution happens only when `run()` is called, and each `run()` invokes the callback independently.

The key difference from `FuturableTask.of()` is that `try()` wraps the callback in a `try/catch`, so synchronous errors are turned into rejections automatically — matching the semantics of `Promise.try()`. With `of()`, synchronous errors in the function body are also caught (via the executor's `async` wrapper), but `try()` makes this contract explicit and mirrors the standard API surface.

Use `FuturableTask.try()` when:

- The function may be synchronous or asynchronous and you want a unified interface
- You want to mirror `Promise.try()` semantics in a lazy task pipeline
- You need the function's synchronous exceptions to be captured as rejections from the first `run()`

## Examples

### Basic Usage

```typescript
import { FuturableTask } from '@ndriadev/futurable';

// Sync function — error captured on run()
const task = FuturableTask.try(() =&gt; JSON.parse(rawInput));
const result = await task.runSafe();

if (result.success) {
  console.log('Parsed:', result.data);
} else {
  console.error('Parse error:', result.error);
}
```

### Async Functions

```typescript
const task = FuturableTask.try(async () =&gt; {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
});

await task.run();
```

### Composing in a Pipeline

```typescript
function buildPipeline(action: () =&gt; unknown) {
  return FuturableTask.try(action)
    .map(result =&gt; transform(result))
    .retry(3)
    .timeout(5000);
}

// Works regardless of whether action is sync or async
const syncTask = buildPipeline(() =&gt; loadFromCache());
const asyncTask = buildPipeline(async () =&gt; fetchFromAPI());
```

### Lazy Evaluation Confirmed

```typescript
const fn = vi.fn(() =&gt; computeExpensiveValue());

const task = FuturableTask.try(fn);
// fn has NOT been called yet

const value = await task.run(); // fn is called here
const value2 = await task.run(); // fn is called again (independent execution)
```

### With External Signal

```typescript
const controller = new AbortController();
const task = FuturableTask.try(() =&gt; heavyComputation(), controller.signal);

task.run();
controller.abort(); // cancels the execution
```

### runSafe() Integration

```typescript
const tasks = [input1, input2, input3].map(raw =&gt;
  FuturableTask.try(() =&gt; JSON.parse(raw))
);

const results = await FuturableTask.allSettled(tasks).run();

results.forEach((r, i) =&gt; {
  if (r.status === 'fulfilled') {
    console.log(`Input ${i}: parsed`, r.value);
  } else {
    console.log(`Input ${i}: invalid JSON`);
  }
});
```

## Comparison with `FuturableTask.of()`

Both `try()` and `of()` accept functions and produce lazy tasks. The distinction is subtle:

| | `FuturableTask.of(fn)` | `FuturableTask.try(fn)` |
|---|---|---|
| Lazy? | ✅ | ✅ |
| Catches sync throws? | ✅ (via explicit try/catch) | ✅ (via explicit try/catch) |
| Mirrors `Promise.try()` API? | ❌ | ✅ |
| Works with plain values? | ✅ | ❌ (only functions) |
| Receives `FuturableUtils`? | ✅ | ❌ |

Prefer `try()` when mirroring `Promise.try()` patterns. Prefer `of()` when you need access to `utils` (signal, delay, fetch, etc.) or when passing a plain value directly.

## Notes

- The callback is invoked **lazily** — only when `run()` is called
- Each `run()` creates an independent execution
- Synchronous exceptions are captured as rejections
- Cancellation via `signal` works as with any other `FuturableTask`

## See Also

- [of()](/api-task/of) — general-purpose task factory (with utils access)
- [runSafe()](/api-task/run-safe) — run and get a SafeResult instead of throwing
- [Futurable.try()](/api/static-try) — eager equivalent for Futurable
- [resolve()](/api-task/resolve) — wrap a known value
- [reject()](/api-task/reject) — create a pre-rejected task
