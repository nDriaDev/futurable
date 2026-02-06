# Futurable.withResolvers()

Create a futurable with external resolve/reject.

## Syntax

```typescript
Futurable.withResolvers<T>(): { 
  promise: Futurable<T>, 
  resolve: (value: T) => void, 
  reject: (reason?: any) => void 
}
```

## Example

```typescript
const { promise, resolve, reject } = Futurable.withResolvers();

setTimeout(() => resolve('Done'), 1000);

await promise;
```
