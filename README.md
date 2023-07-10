(setq markdown-xhtml-header-content
      "<style type='text/css'>
h1 {
	border-bottom: unset;
}

h3 {
	margin-bottom: 3rem;
}

#badge-div-1 {
	margin-top: 3rem;
	display: flex;
	justify-content: center;
}

#badge-div-2 {
	display: flex;
	justify-content: center;
}
</style>")

<h1 align="center">Futurable</h1>
<h2 align="center">Javascript's Promise API with super powers!</h2>

<div id="badge-div-1">

[![npm version](https://img.shields.io/npm/v/%40ndriadev/futurable?color=orange&style=for-the-badge)](https://www.npmjs.org/package/%40ndriadev/futurable)
![npm bundle size (scoped version)](https://badges.hiptest.com:/bundlephobia/min/@ndriadev/futurable?color=yellow&label=SIZE&style=for-the-badge)
![npm](https://badges.hiptest.com:/npm/dm/@ndriadev/futurable?color=red&style=for-the-badge)
![NPM](https://badges.hiptest.com:/npm/l/@ndriadev/futurable?color=blue&registry_uri=https%3A%2F%2Fregistry.npmjs.com&style=for-the-badge)
</div>
<div id="badge-div-2">

![Statements](https://img.shields.io/badge/statements-100%25-brightgreen.svg?style=for-the-badge)
![Branches](https://img.shields.io/badge/branches-96.46%25-brightgreen.svg?style=for-the-badge)
![Functions](https://img.shields.io/badge/functions-100%25-brightgreen.svg?style=for-the-badge)
![Lines](https://img.shields.io/badge/lines-100%25-brightgreen.svg?style=for-the-badge)
</div>

<h3 align="center">
Power up for Javascript's Promise API with cancellation support and more.
</h3>

#  Summary
- [ToDo](#TODO)
- [Introduction](#introduction)
	- [Installation](#Installation)
- [Usage](#Usage)
	- [Use-case](#Use-case)
		- [React](#React)
- [API](#API)
	- [constructor](#constructor)
	- [cancel](#cancel)
	- [onCancel](#oncancelcb-callback)
	- [sleep](#sleeptimer-number)
	- [delay](#delaycb-callback-timer-number)
	- [fetch](#fetchurl-string--val--string-opts-object--requestinit)
	- [futurizable](#futurizablepromise-promise--val--promise)
	- [Futurable.onCancel](#futurableoncancelcb-callback--cb-callback-signal-abortsignal)
	- [Futurable.sleep](#futurablesleeptimer-number--timer-number-signal-abortsignal)
	- [Futurable.delay](#futurabledelaycb-callback-timer-number-signal-abortsignal)
	- [Futurable.fetch](#futurablefetchurl-string-opts-object--requestinit)
	- [Futurable.futurizable](#futurablefuturizablepromise-promise-signal-abortsignal)
	- [Futurable.all](#futurablealliterable-futurableiterable-signal-abortsignal)
	- [Futurable.allSettled](#futurableallsettlediterable-futurableiterable-signal-abortsignal)
	- [Futurable.any](#futurableanyiterable-futurableiterable-signal-abortsignal)
	- [Futurable.race](#futurableraceiterable-futurableiterable-signal-abortsignal)
- [License](#License)


#  ToDo
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
import { Futurable } from 'futurable'; 		// ok

const { Futurable } = require('futurable');	// ok
```

## Use-case
### React
Thanks to the use of this library, there is a simple and effective way to be able to cancel an Api request executed in a useEffect which, due to the Strict Mode, is executed twice:

*Example*
```jsx
export default function Component() {
	//...code

	useEffect(() => {
        const f;
        function callApi() {
            f = Futurable
            .fetch("...")
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
            "...",
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

	//...code
}
```

#  API
The methods implemented, excluding those that are by nature static can be used:
- During the construction of the futurable using the ***new*** operator;
- In the chain-style ***promise chaining***.

They are the following:
- [cancel](#cancel)
- [onCancel](#oncancelcb-callback)
- [sleep](#sleeptimer-number)
- [delay](#delaycb-callback-timer-number)
- [fetch](#fetchurl-string--val--string-opts-object--requestinit)
- [futurizable](#futurizablepromise-promise--val--promise)
- [Futurable.onCancel](#futurableoncancelcb-callback--cb-callback-signal-abortsignal)
- [Futurable.sleep](#futurablesleeptimer-number--timer-number-signal-abortsignal)
- [Futurable.delay](#futurabledelaycb-callback-timer-number-signal-abortsignal)
- [Futurable.fetch](#futurablefetchurl-string-opts-object--requestinit)
- [Futurable.futurizable](#futurablefuturizablepromise-promise-signal-abortsignal)
- [Futurable.all](#futurablealliterable-futurableiterable-signal-abortsignal)
- [Futurable.allSettled](#futurableallsettlediterable-futurableiterable-signal-abortsignal)
- [Futurable.any](#futurableanyiterable-futurableiterable-signal-abortsignal)
- [Futurable.race](#futurableraceiterable-futurableiterable-signal-abortsignal)

### constructor(executor: FuturableExecutor, signal?: AbortSignal)
Futurable is instantiable like a classic Promise.
```javascript
//Javascript Promise

const promise = new Promise((resolve, reject) => {
	const data = /*..async operations or other..*/
	resolve(data);
});

//Futurable
import { Futurable } from 'futurable';

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
- fetch;
- futurizable.

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

//...code

const futurable = asynchronousOperation();
	futurable.then(value => {
	//DO anything
});

//...code

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

//...code

futurable.cancel();

//OR

const futurable = new Futurable((res, rej) => {
	// asynchornous code..
	resolve(true);
});

//...code

futurable
.onCancel(() => console.log("Futurable cancelled"))
.then(val => .......);

//...code

futurable.cancel();
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
//...code

//OR

const futurable = new Futurable((res, rej) => {
	// asynchornous code..
	resolve(true);
});

//...code

futurable
.sleep(3000)
.then(val => .......);

//...code
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

//...code

//OR

const futurable = new Futurable((res, rej) => {
	// asynchornous code..
	resolve(true);
});

//...code

futurable
.delay((val)=> {
	console.log("delayed val", val);
	return val;
},3000)
.then(val => .......);

//...code
```

### fetch(url: string | (val => string), opts: object | RequestInit)
Extension of the fetch API with cancellation support. Url parameter can be a string or a function with receive value from futurable chaining as paremeter.

*Example*
```javascript
const futurable = new Futurable((resolve, reject, utils) => {
	utils.fetch(/*string url to fetch..*/)
	.then(val => resolve(val))
});

//...code

//OR

const futurable = new Futurable((res, rej) => {
	// asynchornous code..
	resolve(true);
});

//...code

futurable
.fetch(/*url to fetch..*/)
.then(val => .......);

//OR
futurable
.then(val => "https://...")
.fetch((val /* val came from previous then*/) => ..., ..)

//...code
```

<!---
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
--->
### futurizable(promise: Promise | (val => Promise))
Takes a promise and transforms it into a futurizable. Promise can be also a function that receives value from futurable chaining as parameter.

*Example*
```javascript
const futurable = new Futurable((resolve, reject, utils) => {
	utils.futurizable(new Promise(res => {
		//asynchronous code
		res(data);
	}))
	.then(val => resolve(val))
});

//...code

//OR

const futurable = new Futurable((res, rej) => {
	// asynchornous code..
	resolve(true);
});

//...code

futurable
.futurizable(/*promise to futurizable*/)
.then(val => .......);

//OR
futurable
.then(val => 3)
.futurizable((val /* val is 3 */) => new Promise(/*...*/) /*promise to futurizable*/, ..)

//...code
```

### Futurable.onCancel(cb: callback | {cb: callback, signal?: AbortSignal})
OnCancel static method. It accepts a callback or a object with cb property and an optional signal.

*Example*
```javascript
const controller = new AbortController();

//...code
Futurable.onCancel({
	cb: ()=>console.log("Cancelled"),
	signal: controller.signal
});
//...code
```

### Futurable.sleep(timer: number | {timer: number, signal?: AbortSignal})
Sleep static method. It accepts a timer or a object with timer property and an optional signal.

*Example*
```javascript
//...code

Futurable.sleep({
	timer: 3000,
	signal: signal
});

//...code
```

### Futurable.delay({cb: callback, timer: number, signal?: AbortSignal})
Delay static method. It accepts a object with timer and cb properties and an optional signal property.

*Example*
```javascript
const controller = new AbortController();
//...code

Futurable.delay({
	cb: ()=>console.log("Cancelled"),
	timer: 3000
});

//...code
```

### Futurable.fetch(url: string, opts: object | RequestInit)
Fetch static method.

*Example*
```javascript
//...code

Futurable.fetch(/*url string..*/, {method: "POST"});

//...code
```

### Futurable.futurizable({promise: Promise, signal: AbortSignal})
Futurizable static method.

*Example*
```javascript
const controller = new AbortController();
//...code

Futurable.futurizable({promise: /*promise to futurizable*/, signal: controller.signal});

//...code
```

### Futurable.all(iterable: FuturableIterable[], signal?: AbortSignal)
Extension of the static method all with cancellation support.

*Example*
```javascript
const controller = new AbortController();

//...code

Futurable.all([
	1,
	Futurable.resolve(true),
	new Futurable/*...*/
], controller.signal);

//...code
```

### Futurable.allSettled(iterable: FuturableIterable[], signal?: AbortSignal)
Extension of the static method allSettled with cancellation support.

*Example*
```javascript
const controller = new AbortController();

//...code

Futurable.allSettled([
	1,
	Futurable.resolve(true),
	new Futurable/*...*/
], controller.signal);

//...code
```

### Futurable.any(iterable: FuturableIterable[], signal?: AbortSignal)
Extension of the static method any with cancellation support.

*Example*
```javascript
const controller = new AbortController();
//...code

Futurable.any([
	1,
	Futurable.resolve(true),
	new Futurable/*...*/
], controller.signal);

//...code
```

### Futurable.race(iterable: FuturableIterable[], signal?: AbortSignal)
Extension of the static method race with cancellation support.

*Example*
```javascript
const controller = new AbortController();
//...code

Futurable.race([
	1,
	Futurable.resolve(true),
	new Futurable/*...*/
], controller.signal);

//...code
```


## License



Futurable is licensed under a [MIT License](./LICENSE).