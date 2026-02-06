# futurizable()

Convert a Promise into a Futurable.

## Syntax

```typescript
futurable.futurizable<T>(promise: Promise<T>): Futurable<T>
```

## Example

```typescript
const futurable = new Futurable((resolve, reject, { futurizable }) => {
  const promise = fetch('/api/data');
  futurizable(promise)
    .then(r => r.json())
    .then(resolve)
    .catch(reject);
});
```

## See Also

- [Futurable.futurizable()](/api/static-futurizable)
- [Constructor](/api/constructor)
