# Introduction
Futurable is a library that extends Javascript's Promise API, adding a number of useful features and with support for Typescirpt. It can be used on both browser and node.

Often it happens where to develop a feature using promises that covers a particular need. Often there is a need to delay execution, or even to cancel what is in progress. Javascript's Promise API doesn't offer an immediate way to do this, so we are forced to implement the code ourselves that does what we need. The purpose of this library is to provide these features ready to use, without the user having to think about anything else.


:warning: If you intend to use the library in node, for versions lower than **17.5.0** it is necessary to install the *node-fetch* library, since the native support for the Fetch API was introduced by this version.

## TODO
[ ] Think about the possibility of making a static method that returns an object with the futurible, resolve, reject, utils properties inside to be used as done for usePromiser.



## Installation

```bash
npm install futurable # or yarn add futurable or pnpm add futurable
```
## Usage

La libreria supporta i formati UMD ESM e CJS, quindi può essere utilizzata come segue:

```javascript
import Futurable from 'futurable'; 			// ok
const Futurable = require('futurable'); 	// ok
```
### Instantiate Futurable
Futurable is instantiated like a classic Promise.
```javascript
import Futurable from 'futurable';

const futurable = new Futurable((resolve, reject) => {
	const data = /*..async operations or other..*/
	resolve(data);
});
```
But the Futurable constructor can receive a second parameter *signal*.
```javascript
const controller = new AbortController();

const futurable = new Futurable((resolve, reject) => {
	const data = /*..async operations or other..*/
	resolve(data);
}, controller.signal);
```
This parameter is an *AbortSignal*, and its usage will be explained below.


## License

MIT License.

## Keywords

promise, promises, promises-a, promises-aplus, async, await, deferred, deferreds, future, cancel, abort, delay, sleep, abortable, cancelable, futurable.