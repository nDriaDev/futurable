/**
 * Result type for safe operations that may succeed or fail.
 * Provides a discriminated union for type-safe error handling without try-catch.
 *
 * @template T - The type of the success value
 * @template E - The type of the error (defaults to Error)
 */
export type SafeResult<T, E = Error> =
	| { success: true; data: T; error: null }
	| { success: false; data: null; error: E };

/**
* A thenable-like interface that represents a value that may be available now, in the future, or never.
* Compatible with both Promises and Futurables, allowing for flexible composition.
*
* @template T - The type of the value that will be resolved
*/
export interface FuturableLike<T> {
	/**
	* Attaches callbacks for the resolution and/or rejection of the Futurable.
	*
	* @template TResult1 - The type returned by the fulfillment callback
	* @template TResult2 - The type returned by the rejection callback
	* @param onfulfilled - The callback to execute when the Futurable is resolved
	* @param onrejected - The callback to execute when the Futurable is rejected
	* @returns A new Futurable for the completion of whichever callback is executed
	*/
	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1> | FuturableLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2> | FuturableLike<TResult2>) | undefined | null
	): FuturableLike<TResult1 | TResult2>;
}

/**
* Function signature for resolving a Futurable with a value.
* Accepts a direct value, a Promise, or another Futurable.
*
* @template T - The type of the value to resolve with
* @param value - The value, Promise, or Futurable to resolve with
*/
export interface FuturableResolve<T> {
	(value: T | FuturableLike<T> | PromiseLike<T>): void;
}

/**
* Function signature for rejecting a Futurable with a reason.
*
* @param reason - The reason for rejection (typically an Error)
*/
export interface FuturableReject {
	(reason?: any): void;
}

/**
* Utility methods and properties available within a Futurable executor.
* Provides advanced features like cancellation, delays, HTTP fetching, and signal management.
*
* @template T - The type of value the Futurable will resolve to
*/
export interface FuturableUtils<T> {
	/**
	* Internal AbortSignal for cancellation support.
	* This signal is aborted when the Futurable is cancelled.
	*/
	signal: AbortSignal;
	/**
	* Cancels the Futurable if it is pending or currently executing.
	* Triggers the abort signal and executes any registered onCancel callbacks.
	*/
	cancel: () => void;
	/**
	* Registers a callback to be executed when the Futurable is cancelled.
	* Multiple callbacks can be registered and will be executed in order.
	*
	* @param cb - The callback function to execute on cancellation
	*/
	onCancel: (cb: () => void) => void;
	/**
	* Waits for a specified duration, then executes a callback and returns the result.
	* The delay is cancellable via the Futurable's signal.
	*
	* @template TResult - The type returned by the callback
	* @template TResult2 - The type in case of rejection (defaults to never)
	* @param cb - The callback to execute after the timer expires
	* @param timer - The delay duration in milliseconds
	* @returns A new Futurable that resolves with the callback's result
	*/
	delay: <TResult = T, TResult2 = never>(cb: () => TResult, timer: number) => Futurable<TResult | TResult2>;
	/**
	* Pauses execution for a specified duration.
	* Equivalent to delay with an empty callback.
	*
	* @param timer - The duration to wait in milliseconds
	* @returns A Futurable that resolves after the timer expires
	*/
	sleep: (timer: number) => Futurable<void>;
	/**
	* Extension of the native Fetch API with automatic cancellation support.
	* The request is automatically cancelled if the Futurable is cancelled.
	*
	* @param url - The URL to fetch
	* @param opts - Optional Fetch API options (signal will be automatically provided)
	* @returns A Futurable that resolves with the Response object
	*/
	fetch: (url: string, opts?: RequestInit) => Futurable<Response>;
	/**
	* Converts a standard Promise into a Futurable with cancellation support.
	* The original Promise cannot be cancelled, but the Futurable wrapper can be.
	*
	* @template TResult - The type the Promise resolves to
	* @param promise - The Promise to convert
	* @returns A Futurable wrapping the Promise
	*/
	futurizable: <TResult = any>(promise: Promise<TResult>) => Futurable<TResult>;
}

/**
* Executor function signature for creating a new Futurable.
* Similar to the Promise executor, but with additional utilities for cancellation and async operations.
*
* @template T - The type of value the Futurable will resolve to
* @param resolve - Function to resolve the Futurable with a value
* @param reject - Function to reject the Futurable with a reason
* @param utils - Utility object containing cancellation and async helpers
*/
export type FuturableExecutor<T> = (
	resolve: FuturableResolve<T>,
	reject: FuturableReject,
	utils: FuturableUtils<T>
) => void;

/**
* An iterable collection of values that can be Futurables, Promises, or plain values.
* Used by static methods like Futurable.all(), Futurable.race(), etc.
*
* @template T - The type of values in the iterable
*/
export type FuturableIterable<T = any> = Iterable<FuturableLike<T> | PromiseLike<T> | T>;

