# safe()

Execute a Futurable without throwing errors, returning a Result type instead.

## Syntax

```typescript
futurable.safe&lt;TError = unknown&gt;(): Futurable&lt;SafeResult&lt;T, TError&gt;&gt;
```

## Parameters

### `TError` (optional type parameter)

The type of error expected. Defaults to `unknown`.

## Return Value

A `Futurable` that resolves to a `SafeResult&lt;T, TError&gt;` object:

```typescript
type SafeResult&lt;T, E = Error&gt; =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: E };
```

## Description

The `safe()` method wraps a Futurable in a safe execution context that never throws. Instead of rejecting and requiring try-catch blocks, it always resolves with a result object containing either the data or the error.

This is particularly useful in async/await contexts where you want explicit error handling without wrapping code in try-catch blocks.

### Key Benefits

- **No try-catch needed**: Errors become values in the success path
- **Type-safe**: TypeScript discriminated unions work perfectly
- **Explicit handling**: Forces you to handle both success and error cases
- **Cleaner code**: Reduces nesting and indentation
- **Composable**: Can be chained with other Futurable methods

## Examples

### Basic Usage

```typescript
import { Futurable } from '@ndriadev/futurable';

// Without safe() - requires try-catch
try {
  const data = await Futurable.fetch('/api/data')
    .then(r =&gt; r.json());
  console.log('Success:', data);
} catch (error) {
  console.error('Error:', error);
}

// With safe() - no try-catch needed
const result = await Futurable.fetch('/api/data')
  .then(r =&gt; r.json())
  .safe();

if (result.success) {
  console.log('Success:', result.data);
} else {
  console.error('Error:', result.error);
}
```

### Type-Safe Error Handling

```typescript
// TypeScript knows the exact shape based on success
const result = await Futurable.fetch('/api/users')
  .then(r =&gt; r.json())
  .safe();

if (result.success) {
  // TypeScript knows:
  // - result.data exists (type: User[])
  // - result.error is null
  const users = result.data;
  console.log(`Found ${users.length} users`);
} else {
  // TypeScript knows:
  // - result.error exists
  // - result.data is null
  console.error('Failed to fetch users:', result.error);
}
```

### With Custom Error Type

```typescript
interface APIError {
  code: string;
  message: string;
  statusCode: number;
}

const result = await Futurable.fetch('/api/data')
  .then(async (response) =&gt; {
    if (!response.ok) {
      throw {
        code: 'API_ERROR',
        message: response.statusText,
        statusCode: response.status
      } as APIError;
    }
    return response.json();
  })
  .safe&lt;APIError&gt;();

if (result.success) {
  console.log(result.data);
} else {
  // result.error is typed as APIError
  console.error(`API Error [${result.error.code}]: ${result.error.message}`);
}
```

### Chaining Multiple Operations

```typescript
const result = await Futurable.resolve(5)
  .delay(val =&gt; val * 2, 1000)
  .then(val =&gt; Futurable.fetch(`/api/item/${val}`))
  .then(r =&gt; r.json())
  .safe();

if (result.success) {
  processData(result.data);
} else {
  logError(result.error);
}
```

### Early Returns Pattern

```typescript
async function fetchUserProfile(userId: number) {
  const result = await Futurable.fetch(`/api/users/${userId}`)
    .then(r =&gt; r.json())
    .safe();

  // Early return on error
  if (!result.success) {
    console.error('Failed to fetch user:', result.error);
    return null;
  }

  // Continue with success path
  const user = result.data;
  return enrichUserData(user);
}
```

### Multiple Safe Operations

```typescript
async function loadDashboardData() {
  // Execute multiple operations safely
  const [usersResult, postsResult, statsResult] = await Promise.all([
    Futurable.fetch('/api/users').then(r =&gt; r.json()).safe(),
    Futurable.fetch('/api/posts').then(r =&gt; r.json()).safe(),
    Futurable.fetch('/api/stats').then(r =&gt; r.json()).safe()
  ]);

  // Aggregate results
  return {
    users: usersResult.success ? usersResult.data : [],
    posts: postsResult.success ? postsResult.data : [],
    stats: statsResult.success ? statsResult.data : null,
    errors: [
      !usersResult.success &amp;&amp; usersResult.error,
      !postsResult.success &amp;&amp; postsResult.error,
      !statsResult.success &amp;&amp; statsResult.error
    ].filter(Boolean)
  };
}
```

### With React Hooks

