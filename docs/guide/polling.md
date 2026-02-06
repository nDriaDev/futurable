# Polling

Futurable provides built-in polling support with automatic cancellation.

## Basic Polling

```typescript
import { Futurable } from '@ndriadev/futurable';

const polling = Futurable.polling(
  () => Futurable.fetch('/api/status').then(r => r.json()),
  5000 // Poll every 5 seconds
);

polling.then(data => console.log('Final result:', data));

// Stop polling
polling.cancel();
```

## Use Cases

### Check Job Status

```typescript
function pollJobStatus(jobId) {
  return Futurable.polling(
    async () => {
      const response = await Futurable.fetch(`/api/jobs/${jobId}`);
      const job = await response.json();
      
      if (job.status === 'complete') {
        return job.result; // Stops polling
      }
      
      throw new Error('Not ready'); // Continues polling
    },
    2000 // Check every 2 seconds
  );
}

// Usage
const result = await pollJobStatus('job-123');
console.log('Job complete:', result);
```

### Real-time Updates

```typescript
function pollNotifications() {
  return Futurable.polling(
    () => Futurable.fetch('/api/notifications').then(r => r.json()),
    10000 // Every 10 seconds
  );
}

const notifications = pollNotifications();
notifications.then(updateUI);

// Stop when user logs out
onLogout(() => notifications.cancel());
```

## See Also

- [Futurable.polling()](/api/static-polling) - Polling API reference
- [cancel()](/api/cancel) - Stop polling
