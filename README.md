
<h1 align="center">Futurable</h1>
<p align="center">
Power up for Javascript's Promise API with cancellation support and more.
</p>
<p align="center">
<a  href="https://www.npmjs.com/package/futurable">
<img  src="https://img.shields.io/npm/v/futurable?color=orange&label="  alt="version" />
</a>
</p>


#  Summary
- [ToDo](#TODO)
- [Introduction](#introduction)
	- [Installation](#Installation)
- [Usage](#Usage)
	- [Methods](#Methods)
- [API](#API)
- [License](#License)


#  ToDo
- A method *Futurizable* to take a promise and transform it into a futurable.
- Think about the possibility of making a static method that returns an object with the futurable, resolve, reject, utils properties inside to be used as done for usePromiser.


#  Introduction
Futurable is a library that extends Javascript's Promise API, adding a number of useful features and with support for Typescirpt. It can be used on both browser and node.

Often it happens where to develop a feature using promises that covers a particular need. Often there is a need to delay execution, or even to cancel what is in progress. Javascript's Promise API doesn't offer an immediate way to do this, so we are forced to implement the code ourselves that does what we need. The purpose of this library is to provide these features ready to use, without the user having to think about anything else.

:warning: If you intend to use the library in node, for versions lower than **17.5.0** it is necessary to install the *node-fetch* library, since the native support for the Fetch API was introduced by this version.

##  Installation
```bash

npm  install  futurable  # or yarn add futurable or pnpm add futurable

```


#  Usage
The library supports both ESM and CJS formats, so it can be used as follows:
```javascript
import Futurable from 'futurable'; 		// ok

const { Futurable } = require('futurable');	// ok
```

## Usecase
### React
Thanks to the use of this library, there is a simple and effective way to be able to cancel an Api request executed in a useEffect which, due to the Strict Mode, is executed twice:
```jsx
export default function Component() {
	....
	....

	useEffect(() => {
        const f;
        function callApi() {
            f = Futurable
            .fetch("https://jsonplaceholder.typicode.com/todos/2")
            .onAbort(() => console.log("aborted"))
            .then(resp => resp.json())
            .then(setTodo);
        }
        callApi();
        return () => {
            f && f.cancel();
        }
    },[])

	//OR

	useEffect(() => {
        const controller = new AbortController();
        Futurable
        .fetch(
            "https://jsonplaceholder.typicode.com/todos/2",
            {
                signal: controller.signal
            }
        )
        .then(resp => resp.json())
        .then(setTodo);

        return () => {
            controller.abort();
        }
    },[])

	....
	....
}
```

#  API
The methods implemented, excluding those that are by nature static can be used:
- During the construction of the futurable using the ***new*** operator;
- In the chain-style ***promise chaining***.

They are the following:
- [cancel](#cancel)
- [onCancel](#onCancel)
- [sleep](#sleep)
- [delay](#delay)
- [fetch](#fetch)
- [promisify](#promisify)
- [futurizable](#futurizable)
- [Futurable.onCancel](#Futurable.onCancel)
- [Futurable.sleep](#Futurable.sleep)
- [Futurable.delay](#Futurable.delay)
- [Futurable.all](#Futurable.all)
- [Futurable.allSettled](Futurable.allSettled)
- [Futurable.race](#Futurable.race)
- [Futurable.any](#Futurable.any)
###  new Futurable(executor: FuturableExecutor, signal?: AbortSignal)
Futurable is instantiable like a classic Promise.
```javascript
//Javascript Promise

const promise = new Promise((resolve, reject) => {
	const data = /*..async operations or other..*/
	resolve(data);
});

//Futurable
import Futurable from 'futurable';

const futurable = new Futurable((resolve, reject) => {
	const data = /*..async operations or other..*/
	resolve(data);
});
```
But it provides two more statements:

1. Its constructor can receive a second parameter *signal*, an *AbortSignal*, usable to cancel the promise from the outside.

```javascript
const controller = new AbortController();

const futurable = new Futurable((resolve, reject) => {
	const data = /*..async operations or other..*/
	resolve(data);
}, controller.signal);
```

2. The executor function passed to the promise receives a third parameter, *utils*, optional.

```javascript
const controller = new AbortController();

const futurable = new Futurable((resolve, reject, utils) => {
	const data = /*..async operations or other..*/
	resolve(data);
});
```
Utils is an object with the following properties which mirror the methods described in the usage section and which will be described below:
- cancel;
- onCancel:
- delay;
- sleep;
- fetch.
In addition is has:
- signal: internal futurable signal;

### cancel()
If invoked, it cancel the futurable if it is to be executed or if it is still executing.

*Example*
```javascript
function asynchronousOperation() {
	return new Futurable((res, rej) => {
		// asynchornous code..
		resolve(true);
	});
);
....
....
const futurable = asynchronousOperation();
futurable.then(value => {
	//DO anything
});
....
....
futurable.cancel();
```

### onCancel(cb: callback)
If it is invoked, when the futurable is cancelled, it executes the callback passed as a parameter.

*Example*
```javascript
const futurable = new Futurable((resolve, reject, utils) => {
	utils.onCancel(() => console.log("Futurable cancelled"));
	const data = /*..async operations or other..*/
	resolve(data);
});
...
...
futurable.cancel();

//OR

const futurable = new Futurable((res, rej) => {
	// asynchornous code..
	resolve(true);
});
...
...
f
.onCancel(() => console.log("Futurable cancelled"))
.then(val => .......);
...
...
f.cancel();
```
```bash
Output: Futurable cancelled
```

### sleep(timer: number)
Waits for timer parameter (in milliseconds) before returning the value.

*Example*
```javascript
const futurable = new Futurable((resolve, reject, utils) => {
	const data = /*..async operations or other..*/
	utils.sleep(3000);
	resolve(data);
});
...
...

//OR

const futurable = new Futurable((res, rej) => {
	// asynchornous code..
	resolve(true);
});
...
...
f
.sleep(3000)
.then(val => .......);
...
...
```

### delay(cb: callback, timer: number)
Waits for timer parameter (in milliseconds), then executes callback with the futurable value and returns the result obtained from the invocation.
*Example*
```javascript
const futurable = new Futurable((resolve, reject, utils) => {
	const data = /*..async operations or other..*/
	utils.delay(()=>console.log("delayed"), 3000);
	resolve(data);
});
...
...

//OR

const futurable = new Futurable((res, rej) => {
	// asynchornous code..
	resolve(true);
});
...
...
f
.delay((val)=> {
	console.log("delayed val", val);
	return val;
},3000)
.then(val => .......);
...
...
```

### fetch(url: string, opts: object | RequestInit)
Extension of the fetch API with cancellation support.

*Example*
```javascript
const futurable = new Futurable((resolve, reject, utils) => {
	utils.fetch(/*url to fetch..*/)
	.then(val => resolve(val))
});
...
...

//OR

const futurable = new Futurable((res, rej) => {
	// asynchornous code..
	resolve(true);
});
...
...
f
.fetch(/*url to fetch..*/)
.then(val => .......);
...
...
```

### promisify()
Transforms the futurable into a normal promise in order to be able to use the async/await syntax but keeping possibility to cancel futurable until its invocation.

*Example*
```javascript
async function op() {
	...
	...
	await Futurable.sleep(3000).promisify();
}
```

### futurizable //Work in progress
Takes a promise and transforms it into a futurizable.

*Example*
```javascript

//TODO

```

### Futurable.onCancel(cb: callback | {cb: callback, signal?: AbortSignal})
OnCancel static method. It accepts a callback or a object with cb property and an optional signal.

*Example*
```javascript
const controller = new AbortController();

...
...
Futurable.onCancel({
	cb: ()=>console.log("Cancelled"),
	signal: controller.signal
});
...
...
```

### Futurable.sleep(timer: number | {timer: number, signal?: AbortSignal})
Sleep static method. It accepts a timer or a object with timer property and an optional signal.

*Example*
```javascript
...
...
Futurable.sleep({
	timer: 3000,
	signal: signal
});
...
...
```

### Futurable.delay({cb: callback, timer: number, signal?: AbortSignal})
Delay static method. It accepts a object with timer and cb properties and an optional signal property.

*Example*
```javascript
const controller = new AbortController();

...
...
Futurable.delay({
	cb: ()=>console.log("Cancelled"),
	timer: 3000
});
...
...
```

### Futurable.fetch(url: string, opts: object | RequestInit)
Fetch static method.

*Example*
```javascript
...
...
Futurable.fetch(/*url string..*/, {method: "POST});
...
...
```

### Futurable.all(iterable: FuturableIterable[], signal?: AbortSignal)
Extension of the static method all with cancellation support.

*Example*
```javascript
const controller = new AbortController();

...
...
Futurable.all([
	1,
	Futurable.resolve(true),
	new Futurable/*...*/
], controller.signal);
...
...
```

### Futurable.allSettled(iterable: FuturableIterable[], signal?: AbortSignal)
Extension of the static method allSettled with cancellation support.

*Example*
```javascript
const controller = new AbortController();

...
...
Futurable.allSettled([
	1,
	Futurable.resolve(true),
	new Futurable/*...*/
], controller.signal);
...
...
```

### Futurable.any(iterable: FuturableIterable[], signal?: AbortSignal)
Extension of the static method any with cancellation support.

*Example*
```javascript
const controller = new AbortController();

...
...
Futurable.any([
	1,
	Futurable.resolve(true),
	new Futurable/*...*/
], controller.signal);
...
...
```

### Futurable.race(iterable: FuturableIterable[], signal?: AbortSignal)
Extension of the static method race with cancellation support.

*Example*
```javascript
const controller = new AbortController();

...
...
Futurable.race([
	1,
	Futurable.resolve(true),
	new Futurable/*...*/
], controller.signal);
...
...
```


## License



Futurable is licensed under a [MIT License](./LICENSE).