# filter()

Conditionally succeed or fail based on a predicate.

## Syntax

```typescript
task.filter(
  predicate: (value: T) =&gt; boolean | Promise&lt;boolean&gt;,
  errorMessage?: string
): FuturableTask&lt;T&gt;
```

## Parameters

### `predicate`
Function that tests the value. If returns `false`, the task fails.

### `errorMessage` (optional)
Custom error message when predicate fails. Default: "Filter predicate failed"

## Return Value

A new `FuturableTask&lt;T&gt;` that fails if the predicate returns false.

## Examples

### Basic Validation

```typescript
const task = FuturableTask
  .of(() =&gt; fetch('/api/user'))
  .map(res =&gt; res.json())
  .filter(user =&gt; user.age &gt;= 18);

try {
  const adult = await task.run();
} catch (error) {
  console.log('User is not an adult');
}
```

### Custom Error Message

```typescript
const task = FuturableTask
  .of(() =&gt; getUserInput())
  .filter(
    input =&gt; input.length &gt;= 3,
    'Input must be at least 3 characters'
  );
```

### Async Predicate

```typescript
const task = FuturableTask
  .of(() =&gt; fetchDocument())
  .filter(async doc =&gt; await validateDocument(doc));
```

### Multiple Filters

```typescript
const task = FuturableTask
  .of(() =&gt; fetchProduct())
  .filter(p =&gt; p.price &gt; 0, 'Price must be positive')
  .filter(p =&gt; p.stock &gt; 0, 'Product out of stock')
  .filter(p =&gt; !p.discontinued, 'Product discontinued');
```

## See Also

- [map()](/api-task/map)
