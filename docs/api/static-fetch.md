# Futurable.fetch()

Static cancellable fetch.

## Syntax

```typescript
Futurable.fetch(url: string, options?: RequestInit): Futurable<Response>
```

## Example

```typescript
const request = Futurable.fetch('/api/data');

request.then(r => r.json()).then(console.log);

// Cancel
request.cancel();
```

## See Also

- [fetch()](/api/fetch)
- [Fetch Integration Guide](/guide/fetch-integration)