```typescript
import { useEffect, useState } from 'react';
import { Futurable } from '@ndriadev/futurable';

function UserProfile({ userId }) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() =&gt; {
    const request = Futurable
      .fetch(`/api/users/${userId}`)
      .then(r =&gt; r.json())
      .safe()
      .then(result =&gt; {
        if (result.success) {
          setState({ data: result.data, loading: false, error: null });
        } else {
          setState({ data: null, loading: false, error: result.error });
        }
      });

    return () =&gt; request.cancel();
  }, [userId]);

  if (state.loading) return &lt;div&gt;Loading...&lt;/div&gt;;
  if (state.error) return &lt;div&gt;Error: {state.error.message}&lt;/div&gt;;
  return &lt;div&gt;{state.data.name}&lt;/div&gt;;
}
```

### Form Submission

```typescript
async function handleSubmit(formData: FormData) {
  const result = await Futurable.fetch('/api/submit', {
    method: 'POST',
    body: formData
  })
    .then(r =&gt; r.json())
    .safe();

  if (result.success) {
    showSuccessMessage('Form submitted successfully!');
    return result.data;
  } else {
    showErrorMessage(`Submission failed: ${result.error}`);
    return null;
  }
}
```

### Validation Chain

```typescript
async function processUserInput(input: string) {
  // Validate and process in a chain
  const result = await Futurable.resolve(input)
    .then(val =&gt; {
      if (!val) throw new Error('Input is required');
      return val.trim();
    })
    .then(val =&gt; {
      if (val.length &lt; 3) throw new Error('Input too short');
      return val;
    })
    .then(val =&gt; validateAgainstAPI(val))
    .safe();

  if (result.success) {
    return { valid: true, value: result.data };
  } else {
    return { valid: false, error: result.error.message };
  }
}
```

## Comparison with try-catch

### Traditional try-catch

```typescript
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error };
  }
}
```

### With safe()

```typescript
async function fetchData() {
  const result = await Futurable.fetch('/api/data')
    .then(r =&gt; r.json())
    .safe();

  return result; // Same shape, less code
}
```

## Pattern: Result Monad

The `safe()` method implements the Result/Either monad pattern, common in functional programming:

```typescript
// Helper functions for working with SafeResult
function map&lt;T, U&gt;(
  result: SafeResult&lt;T&gt;,
  fn: (value: T) =&gt; U
): SafeResult&lt;U&gt; {
  return result.success
    ? { success: true, data: fn(result.data), error: null }
    : result;
}

function flatMap&lt;T, U&gt;(
  result: SafeResult&lt;T&gt;,
  fn: (value: T) =&gt; SafeResult&lt;U&gt;
): SafeResult&lt;U&gt; {
  return result.success ? fn(result.data) : result;
}

// Usage
const result = await Futurable.fetch('/api/user')
  .then(r =&gt; r.json())
  .safe();

const transformed = map(result, user =&gt; user.name.toUpperCase());
```

## Best Practices

### 1. Use for Expected Errors

```typescript
// ✅ Good - network calls often fail
const result = await Futurable.fetch('/api/data')
  .then(r =&gt; r.json())
  .safe();

// ❌ Not needed - this shouldn't fail
const result = await Futurable.resolve(42).safe();
```

### 2. Always Check success

```typescript
// ❌ Don't assume success
const result = await fetchData().safe();
console.log(result.data); // Could be null!

// ✅ Always check
const result = await fetchData().safe();
if (result.success) {
  console.log(result.data);
}
```

### 3. Type Error Appropriately

```typescript
// ✅ Specific error type
interface ValidationError {
  field: string;
  message: string;
}

const result = await validateForm().safe&lt;ValidationError&gt;();

// ❌ Generic unknown
const result = await validateForm().safe(); // error is unknown
```

### 4. Combine with Early Returns

```typescript
// ✅ Clean early return pattern
async function process(id: number) {
  const result = await fetchData(id).safe();
  if (!result.success) {
    logError(result.error);
    return null;
  }

  // Continue processing with result.data
  return transform(result.data);
}
```

## Type Definitions

```typescript
// SafeResult type
type SafeResult&lt;T, E = Error&gt; =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: E };

// Method signature
safe&lt;TError = unknown&gt;(): Futurable&lt;SafeResult&lt;T, TError&gt;&gt;
```

## Notes

- The Futurable **never rejects** when using `safe()`
- Always resolves with a `SafeResult` object
- TypeScript discriminated unions work perfectly with the `success` flag
- Can be chained with other Futurable methods before calling `safe()`
- The error type can be customized with the generic parameter
- Cancellation still works as expected

## See Also

- [then()](/api/then) - Promise-style error handling
- [catch()](/api/catch) - Traditional error catching
- [Constructor](/api/constructor) - Creating Futurables
- [Error Handling Guide](/guide/error-handling) - Error handling patterns
