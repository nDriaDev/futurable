# Advanced Patterns

Advanced usage patterns and techniques.

## Parallel with Limit

```typescript
async function parallelWithLimit(items, fn, limit = 3) {
  const results = [];
  const executing = [];
  
  for (const item of items) {
    const p = fn(item).then(result => {
      executing.splice(executing.indexOf(p), 1);
      return result;
    });
    
    results.push(p);
    executing.push(p);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}
```

## Queue System

```typescript
class RequestQueue {
  private queue = [];
  private processing = false;
  
  add(request) {
    this.queue.push(request);
    this.process();
  }
  
  async process() {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      const request = this.queue.shift();
      try {
        await request();
      } catch (error) {
        console.error('Request failed:', error);
      }
      await Futurable.sleep(100);
    }
    
    this.processing = false;
  }
}
```

## See Also

- [Examples Overview](/examples/)
- [React Integration](/examples/react)
