# FuturableExecutor

The executor function type for creating Futurables.

## Type Definition

```typescript
type FuturableExecutor<T> = (
  resolve: (value: T | FuturableLike<T> | PromiseLike<T>) => void,
  reject: (reason?: any) => void,
  utils: FuturableUtils<T>
) => void
```

## Example

```typescript
const executor: FuturableExecutor<string> = (resolve, reject, { signal }) => {
  setTimeout(() => resolve('Done'), 1000);
  
  signal.addEventListener('abort', () => {
    reject(new Error('Cancelled'));
  });
};

const futurable = new Futurable(executor);
```

## See Also

- [Constructor](/api/constructor)
- [FuturableUtils](/api/types/utils)
