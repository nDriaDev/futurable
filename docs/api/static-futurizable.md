# Futurable.futurizable()

Convert any promise to futurable.

## Syntax

```typescript
Futurable.futurizable<T>(promise: Promise<T>): Futurable<T>
```

## Example

```typescript
const regularPromise = fetch('/api/data');
const futurable = Futurable.futurizable(regularPromise);

// Now it's cancellable
futurable.cancel();
```

## See Also

- [futurizable()](/api/futurizable)
