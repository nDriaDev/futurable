# catch()

Handle errors in the Futurable.

## Syntax

```typescript
futurable.catch&lt;TResult&gt;(
  onrejected: (reason: any) =&gt; TResult | PromiseLike&lt;TResult&gt;
): Futurable&lt;T | TResult&gt;
```

## Parameters

### `onrejected`

Function called when the Futurable is rejected. Receives the rejection reason and can return a fallback value or re-throw.

## Return Value

A new `Futurable` that resolves with either the original value or the fallback from the error handler.

## Description

The `catch()` method is inherited from Promise and works exactly the same way. It's syntactic sugar for `.then(undefined, onrejected)`.

Use it to handle errors in Futurable chains.

## Examples

### Basic Error Handling

```typescript
Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .catch(error =&gt; {
    console.error('Failed:', error);
    return { default: 'data' };
  });
```

### With Cancellation

```typescript
const request = Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .catch(error =&gt; {
    if (error.name === 'AbortError') {
      console.log('Request was cancelled');
    } else {
      console.error('Request failed:', error);
    }
    return null;
  });

// Cancel if needed
request.cancel();
```

### Recovery Chain

```typescript
Futurable.fetch('/api/primary')
  .catch(error =&gt; {
    console.log('Primary failed, trying backup');
    return fetch('/api/backup');
  })
  .then(res =&gt; res.json())
  .catch(error =&gt; {
    console.log('Both failed, using default');
    return DEFAULT_DATA;
  });
```

### Re-throwing Errors

```typescript
Futurable.fetch('/api/data')
  .catch(error =&gt; {
    // Log but re-throw
    console.error('Error:', error);
    throw error;
  })
  .catch(error =&gt; {
    // Handle the re-thrown error
    return fallbackData;
  });
```

### Type-Specific Error Handling

```typescript
Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .catch(error =&gt; {
    if (error.name === 'SyntaxError') {
      console.error('Invalid JSON');
      return { error: 'Invalid response format' };
    }
    if (error.status === 404) {
      console.error('Not found');
      return { error: 'Resource not found' };
    }
    throw error; // Re-throw unknown errors
  });
```

## Comparison with try-catch

```typescript
// Using catch()
const data = await Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .catch(error =&gt; {
    console.error(error);
    return DEFAULT_DATA;
  });

// Using try-catch
let data;
try {
  const res = await Futurable.fetch('/api/data');
  data = await res.json();
} catch (error) {
  console.error(error);
  data = DEFAULT_DATA;
}
```

## With async/await

```typescript
try {
  const data = await Futurable.fetch('/api/data')
    .then(res =&gt; res.json());
  console.log(data);
} catch (error) {
  // This catches errors from the entire chain
  console.error(error);
}

// Or use catch() directly
const data = await Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .catch(error =&gt; DEFAULT_DATA);
```

## Multiple Catch Handlers

```typescript
Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .catch(error =&gt; {
    // First catch - try to recover
    console.log('Attempting recovery');
    return fetchFromCache();
  })
  .catch(error =&gt; {
    // Second catch - final fallback
    console.log('Using default');
    return DEFAULT_DATA;
  });
```

## Cancellation Errors

```typescript
const request = Futurable.fetch('/api/data')
  .catch(error =&gt; {
    if (error.name === 'AbortError') {
      console.log('Cancelled - this is expected');
      return null;
    }
    console.error('Real error:', error);
    throw error;
  });

request.cancel(); // Will trigger catch with AbortError
```

## Best Practices

### 1. Always Handle Errors

```typescript
// ✅ Good - errors are handled
Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .catch(error =&gt; console.error(error));

// ❌ Bad - unhandled rejection
Futurable.fetch('/api/data')
  .then(res =&gt; res.json());
// No error handling!
```

### 2. Provide Fallback Values

```typescript
// ✅ Good - provides fallback
const data = await Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .catch(() =&gt; DEFAULT_DATA);

// ❌ Bad - returns undefined on error
const data = await Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .catch(error =&gt; {
    console.error(error);
    // No return value
  });
```

### 3. Log Before Handling

```typescript
// ✅ Good - log then handle
.catch(error =&gt; {
  console.error('Operation failed:', error);
  return fallbackValue;
})

// ❌ Bad - silent failure
.catch(() =&gt; fallbackValue)
```

## Alternative: safe()

For a more explicit error handling pattern, consider using `safe()`:

```typescript
// Using catch()
const data = await Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .catch(error =&gt; {
    console.error(error);
    return null;
  });

// Using safe()
const result = await Futurable.fetch('/api/data')
  .then(res =&gt; res.json())
  .safe();

if (result.success) {
  const data = result.data;
} else {
  console.error(result.error);
}
```

## Notes

- Shorthand for `.then(undefined, onrejected)`
- Catches any error in the chain before it
- Can return a fallback value or re-throw
- Fully compatible with Promise API
- Futurable remains cancellable after `catch()`
- Handles both errors and rejections

## See Also

- [then()](/api/then) - Promise chaining
- [safe()](/api/safe) - Safe error handling
- [onCancel()](/api/on-cancel) - Cancellation handling
