# Futurable.allSettled()

Wait for all promises to settle.

## Syntax

```typescript
Futurable.allSettled<T>(values: Iterable<T>): Futurable<PromiseSettledResult<T>[]>
```

## Example

```typescript
const results = await Futurable.allSettled([
  Futurable.fetch('/api/users'),
  Futurable.fetch('/api/posts')
]);
```

## See Also

- [Promise.allSettled()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)
