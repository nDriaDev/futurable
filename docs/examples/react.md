# React Integration

Learn how to use Futurable effectively in React applications.

## Why Futurable + React?

React's useEffect cleanup function is perfect for cancelling async operations. Futurable makes this pattern simple and reliable:

- ✅ Prevent memory leaks when components unmount
- ✅ Cancel requests when dependencies change
- ✅ Clean up long-running operations
- ✅ Handle race conditions elegantly

## Basic Pattern

The fundamental pattern for using Futurable in React:

```tsx
import { useEffect, useState } from 'react';
import { Futurable } from '@ndriadev/futurable';

function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const request = Futurable
      .fetch(`https://api.example.com/users/${userId}`)
      .then(response => response.json())
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(err => {
        // Don't set error if request was cancelled
        if (err.name !== 'AbortError') {
          setError(err.message);
          setLoading(false);
        }
      });

    // Cleanup: cancel request when component unmounts or userId changes
    return () => request.cancel();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return null;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}
```

## Custom Hooks

### useFuturable Hook

Create a reusable hook for common patterns:

```tsx
import { useEffect, useState, useCallback } from 'react';
import { Futurable } from '@ndriadev/futurable';

interface UseFuturableOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  autoFetch?: boolean;
}

function useFuturable<T>(
  fetcher: () => Futurable<T>,
  deps: React.DependencyList = [],
  options: UseFuturableOptions<T> = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { onSuccess, onError, autoFetch = true } = options;

  const execute = useCallback(() => {
    setLoading(true);
    setError(null);

    const request = fetcher()
      .then(result => {
        setData(result);
        setLoading(false);
        onSuccess?.(result);
        return result;
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setError(err);
          setLoading(false);
          onError?.(err);
        }
      });

    return request;
  }, deps);

  useEffect(() => {
    if (!autoFetch) return;

    const request = execute();
    return () => request.cancel();
  }, [execute, autoFetch]);

  const refetch = useCallback(() => {
    return execute();
  }, [execute]);

  const cancel = useCallback(() => {
    // Cancel any ongoing request
    setLoading(false);
  }, []);

  return { data, loading, error, refetch, cancel };
}

// Usage
function UserList() {
  const { data: users, loading, error, refetch } = useFuturable(
    () => Futurable.fetch('/api/users').then(r => r.json()),
    []
  );

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      <ul>
        {users?.map(user => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

### usePolling Hook

For real-time data updates:

```tsx
import { useEffect, useState } from 'react';
import { Futurable } from '@ndriadev/futurable';

function usePolling<T>(
  fetcher: () => Futurable<T>,
  interval: number,
  enabled = true
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const polling = Futurable.polling(
      () => fetcher().then(result => {
        setData(result);
        return result;
      }).catch(err => {
        if (err.name !== 'AbortError') {
          setError(err);
        }
        throw err;
      }),
      interval
    );

    return () => polling.cancel();
  }, [interval, enabled]);

  return { data, error };
}

// Usage
function ServerStatus() {
  const { data: status } = usePolling(
    () => Futurable.fetch('/api/status').then(r => r.json()),
    5000 // Poll every 5 seconds
  );

  return <div>Server Status: {status?.online ? '🟢' : '🔴'}</div>;
}
```

## Advanced Patterns

### Debounced Search

```tsx
import { useState, useEffect, useRef } from 'react';
import { Futurable } from '@ndriadev/futurable';

function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<Futurable<any> | null>(null);

  useEffect(() => {
    // Cancel previous request
    requestRef.current?.cancel();

    if (!query.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);

    // Debounce: wait 300ms before searching
    requestRef.current = new Futurable((resolve) => {
      setTimeout(() => resolve(query), 300);
    })
      .then(debouncedQuery => 
        Futurable.fetch(`/api/search?q=${debouncedQuery}`)
      )
      .then(response => response.json())
      .then(data => {
        setResults(data);
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Search failed:', err);
          setLoading(false);
        }
      });

    return () => requestRef.current?.cancel();
  }, [query]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search..."
      />
      {loading && <div>Searching...</div>}
      <ul>
        {results.map(result => (
          <li key={result.id}>{result.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Parallel Requests

```tsx
import { useEffect, useState } from 'react';
import { Futurable } from '@ndriadev/futurable';

function Dashboard() {
  const [data, setData] = useState({
    users: null,
    posts: null,
    comments: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const request = Futurable.all([
      Futurable.fetch('/api/users').then(r => r.json()),
      Futurable.fetch('/api/posts').then(r => r.json()),
      Futurable.fetch('/api/comments').then(r => r.json())
    ])
      .then(([users, posts, comments]) => {
        setData({ users, posts, comments });
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load dashboard:', err);
          setLoading(false);
        }
      });

    return () => request.cancel();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div>
      <h2>Users: {data.users?.length}</h2>
      <h2>Posts: {data.posts?.length}</h2>
      <h2>Comments: {data.comments?.length}</h2>
    </div>
  );
}
```

### Sequential with Dependencies

```tsx
import { useEffect, useState } from 'react';
import { Futurable } from '@ndriadev/futurable';

function UserPosts({ userId }: { userId: string }) {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    // First fetch user, then fetch their posts
    const request = Futurable
      .fetch(`/api/users/${userId}`)
      .then(response => response.json())
      .then(user => 
        Futurable.fetch(`/api/users/${user.id}/posts`)
      )
      .then(response => response.json())
      .then(setPosts)
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to load posts:', err);
        }
      });

    return () => request.cancel();
  }, [userId]);

  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

