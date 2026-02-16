# then()

Attach callbacks for the resolution and rejection of the Futurable.

## Syntax

```typescript
futurable.then&lt;TResult1, TResult2&gt;(
  onfulfilled?: (value: T) =&gt; TResult1 | PromiseLike&lt;TResult1&gt;,
  onrejected?: (reason: any) =&gt; TResult2 | PromiseLike&lt;TResult2&gt;
): Futurable&lt;TResult1 | TResult2&gt;
```

## Parameters

### `onfulfilled` (optional)

Function called when the Futurable resolves successfully. Receives the resolved value.

### `onrejected` (optional)

Function called when the Futurable is rejected. Receives the rejection reason.

## Return Value

A new `Futurable` for the result of the callbacks.

## Description

The `then()` method is inherited from Promise and works exactly the same way. It returns a new Futurable that resolves or rejects based on the callbacks.

This is the standard Promise API - Futurable is fully Promise-compatible.

## Examples

### Basic Usage

```typescript
Futurable.fetch('/api/data')
  .then(response =&gt; response.json())
  .then(data =&gt; console.log(data));
```

### With Error Handling

```typescript
Futurable.fetch('/api/data')
  .then(
    response =&gt; response.json(),
    error =&gt; {
      console.error('Request failed:', error);
      return null;
    }
  );
```

### Chaining

```typescript
Futurable.resolve(5)
  .then(x =&gt; x * 2)
  .then(x =&gt; x + 3)
  .then(x =&gt; x.toString())
  .then(str =&gt; console.log(str)); // "13"
```

### With Cancellation

```typescript
const request = Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .then(data =&gt; processData(data));

// Can still cancel
setTimeout(() =&gt; request.cancel(), 1000);
```

### Async Transformation

```typescript
Futurable.resolve('user-123')
  .then(async id =&gt; {
    const user = await fetchUser(id);
    return user;
  })
  .then(user =&gt; console.log(user.name));
```

## Comparison with catch()

```typescript
// Using then() for both success and error
futurable.then(
  value =&gt; handleSuccess(value),
  error =&gt; handleError(error)
);

// Using then() and catch() separately
futurable
  .then(value =&gt; handleSuccess(value))
  .catch(error =&gt; handleError(error));
```

## Promise Compatibility

Futurable is fully compatible with Promise:

```typescript
// Can be used with async/await
const data = await Futurable.fetch('/api/data')
  .then(res =&gt; res.json());

// Can be used with Promise.all
const results = await Promise.all([
  Futurable.fetch('/api/users'),
  Futurable.fetch('/api/posts')
]);

// Works with Promise APIs
const promise: Promise&lt;any&gt; = Futurable.resolve(42);
```

## Notes

- Fully compatible with Promise API
- Returns a new Futurable (not a Promise)
- Both callbacks are optional
- Can be chained multiple times
- Futurable remains cancellable after `then()`
- Errors skip fulfilled callback and go to rejected callback

## See Also

- [catch()](/api/catch) - Error handling
- [safe()](/api/safe) - Safe error handling
- [Constructor](/api/constructor) - Creating Futurables
