# Why Futurable?

JavaScript's native Promise API is powerful and elegant, but it has some limitations when building real-world applications. Futurable addresses these limitations while maintaining full compatibility with the Promise API you already know and love.

## The Problem with Promises

### 1. No Cancellation Support

Once a Promise is created, there's no standard way to cancel it:

```javascript
// ❌ Native Promise - No way to cancel
const promise = fetch('https://api.example.com/large-file');

// If the user navigates away, the request continues
// Memory leaks and wasted bandwidth are common issues
```

This leads to several problems:

- **Memory Leaks**: Components unmount but promises continue executing
- **Wasted Resources**: Network requests continue even when results are no longer needed
- **Race Conditions**: Multiple requests can complete out of order
- **Poor UX**: No way to provide "cancel" functionality to users

### 2. No Built-in Delays

Need to add a delay? You have to wrap setTimeout in a Promise:

```javascript
// ❌ Verbose and repetitive
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function delayedOperation() {
  await sleep(1000);
  return doSomething();
}
```

### 3. Complex Fetch Cancellation

The native Fetch API supports cancellation via AbortController, but it's verbose:

```javascript
// ❌ Too much boilerplate
const controller = new AbortController();

fetch('https://api.example.com/data', { signal: controller.signal })
  .then(response => response.json())
  .catch(error => {
    if (error.name === 'AbortError') {
      console.log('Cancelled');
    }
  });

// Cancel
controller.abort();
```

### 4. No Polling Support

Polling requires manual interval management:

```javascript
// ❌ Complex polling logic
let intervalId;
let stopped = false;

async function pollAPI() {
  intervalId = setInterval(async () => {
    if (stopped) {
      clearInterval(intervalId);
      return;
    }
    const data = await fetch('https://api.example.com/status');
    // Process data
  }, 5000);
}

// Stop polling
stopped = true;
clearInterval(intervalId);
```

## The Futurable Solution

### ✅ Built-in Cancellation

```typescript
import { Futurable } from '@ndriadev/futurable';

const request = Futurable.fetch('https://api.example.com/large-file');

// Cancel anytime with one method call
request.cancel();
```

### ✅ Clean Delays

```typescript
// Sleep for 1 second
await Futurable.sleep(1000);

// Delay with transformation
const result = await futurable.delay(() => 'delayed value', 2000);
```

### ✅ Simple Fetch Integration

```typescript
// One line, fully cancellable
const request = Futurable.fetch('https://api.example.com/data');

request.cancel(); // That's it!
```

### ✅ Native Polling

```typescript
const polling = Futurable.polling(
  () => Futurable.fetch('https://api.example.com/status'),
  5000
);

// Stop polling
polling.cancel();
```

## Real-World Benefits

### React Example

**Without Futurable** ❌

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setUser(data);
      });

    return () => {
      cancelled = true;
      // Still no way to actually cancel the request
    };
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

**With Futurable** ✅

```jsx
import { Futurable } from '@ndriadev/futurable';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const request = Futurable
      .fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(setUser);

    return () => request.cancel(); // Simple and effective!
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

### Benefits:

1. **Cleaner Code**: Less boilerplate and easier to read
2. **Actually Cancels**: The HTTP request is aborted, not just ignored
3. **No Memory Leaks**: Resources are properly cleaned up
4. **Type Safe**: Full TypeScript support

## Performance Benefits

### Reduced Network Traffic

When you cancel a Futurable fetch, the underlying HTTP request is aborted:

```typescript
// Large file download
const download = Futurable.fetch('https://cdn.example.com/large-video.mp4');

// User navigates away after 1 second
setTimeout(() => download.cancel(), 1000);

// ✅ Network request is aborted - bandwidth saved!
```

### Prevent Memory Leaks

Without proper cancellation, callbacks can pile up:

```javascript
// ❌ Without cancellation - memory leak risk
componentWillUnmount() {
  // Promise callbacks still fire, updating unmounted components
}

// ✅ With Futurable - clean exit
componentWillUnmount() {
  this.request.cancel(); // Callbacks won't fire
}
```

## Framework Integration

### Works Everywhere

Futurable integrates seamlessly with all popular frameworks:

- ✅ **React** - Perfect for useEffect cleanup
- ✅ **Vue** - Clean up in `onUnmounted`
- ✅ **Angular** - Use in `ngOnDestroy`
- ✅ **Svelte** - Works with `onDestroy`
- ✅ **Node.js** - Server-side cancellation

### Example: Vue 3

```typescript
import { onUnmounted } from 'vue';
import { Futurable } from '@ndriadev/futurable';

export default {
  setup() {
    const fetchData = () => {
      const request = Futurable.fetch('/api/data');
      
      onUnmounted(() => request.cancel());
      
      return request;
    };
  }
}
```

## Migration from Promises

Switching to Futurable is easy because it's fully Promise-compatible:

```typescript
// Your existing code works unchanged
const result = await futurable;
futurable.then(x => x).catch(e => e);

// Plus new capabilities
futurable.cancel();
await Futurable.sleep(1000);
```

You can migrate gradually - mix Futurable and Promise freely:

```typescript
const results = await Promise.all([
  regularPromise,
  Futurable.fetch('/api/data'),
  anotherPromise
]);
```

## Philosophy

Futurable follows these principles:

1. **Promise Compatible**: If it works with Promise, it works with Futurable
2. **Progressive Enhancement**: Add features without breaking existing code
3. **Zero Dependencies**: Lightweight and fast
4. **Type Safe**: First-class TypeScript support
5. **Standards Based**: Uses native AbortSignal and Promise APIs

## When to Use Futurable

Use Futurable when you need:

- ✅ Cancellable async operations
- ✅ Timeout or abort long-running tasks
- ✅ Clean up effects in React/Vue/Angular
- ✅ Polling with easy stop mechanism
- ✅ Delays and sleep without boilerplate
- ✅ Better resource management
- ✅ Type-safe async operations

## When NOT to Use Futurable

Stick with native Promises when:

- ❌ You never need to cancel operations
- ❌ Working with very simple, short-lived promises
- ❌ Bundle size is absolutely critical (though Futurable is small!)
- ❌ Using an environment without AbortController support (very old browsers)

## Comparison with Alternatives

### vs. AbortController + Promise

| Feature | Futurable | AbortController + Promise |
|---------|-----------|---------------------------|
| Cancellation | ✅ Built-in `.cancel()` | ⚠️ Manual `controller.abort()` |
| Boilerplate | ✅ Minimal | ❌ Verbose |
| Chaining | ✅ Cancellable chains | ❌ Each step needs setup |
| Delays | ✅ Built-in | ❌ Manual |
| Polling | ✅ Built-in | ❌ Manual |
| Type Safety | ✅ Full | ⚠️ Partial |

### vs. RxJS

| Feature | Futurable | RxJS |
|---------|-----------|------|
| Learning Curve | ✅ Familiar Promise API | ❌ Steep learning curve |
| Bundle Size | ✅ Small (~2KB) | ❌ Large (~40KB+) |
| Use Cases | ✅ Perfect for Promises | ✅ Perfect for streams |
| Overkill for simple tasks | ✅ No | ❌ Yes |

## Next Steps

- Learn about [Cancellation patterns](/guide/cancellation)
- Explore [Delays & Sleep](/guide/delays-and-sleep)
- See [Real-world examples](/examples/)
- Read the [API documentation](/api/constructor)
