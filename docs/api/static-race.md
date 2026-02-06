# Futurable.race()

Race multiple futurables.

## Syntax

```typescript
Futurable.race<T>(values: Iterable<T>): Futurable<T>
```

## Example

```typescript
const winner = await Futurable.race([
  Futurable.fetch('/api/fast'),
  Futurable.sleep(5000).then(() => { throw new Error('Timeout') })
]);
```

## See Also

- [Promise.race()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race)
