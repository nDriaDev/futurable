# Usage Examples

Explore real-world examples of using Futurable in various scenarios and frameworks.

## Quick Examples

### Basic Cancellation

```typescript
import { Futurable } from '@ndriadev/futurable';

const operation = new Futurable((resolve, reject, { signal }) => {
  const timeout = setTimeout(() => resolve('Completed!'), 5000);
  
  signal.addEventListener('abort', () => {
    clearTimeout(timeout);
    reject(new Error('Cancelled'));
  });
});

// Cancel after 2 seconds
setTimeout(() => operation.cancel(), 2000);
```

### Cancellable Fetch

```typescript
const request = Futurable.fetch('https://api.example.com/data')
  .then(response => response.json())
  .then(data => console.log(data));

// Cancel after 5 seconds
setTimeout(() => request.cancel(), 5000);
```

### Sleep & Delay

```typescript
// Simple sleep
await Futurable.sleep(1000);
console.log('Waited 1 second');

// Delay with value transformation
const result = await new Futurable(resolve => resolve('initial'))
  .delay(() => 'delayed value', 2000);

console.log(result); // 'delayed value' after 2 seconds
```

### Polling

```typescript
const polling = Futurable.polling(
  () => Futurable.fetch('/api/status').then(r => r.json()),
  5000 // Poll every 5 seconds
);

polling
  .then(data => console.log('Final status:', data))
  .catch(err => console.error('Polling error:', err));

// Stop after 30 seconds
setTimeout(() => polling.cancel(), 30000);
```

## Framework Integration

### React

Perfect for component lifecycle management:

```tsx
import { useEffect, useState } from 'react';
import { Futurable } from '@ndriadev/futurable';

function Component({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const request = Futurable
      .fetch(`/api/users/${userId}`)
      .then(r => r.json())
      .then(setUser);

    return () => request.cancel();
  }, [userId]);

  return <div>{user?.name}</div>;
}
```

[Learn more about React integration →](/examples/react)

### Vue 3

Works seamlessly with Vue's composition API:

```typescript
import { onUnmounted, ref } from 'vue';
import { Futurable } from '@ndriadev/futurable';

export function useUser(userId: Ref<string>) {
  const user = ref(null);
  let request: Futurable<any> | null = null;

  watchEffect(() => {
    request?.cancel();
    
    request = Futurable
      .fetch(`/api/users/${userId.value}`)
      .then(r => r.json())
      .then(data => user.value = data);
  });

  onUnmounted(() => request?.cancel());

  return { user };
}
```

[Learn more about Vue integration →](/examples/vue)

### Angular

Integrate with Angular's lifecycle:

```typescript
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Futurable } from '@ndriadev/futurable';

@Component({
  selector: 'app-user',
  template: '<div>{{ user?.name }}</div>'
})
export class UserComponent implements OnInit, OnDestroy {
  user: any;
  private request?: Futurable<any>;

  ngOnInit() {
    this.request = Futurable
      .fetch('/api/user')
      .then(r => r.json())
      .then(data => this.user = data);
  }

  ngOnDestroy() {
    this.request?.cancel();
  }
}
```

## Common Patterns

### Timeout Pattern

```typescript
function fetchWithTimeout(url: string, timeoutMs: number) {
  const request = Futurable.fetch(url);
  
  setTimeout(() => request.cancel(), timeoutMs);
  
  return request;
}

// Use it
fetchWithTimeout('/api/slow-endpoint', 5000)
  .then(r => r.json())
  .catch(err => {
    if (err.name === 'AbortError') {
      console.log('Request timed out');
    }
  });
```

### Retry Pattern

```typescript
async function fetchWithRetry(
  url: string,
  maxRetries = 3,
  delay = 1000
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await Futurable.fetch(url);
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await Futurable.sleep(delay * (i + 1));
    }
  }
}

// Use it
const data = await fetchWithRetry('/api/flaky-endpoint');
```

### Race with Timeout

```typescript
const result = await Futurable.race([
  Futurable.fetch('/api/data'),
  Futurable.sleep(5000).then(() => {
    throw new Error('Timeout');
  })
]);
```

