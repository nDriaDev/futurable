# Futurable.any()

Resolves when any futurable fulfills.

## Syntax

```typescript
Futurable.any<T>(values: Iterable<T>): Futurable<T>
```

## Example

```typescript
const fastest = await Futurable.any([
  Futurable.fetch('/api/server1'),
  Futurable.fetch('/api/server2')
]);
```

## See Also

- [Promise.any()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/any)
