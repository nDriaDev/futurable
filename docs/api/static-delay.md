# Futurable.delay()

Static delay utility.

## Syntax

```typescript
Futurable.delay<T>(callback: () => T, ms: number): Futurable<T>
```

## Example

```typescript
const result = await Futurable.delay(() => 'value', 1000);
```

## See Also

- [delay()](/api/delay)
- [Delays & Sleep Guide](/guide/delays-and-sleep)
