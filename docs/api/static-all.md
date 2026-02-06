# Futurable.all()

Wait for all futurables to complete.

## Syntax

```typescript
Futurable.all<T>(values: Iterable<T | PromiseLike<T> | FuturableLike<T>>): Futurable<T[]>
```

## Example

```typescript
const results = await Futurable.all([
  Futurable.fetch('/api/users'),
  Futurable.fetch('/api/posts'),
  Futurable.fetch('/api/comments')
]);

// Cancel all at once
results.cancel();
```

## See Also

- [Promise.all()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
