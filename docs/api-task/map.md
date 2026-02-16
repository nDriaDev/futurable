# map()

Transform the result of a task with a mapping function.

## Syntax

```typescript
task.map&lt;U&gt;(fn: (value: T) =&gt; U | Promise&lt;U&gt;): FuturableTask&lt;U&gt;
```

## Parameters

### `fn`

A function that transforms the task's result. Can be synchronous or asynchronous.

- **Input**: The resolved value of type `T`
- **Output**: The transformed value of type `U` (or `Promise&lt;U&gt;`)

## Return Value

A new `FuturableTask&lt;U&gt;` that resolves with the transformed value.

## Description

The `map()` method creates a new task that applies a transformation function to the result of the original task. This is the core method for functional composition, allowing you to chain multiple transformations.

### Key Characteristics

- **Pure Transformation**: Should not have side effects (use `tap()` for that)
- **Type-Safe**: Full TypeScript support for type transformations
- **Lazy**: Transformation only happens when `run()` is called
- **Chainable**: Returns a new task that can be further transformed
- **Error Propagation**: Errors bypass the transformation

## Examples

### Basic Transformation

```typescript
const task = FuturableTask
  .of(() =&gt; 5)
  .map(x =&gt; x * 2);

const result = await task.run(); // 10
```

### Async Transformation

```typescript
const task = FuturableTask
  .of(() =&gt; fetch('/api/user'))
  .map(response =&gt; response.json())
  .map(user =&gt; user.name);

const name = await task.run(); // "John Doe"
```

### Multiple Transformations

```typescript
const task = FuturableTask
  .of(() =&gt; [1, 2, 3, 4, 5])
  .map(arr =&gt; arr.filter(x =&gt; x &gt; 2))  // [3, 4, 5]
  .map(arr =&gt; arr.map(x =&gt; x * 2))     // [6, 8, 10]
  .map(arr =&gt; arr.reduce((a, b) =&gt; a + b, 0)); // 24

const result = await task.run(); // 24
```

### Object Transformation

```typescript
interface User {
  id: number;
  firstName: string;
  lastName: string;
}

const task = FuturableTask
  .of(() =&gt; fetch('/api/user'))
  .map(res =&gt; res.json())
  .map((user: User) =&gt; ({
    id: user.id,
    fullName: `${user.firstName} ${user.lastName}`
  }));

const transformed = await task.run();
// { id: 1, fullName: "John Doe" }
```

### Type Conversion

```typescript
// String to number
const task1 = FuturableTask
  .of(() =&gt; "42")
  .map(str =&gt; parseInt(str, 10));

// Number to formatted string
const task2 = FuturableTask
  .of(() =&gt; 1234.56)
  .map(num =&gt; num.toFixed(2))
  .map(str =&gt; `$${str}`);

await task2.run(); // "$1234.56"
```

### API Response Processing

```typescript
const fetchUsers = FuturableTask
  .fetch('/api/users')
  .map(res =&gt; res.json())
  .map(users =&gt; users.filter(u =&gt; u.active))
  .map(users =&gt; users.sort((a, b) =&gt; a.name.localeCompare(b.name)))
  .map(users =&gt; users.slice(0, 10));

const topUsers = await fetchUsers.run();
```

### Data Enrichment

```typescript
const enrichUser = FuturableTask
  .of(() =&gt; fetchUser(123))
  .map(user =&gt; ({
    ...user,
    displayName: `${user.firstName} ${user.lastName}`,
    age: calculateAge(user.birthDate),
    isAdult: calculateAge(user.birthDate) &gt;= 18
  }));
```

### Error Handling

```typescript
// map() is skipped if the task fails
const task = FuturableTask
  .of(() =&gt; {
    throw new Error('Failed');
  })
  .map(x =&gt; x * 2); // This never executes

try {
  await task.run();
} catch (error) {
  console.log(error.message); // "Failed"
}
```

### With Retry

```typescript
const resilientTask = FuturableTask
  .fetch('/api/data')
  .map(res =&gt; res.json())
  .retry(3)
  .map(data =&gt; processData(data));
```

### Conditional Transformation

```typescript
const task = FuturableTask
  .of(() =&gt; fetchValue())
  .map(value =&gt; value &gt; 100 ? 'high' : 'low')
  .map(category =&gt; `Category: ${category}`);
```

## Practical Examples

### Form Data Processing

```typescript
const submitForm = FuturableTask
  .of(() =&gt; {
    const formData = new FormData(form);
    return Object.fromEntries(formData);
  })
  .map(data =&gt; ({
    ...data,
    email: data.email.toLowerCase(),
    phone: data.phone.replace(/\D/g, '')
  }))
  .map(data =&gt; JSON.stringify(data))
  .flatMap(json =&gt;
    FuturableTask.fetch('/api/submit', {
      method: 'POST',
      body: json,
      headers: { 'Content-Type': 'application/json' }
    })
  )
  .map(res =&gt; res.json());
```

### Image Processing

```typescript
const processImage = FuturableTask
  .of(() =&gt; loadImage(url))
  .map(img =&gt; resizeImage(img, 800, 600))
  .map(img =&gt; applyFilter(img, 'sepia'))
  .map(img =&gt; addWatermark(img, logo))
  .map(img =&gt; img.toDataURL());
```

