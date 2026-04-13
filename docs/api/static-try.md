# Futurable.try()

Wraps any callback — synchronous, asynchronous, throwing or returning — into a Futurable.

## Syntax

```typescript
// With optional cancellation signal
Futurable.try<T>(func: () => T | PromiseLike<T> | FuturableLike<T>, signal?: AbortSignal): Futurable<Awaited<T>>

// With arguments forwarded to the callback (Promise.try-compatible)
Futurable.try<T, U extends unknown[]>(func: (...args: U) => T | PromiseLike<T> | FuturableLike<T>, ...args: U): Futurable<Awaited<T>>
```

## Parameters

### `func`

A function of any kind. It may:

- Return a plain value synchronously
- Throw synchronously
- Return a `Promise` or `Futurable`
- Be an `async` function (which may throw or resolve)

### `signal` (optional)

An `AbortSignal` to link cancellation of the returned Futurable to an external controller.
If provided, it must be passed as the **last argument**. See the [Notes](#notes) section for the known limitation this introduces.

### `...args` (optional)

Arguments forwarded to `func`. If the last argument is an `AbortSignal`, it is intercepted
as a cancellation signal and **not** passed to `func`.

### Comparison

| Approach | Catches sync throws? | Calls fn synchronously? |
|---|---|---|
| `Futurable.resolve(fn())` | ❌ | ✅ |
| `Futurable.resolve().then(fn)` | ✅ | ❌ |
| `new Futurable(res =&gt; res(fn()))` | ✅ | ✅ |
| **`Futurable.try(fn)`** | ✅ | ✅ |

## Notes

- `func` is called **synchronously** at the moment `Futurable.try()` is invoked
- Synchronous `throw` inside `func` becomes a rejected Futurable
- Returning a rejected `Promise` also produces a rejected Futurable
- The return type is always `Futurable<Awaited<T>>` — nested Promises are unwrapped automatically
- Cancellation via `signal` works as with any other Futurable, but must be passed as the **last argument**
- **Known limitation:** if your callback intentionally expects an `AbortSignal` as its last parameter, it will be intercepted as a cancellation signal and not forwarded to `func`. Close over the signal manually instead:
```typescript
  const mySignal = controller.signal;

  // ❌ mySignal is intercepted, NOT passed to the callback
  Futurable.try((signal) => myFn(signal), mySignal);

  // ✅ correct approach
  Futurable.try(() => myFn(mySignal));
```
- This method mirrors the `Promise.try()` TC39 proposal (Stage 4, ES2026)

## Examples

### Basic Usage

```typescript
import { Futurable } from '@ndriadev/futurable';

// Works with sync functions
const a = await Futurable.try(() =&gt; 42);
// 42

// Works with async functions
const b = await Futurable.try(async () =&gt; {
  const res = await fetch('/api/data');
  return res.json();
});

// Catches synchronous throws
const c = await Futurable.try(() =&gt; {
  throw new Error('oops');
}).catch(err =&gt; 'recovered');
// 'recovered'
```

### Unifying Sync and Async Callbacks

```typescript
function execute(action: () =&gt; unknown) {
  return Futurable.try(action)
    .then(result =&gt; console.log('Result:', result))
    .catch(error =&gt; console.error('Error:', error))
    .finally(() =&gt; console.log('Done'));
}

execute(() =&gt; 'sync value');
execute(() =&gt; { throw new Error('sync error'); });
execute(async () =&gt; 'async value');
execute(async () =&gt; { throw new Error('async error'); });
```

### Safe JSON Parsing

```typescript
const result = await Futurable.try(() =&gt; JSON.parse(rawInput))
  .safe();

if (result.success) {
  console.log('Parsed:', result.data);
} else {
  console.error('Invalid JSON:', result.error);
}
```

### With Cancellation

```typescript
const controller = new AbortController();

const futurable = Futurable.try(
  () =&gt; fetch('/api/slow').then(r =&gt; r.json()),
  controller.signal
);

// Cancel after 2 seconds
setTimeout(() =&gt; controller.abort(), 2000);

await futurable.catch(() =&gt; console.log('Cancelled or errored'));
```

### Chaining with Other Methods

```typescript
const result = await Futurable.try(() =&gt; loadConfig())
  .then(config =&gt; validateConfig(config))
  .then(config =&gt; applyConfig(config))
  .safe();

if (!result.success) {
  console.error('Config error:', result.error);
}
```

## Notes

- `func` is called **synchronously** at the moment `Futurable.try()` is invoked
- Synchronous `throw` inside `func` becomes a rejected Futurable
- Returning a rejected `Promise` also produces a rejected Futurable
- Cancellation via `signal` works as with any other Futurable
- This method mirrors the `Promise.try()` TC39 proposal (Stage 4, ES2026)

## See Also

- [safe()](/api/safe) — resolve to a result object instead of throwing
- [futurizable()](/api/futurizable) — convert an existing Promise into a Futurable
- [Static: resolve()](/api/static-resolve) — wrap a known value
- [FuturableTask.try()](/api-task/try) — lazy equivalent for FuturableTask
