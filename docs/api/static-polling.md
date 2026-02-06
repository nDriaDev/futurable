# Futurable.polling()

Poll a function at regular intervals.

## Syntax

```typescript
Futurable.polling<T>(
  fn: () => Futurable<T>, 
  interval: number,
  options?: { immediate?: boolean }
): Futurable<T>
```

## Example

```typescript
const status = Futurable.polling(
  () => Futurable.fetch('/api/status').then(r => r.json()),
  5000
);

// Stop polling
status.cancel();
```

## See Also

- [Polling Guide](/guide/polling)
