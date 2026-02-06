# FuturableUtils

Utility object provided to the executor function.

## Type Definition

```typescript
interface FuturableUtils<T> {
  signal: AbortSignal;
  cancel: () => void;
  onCancel: (cb: () => void) => void;
  sleep: (timer: number) => FuturableLike<void>;
  delay: <TResult>(cb: () => TResult, timer: number) => FuturableLike<TResult>;
  fetch: (url: string, opts?: RequestInit) => Futurable<Response>;
  futurizable: <TResult>(promise: Promise<TResult>) => Futurable<TResult>;
}
```

## Properties

- `signal` - Internal AbortSignal for cancellation
- `cancel` - Cancel the futurable
- `onCancel` - Register cancellation callback
- `sleep` - Pause execution
- `delay` - Delay with callback
- `fetch` - Make cancellable request
- `futurizable` - Convert Promise to Futurable

## See Also

- [Constructor](/api/constructor)
