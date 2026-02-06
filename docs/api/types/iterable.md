# FuturableIterable

Iterable type for Futurable collections.

## Type Definition

```typescript
type FuturableIterable<T = any> = Iterable<FuturableLike<T> | PromiseLike<T> | T>
```

## Example

```typescript
const items: FuturableIterable<number> = [
  Futurable.resolve(1),
  Promise.resolve(2),
  3
];

const results = await Futurable.all(items);
```

## See Also

- [Futurable.all()](/api/static-all)
- [Futurable.race()](/api/static-race)
