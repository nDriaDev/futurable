# fetch()

Make a cancellable HTTP request.

## Syntax

```typescript
futurable.fetch(url: string, options?: RequestInit): Futurable<Response>
```

## Example

```typescript
const futurable = new Futurable((resolve, reject, { fetch }) => {
  fetch('/api/data')
    .then(r => r.json())
    .then(resolve)
    .catch(reject);
});

futurable.cancel(); // Cancels the fetch
```

## See Also

- [Futurable.fetch()](/api/static-fetch)
- [Fetch Integration Guide](/guide/fetch-integration)
