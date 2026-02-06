# FuturableLike

Promise-like interface for Futurable.

## Type Definition

```typescript
interface FuturableLike<T> {
  then<TResult1, TResult2>(
    onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1> | FuturableLike<TResult1>,
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2> | FuturableLike<TResult2>
  ): FuturableLike<TResult1 | TResult2>;
}
```

## Description

This interface allows Futurable to be used anywhere a Promise is expected.

## See Also

- [Constructor](/api/constructor)
