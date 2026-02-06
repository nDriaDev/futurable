# sleep()

Pause execution for a specified number of milliseconds.

## Syntax

```typescript
futurable.sleep(ms: number): Futurable<void>
```

## Example

```typescript
const futurable = new Futurable((resolve) => {
  resolve('value');
});

await futurable.sleep(2000);
console.log('2 seconds passed');
```

## See Also

- [Futurable.sleep()](/api/static-sleep)
- [delay()](/api/delay)
- [Delays & Sleep Guide](/guide/delays-and-sleep)
