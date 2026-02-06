# Node.js Examples

Using Futurable in Node.js applications.

## Server-Side Fetch

```typescript
import { Futurable } from '@ndriadev/futurable';

async function fetchUserData(userId) {
  const request = Futurable.fetch(`https://api.example.com/users/${userId}`);
  
  // Timeout after 5 seconds
  setTimeout(() => request.cancel(), 5000);
  
  try {
    const response = await request;
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request timed out');
    }
    throw error;
  }
}
```

## Worker Threads

```typescript
import { Worker } from 'worker_threads';
import { Futurable } from '@ndriadev/futurable';

function runWorker(data) {
  return new Futurable((resolve, reject, { onCancel }) => {
    const worker = new Worker('./worker.js', { workerData: data });
    
    worker.on('message', resolve);
    worker.on('error', reject);
    
    onCancel(() => worker.terminate());
  });
}

const task = runWorker({ input: 'data' });
// Cancel if needed
task.cancel();
```

## See Also

- [Examples Overview](/examples/)
