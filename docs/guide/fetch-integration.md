# Fetch Integration

Futurable provides a powerful, cancellable wrapper around the Fetch API.

## Basic Usage

```typescript
import { Futurable } from '@ndriadev/futurable';

const request = Futurable.fetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data));

// Cancel anytime
request.cancel();
```

## Why Use Futurable.fetch?

| Feature | Native fetch | Futurable.fetch |
|---------|-------------|----------------|
| Cancellation | Manual AbortController | Built-in `.cancel()` |
| Chaining | Promise chains | Cancellable chains |
| Cleanup | Manual | Automatic |
| Error handling | Standard | AbortError support |

## Instance Method

Use `fetch()` within a Futurable:

```typescript
const futurable = new Futurable(async (resolve, reject, { fetch }) => {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    resolve(data);
  } catch (error) {
    reject(error);
  }
});

futurable.cancel(); // Automatically cancels the fetch
```

## Static Method

Use `Futurable.fetch()` directly:

```typescript
const request = Futurable.fetch('/api/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'John' })
});

request.then(r => r.json()).then(console.log);
```

## See Also

- [fetch()](/api/fetch) - Instance fetch method
- [Futurable.fetch()](/api/static-fetch) - Static fetch method
- [React Integration](/examples/react) - React examples with fetch
