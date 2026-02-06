# onCancel()

Register callbacks to execute when the futurable is cancelled.

## Syntax

```typescript
futurable.onCancel(callback: () => void): void
```

## Example

```typescript
const futurable = new Futurable((resolve, reject, { onCancel }) => {
  const ws = new WebSocket('wss://example.com');
  
  ws.onmessage = (event) => resolve(event.data);
  
  onCancel(() => {
    ws.close();
    console.log('WebSocket closed');
  });
});

futurable.cancel(); // Triggers the onCancel callback
```

## See Also

- [cancel()](/api/cancel)
- [Constructor](/api/constructor)
- [Cancellation Guide](/guide/cancellation)
