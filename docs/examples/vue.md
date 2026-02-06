# Vue Integration

Using Futurable with Vue 3 Composition API.

## Basic Example

```typescript
import { onUnmounted, ref } from 'vue';
import { Futurable } from '@ndriadev/futurable';

export default {
  setup() {
    const data = ref(null);
    
    const request = Futurable
      .fetch('/api/data')
      .then(r => r.json())
      .then(result => data.value = result);
    
    onUnmounted(() => request.cancel());
    
    return { data };
  }
}
```

## Composable

```typescript
import { ref, onUnmounted, watchEffect } from 'vue';
import { Futurable } from '@ndriadev/futurable';

export function useFetch(url) {
  const data = ref(null);
  const error = ref(null);
  const loading = ref(true);
  let request = null;
  
  watchEffect(() => {
    request?.cancel();
    loading.value = true;
    
    request = Futurable
      .fetch(url.value)
      .then(r => r.json())
      .then(result => {
        data.value = result;
        loading.value = false;
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          error.value = err;
          loading.value = false;
        }
      });
  });
  
  onUnmounted(() => request?.cancel());
  
  return { data, error, loading };
}
```

## See Also

- [React Integration](/examples/react)
- [Examples Overview](/examples/)
