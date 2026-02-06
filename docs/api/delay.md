# delay()

Wait for a specified time, then execute a callback.

## Syntax

```typescript
futurable.delay<TResult>(callback: () => TResult, ms: number): Futurable<TResult>
```

## Example

```typescript
const result = await new Futurable((resolve) => {
  resolve('initial');
}).delay(() => 'delayed value', 2000);

console.log(result); // 'delayed value'
```

## See Also

- [Futurable.delay()](/api/static-delay)
- [sleep()](/api/sleep)
- [Delays & Sleep Guide](/guide/delays-and-sleep)