## Strict Mode Compatibility

React 18's Strict Mode intentionally double-invokes effects in development. Futurable handles this gracefully:

```tsx
function StrictModeExample() {
  useEffect(() => {
    console.log('Effect running');
    
    const request = Futurable.fetch('/api/data');
    
    return () => {
      console.log('Effect cleanup');
      request.cancel();
    };
  }, []);

  // In Strict Mode (dev only):
  // 1. Effect runs → fetch starts
  // 2. Effect cleanup → fetch cancelled
  // 3. Effect runs again → new fetch starts
  // Result: Only one fetch is active ✅
}
```

## Best Practices

### 1. Always Cancel in Cleanup

```tsx
// ✅ Good
useEffect(() => {
  const request = Futurable.fetch('/api/data');
  return () => request.cancel();
}, []);

// ❌ Bad - memory leak risk
useEffect(() => {
  Futurable.fetch('/api/data').then(setData);
  // No cleanup!
}, []);
```

### 2. Handle AbortError

```tsx
// ✅ Good
.catch(err => {
  if (err.name !== 'AbortError') {
    setError(err);
  }
})

// ❌ Bad - shows error on unmount
.catch(setError)
```

### 3. Use refs for Mutable Values

```tsx
// ✅ Good
const requestRef = useRef<Futurable<any> | null>(null);

useEffect(() => {
  requestRef.current?.cancel();
  requestRef.current = Futurable.fetch('/api/data');
  
  return () => requestRef.current?.cancel();
}, [dependency]);

// ❌ Bad - closure issues
let request;
useEffect(() => {
  request?.cancel(); // 'request' might be stale
  request = Futurable.fetch('/api/data');
}, [dependency]);
```

### 4. Combine with React Query or SWR

Futurable works great with data fetching libraries:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Futurable } from '@ndriadev/futurable';

function useUser(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: ({ signal }) => 
      Futurable.fetch(`/api/users/${userId}`, { signal })
        .then(r => r.json()),
  });
}
```

## Testing

### Mock Futurable in Tests

```tsx
import { render, waitFor } from '@testing-library/react';
import { Futurable } from '@ndriadev/futurable';

// Mock Futurable.fetch
jest.mock('@ndriadev/futurable', () => ({
  Futurable: {
    fetch: jest.fn()
  }
}));

test('loads user data', async () => {
  const mockUser = { id: 1, name: 'John' };
  
  (Futurable.fetch as jest.Mock).mockResolvedValue({
    json: () => Promise.resolve(mockUser)
  });

  const { getByText } = render(<UserProfile userId="1" />);

  await waitFor(() => {
    expect(getByText('John')).toBeInTheDocument();
  });
});
```

## Next Steps

- [Vue Integration](/examples/vue)
- [Node.js Examples](/examples/nodejs)
- [Advanced Patterns](/examples/advanced)