/**
* Internal status tracking for Futurable lifecycle.
*/
enum FUTURABLE_STATUS {
	/** The Futurable has been created but not yet resolved or rejected */
	PENDING = "pending",
	/** The Futurable has been successfully resolved with a value */
	FULFILLED = "fulfilled",
	/** The Futurable has been rejected with a reason */
	REJECTED = "rejected"
}

/**
* Return type of Futurable.withResolvers() static method.
* Provides direct access to the Futurable and its control functions.
*
* @template T - The type of value the Futurable will resolve to
*/
export interface FuturableWithResolvers<T> {
	/** The created Futurable or Promise instance */
	promise: Futurable<T> | Promise<T>;
	/** Function to resolve the Futurable with a value */
	resolve: (value: T | PromiseLike<T> | FuturableLike<T>) => void;
	/** Function to reject the Futurable with a reason */
	reject: (reason?: any) => void;
	/** Function to cancel the Futurable */
	cancel: () => void;
	/** Utility object with advanced Futurable features */
	utils: FuturableUtils<T>;
}

/**
* Return type of Futurable.polling() static method.
* Provides controls for a polling operation.
*/
export interface FuturablePollingController {
	/** Stops the polling and cancels any pending operations */
	cancel: () => void;
	/** Registers an error handler for polling operations */
	catch: (onrejected: (reason: unknown) => void) => void;
}

/**
* A cancellable Promise implementation with extended async utilities.
*
* Futurable extends the native Promise API with:
* - Built-in cancellation via AbortSignal
* - Chainable delay and sleep operations
* - Integrated fetch with automatic cancellation
* - Polling capabilities
* - Promise-to-Futurable conversion
*
* @template T - The type of value this Futurable will resolve to
*
* @example
* ```typescript
* // Basic usage with cancellation
* const futurable = new Futurable((resolve, reject, { signal }) => {
*   const timeoutId = setTimeout(() => resolve('done'), 5000);
*   signal.addEventListener('abort', () => clearTimeout(timeoutId));
* });
*
* // Cancel after 1 second
* setTimeout(() => futurable.cancel(), 1000);
* ```
*/
export class Futurable<T> extends Promise<T> {
	private controller;
	private internalSignal;
	private idsTimeout;

	constructor(executor: FuturableExecutor<T>, signal?: AbortSignal) {
		const controller: AbortController = new AbortController();
		const sign = controller!.signal;
		const idsTimeout: ReturnType<typeof setTimeout>[] = [];

		if (signal) {
			if (signal.aborted) {
				controller.abort();
			} else {
				signal.addEventListener('abort', () => controller.abort(), { once: true });
			}
		}

		let abortCb: (() => void)[] = [];
		let status = FUTURABLE_STATUS.PENDING;

		const onCancel = (cb: () => void): void => {
			abortCb.push(cb);
		};

		const clearTimeouts = () => {
			for (const timeout of idsTimeout) {
				clearTimeout(timeout);
			}
			idsTimeout.length = 0;
		}

		const utils: FuturableUtils<T> = {
			signal: sign,
			cancel: (): void => controller.abort(),
			onCancel,
			delay: (cb, timer) => {
				return new Futurable(res => {
					idsTimeout.push(setTimeout(() => {
						res(cb());
					}, timer));
				}, sign);
			},
			sleep: (timer) => {
				return utils.delay(() => { }, timer);
			},
			fetch: (url: string, opts?: RequestInit): Futurable<Response> => {
				return new Futurable<Response>((res, rej) => {
					fetch(url, { ...(opts || {}), signal: sign })
					.then(val => res(val))
					.catch(err => {
						if (err.name === "AbortError") {
							return;
						} else {
							rej(err);
						}
					});
				}, sign);
			},
			futurizable: (promise) => {
				return new Futurable((res, rej) => {
					promise
					.then(res)
					.catch(rej);
				}, sign);
			}
		};

		const p = new Promise<T>((resolve, reject) => {
			if (!sign.aborted) {
				const handleAbort = () => {
					clearTimeouts();
					if (status === FUTURABLE_STATUS.PENDING) {
						abortCb.forEach(cb => cb());
					}
					abortCb = [];
				}
				const cleanup = () => {
					sign.removeEventListener('abort', handleAbort);
				};
				sign.addEventListener('abort', handleAbort, { once: true });

				const res: FuturableResolve<T> = (val) => {
					status = FUTURABLE_STATUS.FULFILLED;
					cleanup();
					resolve(val as T | PromiseLike<T>);
				};
				const rej: FuturableReject = (reason) => {
					status = FUTURABLE_STATUS.REJECTED;
					cleanup();
					reject(reason);
				};

				executor(res, rej, utils);
			} else {
				clearTimeouts();
				return;
			}
		});

		super((resolve, reject) => {
			p.then(val => resolve(val)).catch(reject);
		});

		this.controller = controller;
		this.internalSignal = sign;
		this.idsTimeout = idsTimeout;
	}