### Batch Processing

```typescript
async function processBatch<T>(
  items: T[],
  processor: (item: T) => Futurable<any>,
  concurrency = 3
) {
  const results = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Futurable.all(
      batch.map(processor)
    );
    results.push(...batchResults);
  }
  
  return results;
}

// Use it
const urls = ['/api/1', '/api/2', '/api/3', '/api/4'];
const data = await processBatch(
  urls,
  url => Futurable.fetch(url).then(r => r.json()),
  2 // Process 2 at a time
);
```

### Debounced Function

```typescript
function debounced<T>(
  fn: () => Futurable<T>,
  delay: number
) {
  let timeout: Futurable<any> | null = null;

  return function execute() {
    timeout?.cancel();
    
    timeout = new Futurable(resolve => {
      setTimeout(() => resolve(fn()), delay);
    });
    
    return timeout;
  };
}

// Use it
const search = debounced(
  () => Futurable.fetch('/api/search?q=...').then(r => r.json()),
  300
);

// Calls are debounced
search();
search();
search(); // Only this one executes after 300ms
```

## Advanced Scenarios

### WebSocket with Cleanup

```typescript
function connectWebSocket(url: string) {
  return new Futurable<WebSocket>((resolve, reject, { onCancel }) => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => resolve(ws);
    ws.onerror = reject;
    
    onCancel(() => {
      ws.close();
    });
  });
}

// Use it
const connection = await connectWebSocket('wss://example.com');

// Later, when done
connection.cancel(); // Closes WebSocket
```

### File Upload with Progress

```typescript
function uploadFile(file: File, onProgress: (percent: number) => void) {
  return new Futurable<Response>((resolve, reject, { signal }) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    });
    
    xhr.addEventListener('load', () => {
      resolve(new Response(xhr.response));
    });
    
    xhr.addEventListener('error', reject);
    
    signal.addEventListener('abort', () => {
      xhr.abort();
      reject(new Error('Upload cancelled'));
    });
    
    xhr.open('POST', '/api/upload');
    xhr.send(file);
  });
}

// Use it
const upload = uploadFile(file, (percent) => {
  console.log(`Upload progress: ${percent}%`);
});

// Cancel upload
upload.cancel();
```

### Infinite Scroll

```typescript
class InfiniteScroll {
  private page = 1;
  private loading = false;
  private currentRequest: Futurable<any> | null = null;

  async loadMore() {
    if (this.loading) {
      this.currentRequest?.cancel();
    }

    this.loading = true;
    
    this.currentRequest = Futurable
      .fetch(`/api/items?page=${this.page}`)
      .then(r => r.json())
      .then(items => {
        this.page++;
        this.loading = false;
        return items;
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          this.loading = false;
          throw err;
        }
      });

    return this.currentRequest;
  }

  destroy() {
    this.currentRequest?.cancel();
  }
}
```

## Testing Examples

### Unit Testing

```typescript
import { Futurable } from '@ndriadev/futurable';

describe('Futurable', () => {
  test('can be cancelled', async () => {
    let cancelled = false;
    
    const futurable = new Futurable((resolve, reject, { onCancel }) => {
      onCancel(() => cancelled = true);
      setTimeout(resolve, 1000);
    });
    
    futurable.cancel();
    
    expect(cancelled).toBe(true);
  });

  test('fetch can be cancelled', async () => {
    const request = Futurable.fetch('https://api.example.com');
    
    request.cancel();
    
    await expect(request).rejects.toThrow('AbortError');
  });
});
```

## More Examples

Explore detailed examples for specific use cases:

- [React Integration](/examples/react) - Hooks, patterns, and best practices
- [Vue Integration](/examples/vue) - Composition API and reactivity
- [Node.js](/examples/nodejs) - Server-side usage and patterns
- [Timeout & Retry](/examples/timeout-retry) - Resilient async operations
- [Advanced Patterns](/examples/advanced) - Complex scenarios and optimizations

## Contributing Examples

Have a great example? [Contribute it on GitHub!](https://github.com/nDriaDev/futurable/blob/main/CONTRIBUTING.md)