### CSV to JSON

```typescript
const csvToJson = FuturableTask
  .of(() =&gt; readFile('data.csv'))
  .map(content =&gt; content.split('\n'))
  .map(lines =&gt; lines.filter(line =&gt; line.trim()))
  .map(lines =&gt; {
    const headers = lines[0].split(',');
    const rows = lines.slice(1);
    return rows.map(row =&gt; {
      const values = row.split(',');
      return headers.reduce((obj, header, i) =&gt; {
        obj[header] = values[i];
        return obj;
      }, {});
    });
  });
```

### Price Calculation

```typescript
const calculateTotal = FuturableTask
  .of(() =&gt; fetchCartItems())
  .map(items =&gt; items.map(item =&gt; item.price * item.quantity))
  .map(prices =&gt; prices.reduce((sum, price) =&gt; sum + price, 0))
  .map(subtotal =&gt; subtotal * 1.1) // Add 10% tax
  .map(total =&gt; total.toFixed(2))
  .map(total =&gt; `$${total}`);
```

## Comparison with flatMap()

```typescript
// map() - for value transformations
const task1 = FuturableTask
  .of(() =&gt; 5)
  .map(x =&gt; x * 2); // Returns 10

// flatMap() - for task transformations
const task2 = FuturableTask
  .of(() =&gt; 5)
  .flatMap(x =&gt; FuturableTask.of(() =&gt; x * 2)); // Returns 10

// map() with task returns nested task (wrong!)
const task3 = FuturableTask
  .of(() =&gt; 5)
  .map(x =&gt; FuturableTask.of(() =&gt; x * 2));
// Returns FuturableTask&lt;FuturableTask&lt;number&gt;&gt; ❌
```

## Type Transformations

```typescript
// String to number
FuturableTask.of(() =&gt; "42")
  .map(str =&gt; parseInt(str)); // FuturableTask&lt;number&gt;

// Number to boolean
FuturableTask.of(() =&gt; 42)
  .map(num =&gt; num &gt; 0); // FuturableTask&lt;boolean&gt;

// Object to array
FuturableTask.of(() =&gt; ({ a: 1, b: 2 }))
  .map(obj =&gt; Object.values(obj)); // FuturableTask&lt;number[]&gt;

// Array to object
FuturableTask.of(() =&gt; [['a', 1], ['b', 2]])
  .map(entries =&gt; Object.fromEntries(entries)); // FuturableTask&lt;object&gt;
```

## Best Practices

### 1. Keep Transformations Pure

```typescript
// ✅ Good - pure function
.map(x =&gt; x * 2)

// ❌ Bad - side effect
.map(x =&gt; {
  console.log(x); // Side effect
  return x * 2;
})

// ✅ Use tap() for side effects
.tap(x =&gt; console.log(x))
.map(x =&gt; x * 2)
```

### 2. Chain Multiple Maps

```typescript
// ✅ Good - clear chain of transformations
FuturableTask.of(() =&gt; data)
  .map(d =&gt; validate(d))
  .map(d =&gt; normalize(d))
  .map(d =&gt; transform(d))

// ❌ Bad - doing everything in one map
.map(d =&gt; transform(normalize(validate(d))))
```

### 3. Use Type Annotations When Needed

```typescript
// ✅ Explicit type for clarity
.map((user: User) =&gt; ({
  id: user.id,
  name: user.name
}))

// Or let TypeScript infer
.map(user =&gt; ({
  id: user.id,
  name: user.name
}))
```

### 4. Handle Null/Undefined

```typescript
// ✅ Good - handle null values
.map(value =&gt; value ?? defaultValue)
.map(value =&gt; value.toUpperCase())

// ❌ Bad - may throw
.map(value =&gt; value.toUpperCase()) // Error if null
```

## Error Handling

```typescript
// Transformation throws error
const task = FuturableTask
  .of(() =&gt; "not a number")
  .map(str =&gt; {
    const num = parseInt(str);
    if (isNaN(num)) {
      throw new Error('Invalid number');
    }
    return num;
  });

const safe = task
  .fallbackTo(error =&gt; {
    console.error(error);
    return 0;
  });
```

## Performance Considerations

```typescript
// ✅ Efficient - transformations only on success
FuturableTask.of(() =&gt; expensiveOperation())
  .map(result =&gt; transform1(result))
  .map(result =&gt; transform2(result))
  .retry(3);

// Transformations only run on successful attempts

// ❌ Inefficient - computing in source
FuturableTask.of(() =&gt; {
  const result = expensiveOperation();
  return transform2(transform1(result));
}).retry(3);
// Transformations run on every retry attempt
```

## Notes

- `map()` is lazy - transformation only happens when `run()` is called
- If the task fails, `map()` is skipped
- Can be chained multiple times for complex transformations
- Use `flatMap()` when the transformation returns a FuturableTask
- Use `tap()` for side effects
- Transformations are applied in order
- Each `map()` creates a new task (original is unchanged)

## See Also

- [flatMap()](/api-task/flat-map) - Transform to another task
- [filter()](/api-task/filter) - Conditional success
- [tap()](/api-task/tap) - Side effects without transformation
- [Functional Composition Guide](/guide-task/composition)