	static get [Symbol.species]() {
		return this;
	}

	get [Symbol.toStringTag]() {
		return 'Futurable';
	}

	/**
	* Returns the internal AbortSignal used for cancellation.
	* This signal is aborted when cancel() is called.
	*
	* @returns The internal AbortSignal
	*/
	get signal(): AbortSignal {
		return this.internalSignal;
	}

	private clearTimeout() {
		for (const timeout of this.idsTimeout) {
			clearTimeout(timeout);
		}
		this.idsTimeout.length = 0;
	}

	/**
	* Attaches callbacks for the resolution and/or rejection of the Futurable.
	* Chainable method that returns a new Futurable.
	*
	* @template TResult1 - Type returned by the fulfillment callback
	* @template TResult2 - Type returned by the rejection callback
	* @param onfulfilled - Callback executed when the Futurable is resolved
	* @param onrejected - Callback executed when the Futurable is rejected
	* @returns A new Futurable for the completion of the callback
	*/
	then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1> | FuturableLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2> | FuturableLike<TResult2>) | undefined | null): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>,
			reject: FuturableReject;
		const p = new Futurable<TResult1 | TResult2>((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.internalSignal);

		p.controller = this.controller;
		super.then(val => {
			if (this.internalSignal?.aborted) {
				this.clearTimeout();
				return;
			}
			try {
				if (onfulfilled) {
					resolve(onfulfilled(val));
				} else {
					resolve(val as unknown as TResult1);
				}
			} catch (error) {
				reject(error);
			}
		}, reason => {
			if (this.internalSignal?.aborted) {
				this.clearTimeout();
				return;
			}
			try {
				if (onrejected) {
					resolve(onrejected(reason));
				} else {
					reject(reason);
				}
			} catch (error) {
				reject(error);
			}
		});
		return p;
	}

	/**
	* Attaches a callback for only the rejection of the Futurable.
	*
	* @template TResult2 - Type returned by the rejection callback
	* @param onRejected - Callback executed when the Futurable is rejected
	* @returns A new Futurable
	*/
	catch<TResult2 = never>(onRejected: ((reason: any) => TResult2 | PromiseLike<TResult2> | FuturableLike<TResult2>) | undefined | null): Futurable<T | TResult2> {
		return this.then(null, onRejected);
	}

	/**
	* Attaches a callback that is invoked when the Futurable is settled (fulfilled or rejected).
	* The resolved value cannot be modified from the callback.
	*
	* @param onfinally - Callback executed when the Futurable settles
	* @returns A new Futurable with the same value
	*/
	finally(onfinally: () => void | undefined | null): Futurable<T> {
		return this.then(
			(val) => {
				onfinally();
				return val;
			},
			(reason) => {
				onfinally();
				if (reason instanceof Error) {
					throw reason;
				}
				return reason;
			}
		);
	}

	/**
	* Cancels the Futurable if it is pending or currently executing.
	* Aborts the internal signal and triggers all registered onCancel callbacks.
	*
	* @example
	* ```typescript
	* const futurable = new Futurable((resolve) => {
	*   setTimeout(() => resolve('done'), 5000);
	* });
	* futurable.cancel(); // Cancels the operation
	* ```
	*/
	cancel(): void {
		!this.internalSignal?.aborted && this.controller.abort();
	}

	/**
	* Waits for a specified duration, then executes a callback with the Futurable's value.
	* The delay is cancellable via the Futurable's signal.
	*
	* @template TResult1 - Type returned by the callback
	* @template TResult2 - Type in case of rejection
	* @param cb - Callback executed after the delay, receives the resolved value
	* @param timer - Delay duration in milliseconds
	* @returns A new Futurable that resolves with the callback's result
	*
	* @example
	* ```typescript
	* Futurable.resolve(5)
	*   .delay(val => val * 2, 1000) // Wait 1s, then multiply by 2
	*   .then(result => console.log(result)); // Logs: 10
	* ```
	*/
	delay<TResult1 = T, TResult2 = never>(cb: (val: T) => TResult1 | PromiseLike<TResult1> | FuturableLike<TResult1>, timer: number): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const p = new Futurable<TResult1 | TResult2>((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.internalSignal);
		p.controller = this.controller;
		this.then(
			val => {
				this.idsTimeout.push(setTimeout(() => resolve(cb(val)), timer));
			},
			reason => {
				reject(reason);
			}
		);
		return p;
	}

	/**
	* Pauses execution for a specified duration before passing through the value.
	* Equivalent to delay with an identity callback.
	*
	* @param timer - Duration to wait in milliseconds
	* @returns A new Futurable that resolves with the same value after the delay
	*
	* @example
	* ```typescript
	* Futurable.resolve('hello')
	*   .sleep(2000) // Wait 2 seconds
	*   .then(val => console.log(val)); // Logs: "hello" after 2s
	* ```
	*/
	sleep(timer: number): Futurable<T> {
		return this.delay(val => val, timer);
	}

	/**
	* Performs an HTTP fetch operation with automatic cancellation support.
	* The request is automatically cancelled if the Futurable is cancelled.
	*
	* @param url - URL to fetch, or a function that receives the Futurable's value and returns a URL
	* @param opts - Fetch options, or a function that receives the Futurable's value and returns fetch options
	* @returns A new Futurable that resolves with the Response object
	*
	* @example
	* ```typescript
	* Futurable.resolve('users')
	*   .fetch(endpoint => `https://api.example.com/${endpoint}`)
	*   .then(response => response.json())
	*   .then(data => console.log(data));
	* ```
	*/
	fetch(url: string | ((val: T) => string), opts?: object | RequestInit | ((val: T) => RequestInit)): Futurable<Response> {
		let resolve: FuturableResolve<Response>, reject: FuturableReject;
		const p = new Futurable<Response>((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.internalSignal);
		p.controller = this.controller;
		this.then(val => {
			const urlFetch = typeof url === "function" ? url(val) : url,
			optsFetch = { ...(typeof opts === "function" ? opts(val) : opts), signal: this.internalSignal };

			fetch(urlFetch, optsFetch)
			.then(val => resolve(val))
			.catch(err => {
				if (err.name === "AbortError") {
					return;
				} else {
					reject(err);
				}
			});
		});
		return p;
	}

	/**
	* Registers a callback to be executed when the Futurable is cancelled.
	* Useful for cleanup operations or aborting dependent async tasks.
	*
	* @template TResult1 - Type in case of resolution
	* @template TResult2 - Type in case of rejection
	* @param cb - Callback executed on cancellation
	* @returns A new Futurable
	*
	* @example
	* ```typescript
	* const futurable = new Futurable((resolve) => {
	*   const task = startLongTask();
	*   setTimeout(() => resolve('done'), 5000);
	* }).onCancel(() => {
	*   console.log('Operation cancelled, cleaning up...');
	* });
	* ```
	*/
	onCancel<TResult1 = void, TResult2 = never>(cb: () => void): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const f = new Futurable<TResult1 | TResult2>((res, rej, utils) => {
			utils.onCancel(cb);
			resolve = res;
			reject = rej;
		}, this.internalSignal);
		f.controller = this.controller;

		this.then(
			val => resolve(val as unknown as TResult1),
			reason => reject(reason)
		);
		return f;
	}

	/**
	* Converts a Promise into a Futurable with cancellation support.
	* The Promise can be provided directly or via a function that receives the current value.
	*
	* @template TResult1 - Type the Promise resolves to
	* @template TResult2 - Type in case of rejection
	* @param promise - Promise to convert, or a function that receives the Futurable's value and returns a Promise
	* @returns A new Futurable wrapping the Promise
	*
	* @example
	* ```typescript
	* Futurable.resolve(123)
	*   .futurizable(val => fetch(`/api/${val}`).then(r => r.json()))
	*   .then(data => console.log(data));
	* ```
	*/
	futurizable<TResult1 = T, TResult2 = never>(promise: Promise<TResult1> | ((val?: T) => Promise<TResult1>)): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const f = new Futurable<TResult1 | TResult2>((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.internalSignal);
		f.controller = this.controller;
		this.then(val => {
			const p = typeof promise === "function" ? promise(val) : promise;
			p
			.then(resolve)
			.catch(reject);
		});
		return f;
	}

	/**
	 * Wraps the Futurable in a safe execution context that never throws.
	 * Returns a result object containing either the resolved value or the error,
	 * eliminating the need for try-catch blocks or .catch() handlers.
	 *
	 * This method is particularly useful in async/await contexts where you want
	 * to handle errors explicitly without wrapping code in try-catch blocks.
	 *
	 * @template TError - The type of the error (defaults to unknown)
	 * @returns A Futurable that resolves to a SafeResult containing either data or error
	 *
	 * @example
	 * ```typescript
	 * // Instead of try-catch:
	 * const result = await Futurable.fetch('/api/data')
	 *   .then(r => r.json())
	 *   .safe();
	 *
	 * if (result.success) {
	 *   console.log('Data:', result.data);
	 * } else {
	 *   console.error('Error:', result.error);
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Chaining multiple operations safely:
	 * const result = await Futurable.resolve(5)
	 *   .delay(val => val * 2, 1000)
	 *   .fetch(val => `/api/item/${val}`)
	 *   .futurizable(r => r.json())
	 *   .safe();
	 *
	 * if (result.success) {
	 *   // TypeScript knows result.data is the JSON response
	 *   processData(result.data);
	 * } else {
	 *   // TypeScript knows result.error exists
	 *   logError(result.error);
	 * }
	 * ```
	 */
	safe<TError = unknown>(): Futurable<SafeResult<T, TError>> {
		return this.then(
			(value) => ({ success: true as const, data: value, error: null }),
			(reason) => ({ success: false as const, data: null, error: reason as TError })
		);
	}

	/**
	* Creates a new resolved Futurable without a value (resolves to void).
	*
	* @returns A Futurable that immediately resolves to void
	*
	* @example
	* ```typescript
	* Futurable.resolve()
	*   .delay(() => 'hello', 1000)
	*   .then(val => console.log(val)); // Logs: "hello" after 1s
	* ```
	*/
	static resolve(): Futurable<void>;
	/**
	* Creates a new resolved Futurable for the provided value.
	*
	* @template T - Type of the value to resolve with
	* @param value - The value, Promise, or Futurable to resolve with
	* @param signal - Optional AbortSignal for cancellation coordination
	* @returns A Futurable that immediately resolves with the value
	*
	* @example
	* ```typescript
	* Futurable.resolve(42)
	*   .then(val => console.log(val)); // Logs: 42
	* ```
	*/
	static resolve<T = any>(value: T | PromiseLike<T> | FuturableLike<T>, signal?: AbortSignal): Futurable<T>;
	static resolve<T = any>(value?: T | PromiseLike<T> | FuturableLike<T>, signal?: AbortSignal): Futurable<T | void> {
		return value
		? new Futurable(res => res(value), signal)
		: new Futurable<void>(res => res(), signal);
	}

	/**
	* Creates a new rejected Futurable for the provided reason.
	*
	* @template T - Type of value (never used for rejected Futurables)
	* @param reason - The reason for rejection (typically an Error)
	* @param signal - Optional AbortSignal for cancellation coordination
	* @returns A Futurable that immediately rejects with the reason
	*
	* @example
	* ```typescript
	* Futurable.reject(new Error('Failed'))
	*   .catch(err => console.error(err)); // Logs the error
	* ```
	*/
	static reject<T = never>(reason?: any, signal?: AbortSignal): Futurable<T> {
		return new Futurable((res, rej) => rej(reason), signal);
	}

	/**
	* Creates a Futurable that resolves when cancelled.
	* Useful for creating cancellation-aware cleanup logic.
	*
	* @template T - Type returned by the callback
	* @param options - Configuration object
	* @param options.cb - Callback executed on cancellation
	* @param options.signal - Optional external AbortSignal
	* @returns A Futurable that resolves with the callback's result when cancelled
	*
	* @example
	* ```typescript
	* const cleanup = Futurable.onCancel({
	*   cb: () => console.log('Cleanup performed')
	* });
	* cleanup.cancel(); // Triggers the callback
	* ```
	*/
	static onCancel<T = void>({ cb, signal }: { cb: () => T, signal?: AbortSignal }): Futurable<T> {
		return new Futurable((res, rej, utils) => {
			utils.onCancel(() => res(cb()));
		}, signal);
	}

	/**
	* Creates a Futurable that executes a callback after a specified delay.
	*
	* @template T - Type returned by the callback
	* @template TResult2 - Type in case of rejection
	* @param options - Configuration object
	* @param options.cb - Callback to execute after the delay
	* @param options.timer - Delay duration in milliseconds
	* @param options.signal - Optional AbortSignal for cancellation
	* @returns A Futurable that resolves with the callback's result after the delay
	*
	* @example
	* ```typescript
	* Futurable.delay({
	*   cb: () => 'Hello after delay',
	*   timer: 2000
	* }).then(msg => console.log(msg)); // Logs after 2s
	* ```
	*/
	static delay<T = any, TResult2 = never>({ cb, timer, signal }: { cb: () => T, timer: number, signal?: AbortSignal }): Futurable<T | TResult2> {
		return new Futurable((res, rej, utils) => {
			utils.delay(cb, timer).then(res, rej);
		}, signal)
	}

	/**
	* Creates a Futurable that resolves after a specified delay.
	* Equivalent to delay with an empty callback.
	*
	* @param options - Configuration object
	* @param options.timer - Duration to wait in milliseconds
	* @param options.signal - Optional AbortSignal for cancellation
	* @returns A Futurable that resolves after the delay
	*
	* @example
	* ```typescript
	* Futurable.sleep({ timer: 3000 })
	*   .then(() => console.log('3 seconds passed'));
	* ```
	*/
	static sleep({ timer, signal }: { timer: number, signal?: AbortSignal }): Futurable<void> {
		return Futurable.delay<void>({
			cb: () => { },
			timer,
			signal
		});
	}

	/**
	* Performs an HTTP fetch operation with cancellation support.
	*
	* @param url - The URL to fetch
	* @param opts - Optional Fetch API options (if signal is provided, it overrides the internal one)
	* @returns A Futurable that resolves with the Response object
	*
	* @example
	* ```typescript
	* Futurable.fetch('https://api.example.com/data')
	*   .then(response => response.json())
	*   .then(data => console.log(data));
	* ```
	*/
	static fetch(url: string, opts?: RequestInit): Futurable<Response> {
		const signal = opts?.signal || undefined;
		opts?.signal && delete opts.signal;
		return new Futurable((res, rej, utils) => {
			utils.fetch(url, opts).then(res).catch(rej);
		}, signal)
	}

	/**
	* Converts a Promise into a Futurable with cancellation support.
	* Note: The original Promise cannot be cancelled, but the Futurable wrapper can be.
	*
	* @template TResult1 - Type the Promise resolves to
	* @template TResult2 - Type in case of rejection
	* @param options - Configuration object
	* @param options.promise - The Promise to convert
	* @param options.signal - Optional AbortSignal for cancellation
	* @returns A Futurable wrapping the Promise
	*
	* @example
	* ```typescript
	* const promise = fetch('/api/data').then(r => r.json());
	* Futurable.futurizable({ promise })
	*   .then(data => console.log(data));
	* ```
	*/
	static futurizable<TResult1 = any, TResult2 = never>({ promise, signal }: { promise: Promise<TResult1>, signal?: AbortSignal }): Futurable<TResult1 | TResult2> {
		return new Futurable((res, rej) => {
			promise
			.then(res)
			.catch(rej);
		}, signal);
	}

	private static handleValues<T extends readonly unknown[] | []>(values: T, signal?: AbortSignal): Futurable<T>[] {
		const array: Futurable<T>[] = [];

		for (const value of values) {
			if ((value instanceof Futurable)) {
				array.push(value as Futurable<{ -readonly [P in keyof T]: T[P] }>);
			}
			else if ((value instanceof Promise)) {
				array.push(
					new Futurable<{ - readonly [P in keyof T]: T[P] }>(
						(res, rej) => {
							(value as Promise<{ -readonly [P in keyof T]: T[P] }>)
							.then((val) => res(val))
							.catch(rej);
						},
						signal
					)
				);
			} else {
				array.push(
					new Futurable<{ - readonly [P in keyof T]: T[P] }>(
						res => res(value as { -readonly [P in keyof T]: T[P] | FuturableLike<T[P]> | PromiseLike<T[P]> }),
						signal
					)
				);
			}
		}

		return array;
	}

	/**
	* Creates a Futurable that resolves when all provided Futurables/Promises resolve,
	* or rejects when any of them rejects. Supports cancellation of all pending operations.
	*
	* @template T - Tuple type of input values
	* @param values - Array of Futurables, Promises, or plain values
	* @param signal - Optional AbortSignal that cancels all operations when aborted
	* @returns A Futurable that resolves with an array of all resolved values
	*
	* @example
	* ```typescript
	* const all = Futurable.all([
	*   Futurable.delay({ cb: () => 1, timer: 100 }),
	*   Futurable.delay({ cb: () => 2, timer: 200 }),
	*   Promise.resolve(3)
	* ]);
	* all.then(results => console.log(results)); // [1, 2, 3]
	* ```
	*/
	static all<T extends readonly unknown[] | []>(values: T, signal?: AbortSignal): Futurable<{ -readonly [P in keyof T]: Awaited<T[P]>; }> {
		let resolve: FuturableResolve<{ -readonly [P in keyof T]: Awaited<T[P]> }>, reject: FuturableReject;
		const f = new Futurable<{ -readonly [P in keyof T]: Awaited<T[P]> }>((res, rej, utils) => {
			resolve = res;
			reject = rej;
			utils.onCancel(() => {
				for (const futurable of array) {
					futurable.cancel();
				}
			})
		}, signal);
		signal ||= f.internalSignal;
		const array = Futurable.handleValues(values, signal);

		super.all(array).then(val => resolve(val as { -readonly [P in keyof T]: Awaited<T[P]>; })).catch(reason => reject(reason));

		return f;
	}

	/**
	* Creates a Futurable that resolves when all provided Futurables/Promises settle
	* (either resolve or reject). Returns an array of result objects indicating the outcome.
	*
	* @template T - Tuple type of input values
	* @param values - Array of Futurables, Promises, or plain values
	* @param signal - Optional AbortSignal for cancellation
	* @returns A Futurable that resolves with an array of PromiseSettledResult objects
	*
	* @example
	* ```typescript
	* Futurable.allSettled([
	*   Futurable.resolve(1),
	*   Futurable.reject('error'),
	*   Promise.resolve(3)
	* ]).then(results => {
	*   // results[0]: { status: 'fulfilled', value: 1 }
	*   // results[1]: { status: 'rejected', reason: 'error' }
	*   // results[2]: { status: 'fulfilled', value: 3 }
	* });
	* ```
	*/
	static allSettled<T extends readonly unknown[] | []>(values: T, signal?: AbortSignal): Futurable<{ -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>> }> {
		let resolve: FuturableResolve<{ -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>>; }>;
		const f = new Futurable<{ - readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>> }>((res, rej, utils) => {
			resolve = res;
			utils.onCancel(() => {
				for (const futurable of array) {
					futurable.cancel();
				}
			})
		}, signal);
		signal ||= f.internalSignal;
		const array = Futurable.handleValues(values, signal);

		super.allSettled(array).then(val => resolve(val as { -readonly [P in keyof T]: PromiseSettledResult<Awaited<T[P]>>; }));

		return f;
	}

	/**
	* Creates a Futurable that resolves or rejects as soon as any of the provided
	* Futurables/Promises resolves or rejects. Cancels all other pending operations.
	*
	* @template T - Tuple type of input values
	* @param values - Array of Futurables, Promises, or plain values
	* @param signal - Optional AbortSignal for cancellation
	* @returns A Futurable that settles with the first settled value/reason
	*
	* @example
	* ```typescript
	* Futurable.race([
	*   Futurable.delay({ cb: () => 'slow', timer: 2000 }),
	*   Futurable.delay({ cb: () => 'fast', timer: 100 })
	* ]).then(result => console.log(result)); // 'fast'
	* ```
	*/
	static race<T extends readonly unknown[] | []>(values: T, signal?: AbortSignal): Futurable<Awaited<T[number]>> {
		let resolve: FuturableResolve<Awaited<T[number]>>, reject: FuturableReject;
		const f = new Futurable<Awaited<T[number]>>((res, rej, utils) => {
			resolve = res;
			reject = rej;
			utils.onCancel(() => {
				for (const futurable of array) {
					futurable.cancel();
				}
			})
		}, signal);
		signal ||= f.internalSignal;
		const array = Futurable.handleValues(values, signal);

		super.race(array).then(val => resolve(val)).catch(reason => reject(reason));

		return f;
	}

	/**
	* Creates a Futurable that resolves as soon as any of the provided Futurables/Promises
	* successfully resolves. Rejects with an AggregateError if all of them reject.
	*
	* @template T - Tuple type of input values
	* @param values - Array of Futurables, Promises, or plain values
	* @param signal - Optional AbortSignal for cancellation
	* @returns A Futurable that resolves with the first successful value
	*
	* @example
	* ```typescript
	* Futurable.any([
	*   Futurable.reject('error1'),
	*   Futurable.delay({ cb: () => 'success', timer: 100 }),
	*   Futurable.reject('error2')
	* ]).then(result => console.log(result)); // 'success'
	* ```
	*/
	static any<T extends readonly unknown[] | []>(values: T, signal?: AbortSignal): Futurable<Awaited<T[number]>> {
		let resolve: FuturableResolve<Awaited<T[number]>>, reject: FuturableReject;
		const f = new Futurable<Awaited<T[number]>>((res, rej, utils) => {
			resolve = res;
			reject = rej;
			utils.onCancel(() => {
				for (const futurable of array) {
					futurable.cancel();
				}
			})
		}, signal);
		signal ||= f.internalSignal;
		const array = Futurable.handleValues(values, signal);

		super.any(array).then(val => resolve(val)).catch(reason => reject(reason));

		return f;
	}

	/**
	* Creates a polling service that repeatedly executes a function at regular intervals.
	* Supports cancellation and error handling.
	*
	* @template T - Type returned by the polling function
	* @param fun - Function to execute on each poll (can return a Futurable, Promise, or plain value)
	* @param options - Configuration object
	* @param options.interval - Interval between polls in milliseconds
	* @param options.signal - Optional AbortSignal to stop polling
	* @param options.immediate - If true, executes the function immediately before starting the interval
	* @returns A controller object with cancel() and catch() methods
	*
	* @example
	* ```typescript
	* const polling = Futurable.polling(
	*   () => fetch('/api/status').then(r => r.json()),
	*   { interval: 5000, immediate: true }
	* );
	*
	* polling.catch(err => console.error('Polling error:', err));
	*
	* // Stop polling after 30 seconds
	* setTimeout(() => polling.cancel(), 30000);
	* ```
	*/
	static polling<T>(fun: () => Futurable<T> | Promise<T> | T, { interval, signal, immediate }: { interval: number, signal?: AbortSignal, immediate?: boolean }): FuturablePollingController {
		let f: Futurable<void>;
		let internal: Futurable<void> | Promise<void>;
		const pendingErrors: unknown[] = [];

		let errorHandler: (reason: unknown) => void = (err) => {
			pendingErrors.push(err);
		};

		const executePoll = (): void => {
			f && f.cancel();
			f = new Futurable<void>((res, rej, utils) => {
				utils.onCancel(() => {
					internal && internal instanceof Futurable && internal.cancel();
				});
				try {
					const temp = fun();
					if (temp instanceof Futurable || temp instanceof Promise) {
						internal = temp
							.then(() => res())
							.catch(err => {
								errorHandler(err);
							});
					} else {
						res();
					}
				} catch (err) {
					errorHandler(err);
				}
			}, signal);
		};

		if (immediate) {
			executePoll();
		}
		const id = setInterval(executePoll, interval);
		return {
			cancel: () => {
				id && clearInterval(id);
				f && f.cancel();
				internal && internal instanceof Futurable && internal.cancel();
			},
			catch: (onrejected) => {
				errorHandler = onrejected;
				if (pendingErrors.length > 0) {
					pendingErrors.forEach(err => onrejected(err));
					pendingErrors.length = 0;
				}
			}
		};
	}

	/**
	* Creates a new Futurable and returns it along with its control functions.
	* Extension of the Promise.withResolvers() static method with cancellation support.
	*
	* @template T - Type of value the Futurable will resolve to
	* @param signal - Optional AbortSignal for cancellation
	* @returns An object containing the Futurable and its control functions
	*
	* @example
	* ```typescript
	* const { promise, resolve, reject, cancel } = Futurable.withResolvers<number>();
	*
	* // Resolve from elsewhere
	* setTimeout(() => resolve(42), 1000);
	*
	* // Or cancel
	* cancel();
	*
	* promise.then(val => console.log(val));
	* ```
	*/
	static withResolvers<T>(signal?: AbortSignal): FuturableWithResolvers<T> {
		let resolve,
		reject,
		utils;
		const promise = new Futurable<T>((res, rej, utls) => {
			resolve = res;
			reject = rej;
			utils = utls;
		}, signal);
		const cancel = promise.cancel.bind(promise);
		return {
			resolve: resolve!,
			reject: reject!,
			utils: utils!,
			cancel,
			promise
		}
	}

	/**
	 * Creates a Futurable that wraps an executor in a safe execution context.
	 * The resulting Futurable never rejects - instead, it resolves with a result
	 * object containing either the success value or the error.
	 *
	 * This is useful when you want to create a Futurable that handles its own errors
	 * internally and always resolves with a discriminated result type.
	 *
	 * @template T - The type of the success value
	 * @template E - The type of the error (defaults to unknown)
	 * @param executor - The Futurable executor function
	 * @param signal - Optional AbortSignal for cancellation coordination
	 * @returns A Futurable that always resolves to a SafeResult
	 *
	 * @example
	 * ```typescript
	 * const result = await Futurable.safe<number>(
	 *   (resolve, reject, { fetch }) => {
	 *     fetch('/api/data')
	 *       .then(r => r.json())
	 *       .then(data => resolve(data.value))
	 *       .catch(reject);
	 *   }
	 * );
	 *
	 * if (result.success) {
	 *   console.log('Value:', result.data);
	 * } else {
	 *   console.error('Failed:', result.error);
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With custom error type:
	 * interface ApiError {
	 *   code: string;
	 *   message: string;
	 * }
	 *
	 * const result = await Futurable.safe<User, ApiError>(
	 *   (resolve, reject, { fetch }) => {
	 *     fetch('/api/user')
	 *       .then(r => r.ok ? r.json() : reject({ code: 'HTTP_ERROR', message: r.statusText }))
	 *       .then(resolve)
	 *       .catch(err => reject({ code: 'NETWORK_ERROR', message: err.message }));
	 *   }
	 * );
	 *
	 * if (!result.success) {
	 *   switch (result.error.code) {
	 *     case 'HTTP_ERROR':
	 *       // Handle HTTP errors
	 *       break;
	 *     case 'NETWORK_ERROR':
	 *       // Handle network errors
	 *       break;
	 *   }
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Combining with cancellation:
	 * const controller = new AbortController();
	 *
	 * const result = await Futurable.safe<string>(
	 *   (resolve, reject, { signal, fetch }) => {
	 *     fetch('/api/slow-endpoint')
	 *       .then(r => r.text())
	 *       .then(resolve)
	 *       .catch(reject);
	 *   },
	 *   controller.signal
	 * );
	 *
	 * // Cancel after 5 seconds
	 * setTimeout(() => controller.abort(), 5000);
	 * ```
	 */
	static safe<T, E = unknown>(executor: FuturableExecutor<T>, signal?: AbortSignal): Futurable<SafeResult<T, E>> {
		return new Futurable(executor, signal).safe<E>();
	}
}
