export type FuturableOnfulfilled<T, TResult2 = never> = ((value: any) => T | TResult2 | FuturableLike<T | TResult2> | PromiseLike<T | TResult2>) | undefined | null;

export type FuturableOnrejected<TResult = never> = ((reason: any) => TResult | FuturableLike<TResult> | PromiseLike<TResult>) | undefined | null;

export type FuturableResolveType<T> = T | FuturableLike<T> | PromiseLike<T>;

export interface FuturableResolve<T> {
	(value?: FuturableResolveType<T>): void;
}

export interface FuturableReject {
	(reason?: any): void;
}

export interface FuturableUtils<T> {
	/**
	 * Internal futurable signal
	 */
	signal: AbortSignal;
	/**
	 * Cancel the futurable if it is to be executed or if it is still executing.
	 */
	cancel: () => void;
	/**
	 * Executes the callback passed as a parameter when the futurable is cancelled.
	 * @param cb: callback
	 */
	onCancel: (cb: () => void) => void;
	/**
	 * Waits for timer, then executes callback with the futurable value and returns the result obtained from the invocation.
	 * @param cb: callback executed after timer
	 * @param timer: timer to wait (in milliseconds)
	 */
	delay: (cb: () => any, timer: number) => Futurable<T>;
	/**
	 * Waits for timer parameter (in milliseconds) before returning the value.
	 * @param timer: timer to wait (in milliseconds)
	 */
	sleep: (timer: number) => Futurable<T>;
	/**
	 * Extension of the fetch API with cancellation support. Url parameter can be a string or a function with receive value from futurable chaining as paremeter.
	 * @param url: url to fetch
	 * @param opts: fetch options
	 */
	fetch: (url: string, opts?: RequestInit) => Futurable<T>;
	/**
	 * Takes a promise and transforms it into a futurizable. Promise can be also a function that receives value from futurable chaining as parameter.
	 * @param promise: Promise to futurize
	 */
	futurizable: (promise: Promise<T>) => Futurable<T>;
}

export type FuturableExecutor<T> = (
	resolve: FuturableResolve<T>,
	reject: FuturableReject,
	/**
	 * Object containing implemented functionalities.
	 */
	utils: FuturableUtils<T>
) => void;

export type FuturableIterable = Futurable<any> | Promise<any> | any;

export interface FuturableLike<T> {
	then<TResult1 = T, TResult2 = never>(onfulfilled?: FuturableOnfulfilled<TResult1, TResult2>, onrejected?: FuturableOnrejected<TResult2>): FuturableLike<TResult1 | TResult2>;
}

export enum FUTURABLE_STATUS {
	PENDING = "pending",
	FULFILLED = "fulfilled",
	REJECTED = "rejected"
}

export class Futurable<T> extends Promise<T> {
	private controller;
	private internalSignal;
	private idsTimeout;

	constructor(executor: FuturableExecutor<T>, signal?: AbortSignal) {
		const controller: AbortController | null = signal ? null : new AbortController();
		const sign = signal || controller!.signal;
		const idsTimeout: ReturnType<typeof setTimeout>[] = [];

		const abortTimeout = () => {
			for (const timeout of idsTimeout) {
				clearTimeout(timeout);
			}
		};

		let abort: () => void;

		const onCancel = (cb: () => void): void => {
			abort = cb;
		};

		const utils = {
			signal: sign,
			cancel: (): void => this.controller?.abort(),
			onCancel,
			delay: (cb: () => any, timer: number): Futurable<T> => {
				return new Futurable(res => {
					idsTimeout.push(setTimeout(() => {
						res(cb());
					}, timer));
				}, sign);
			},
			sleep: (timer: number): Futurable<T> => {
				return utils.delay(() => { }, timer);
			},
			fetch: (url: string, opts?: RequestInit): Futurable<T> => {
				return new Futurable((res, rej) => {
					fetch(url, { ...(opts || {}), signal: sign })
						.then(val => res(val as FuturableResolveType<T>))
						.catch(err => {
							if (err.name === "AbortError") {
								return;
							} else {
								rej(err);
							}
						});
				}, sign);
			},
			futurizable: (promise: Promise<T>): Futurable<T> => {
				return new Futurable((res, rej) => {
					promise
						.then(res)
						.catch(rej);
				}, sign);
			}
		};

		let status = FUTURABLE_STATUS.PENDING;

		const p = new Promise((resolve, reject) => {
			if (!sign.aborted) {
				const func: (() => void) = typeof sign.onabort === "function" ? sign.onabort as () => void : () => { };
				sign.onabort = () => {
					func();
					abortTimeout();
					if (status === FUTURABLE_STATUS.PENDING) {
						abort && abort();
					}
					return;
				};

				const res = (val?: FuturableResolveType<T>) => {
					status = FUTURABLE_STATUS.FULFILLED;
					resolve(val);
				};

				const rej = (reason?: any) => {
					status = FUTURABLE_STATUS.REJECTED;
					reject(reason);
				};

				executor(res, rej, utils);
			} else {
				abortTimeout();
				status === FUTURABLE_STATUS.PENDING && abort && abort();
				return;
			}
		});
		super((resolve, reject) => {
			p.then(val => resolve(val as FuturableResolveType<T>)).catch(reject);
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
	 * Return internal futurable signal
	 */
	get signal() {
		return this.internalSignal;
	}

	#clearTimeout() {
		for (const timeout of this.idsTimeout) {
			clearTimeout(timeout);
		}
	}

	/**
	 * Attaches callbacks for the resolution and/or rejection of the Futurable.
	 */
	then<TResult1 = T, TResult2 = never>(onFulfilled: FuturableOnfulfilled<TResult1, TResult2>, onRejected?: FuturableOnrejected<TResult2>): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const p = new Futurable((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.internalSignal);
		p.controller = this.controller;
		super.then(val => {
			if (this.internalSignal?.aborted) {
				this.#clearTimeout();
				return;
			}
			try {
				if (onFulfilled) {
					resolve(onFulfilled(val));
				} else {
					resolve(val as unknown as (TResult1 | undefined));
				}
			} catch (error) {
				reject(error);
			}
		}, reason => {
			if (this.internalSignal?.aborted) {
				this.#clearTimeout();
				return;
			}
			try {
				if (onRejected) {
					resolve(onRejected(reason));
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
	 */
	catch<TResult = never>(onRejected: FuturableOnrejected<TResult>): Futurable<T | TResult> {
		return this.then(null, onRejected);
	}

	/**
	 * Attaches a callback that is invoked when the Futurable is settled (fulfilled or rejected). The resolved value cannot be modified from the callback.
	 */
	finally(onFinally: () => void): Futurable<void> {
		return this.then(
			() => {
				onFinally();
			},
			() => {
				onFinally();
			}
		);
	}

	/**
	 * Cancel the futurable if it is to be executed or if it is still executing.
	 */
	cancel(): void {
		!this.internalSignal?.aborted && this.controller?.abort();
	}

	/**
	 * Waits for timer, then executes callback with the futurable value and returns the result obtained from the invocation.
	 * @param cb: callback executed after timer with futurable chain value as parameter
	 * @param timer: timer to wait (in milliseconds)
	 */
	delay<TResult1 = T, TResult2 = never>(cb: (val?: TResult1) => any, timer: number): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const p = new Futurable((res, rej) => {
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
	 * Waits for timer parameter (in milliseconds) before returning the value.
	 * @param timer: timer to wait (in milliseconds)
	 */
	sleep<TResult1 = T, TResult2 = never>(timer: number): Futurable<TResult1 | TResult2> {
		return this.delay(val => val, timer);
	}

	/**
	 * Extension of the fetch API with cancellation support. Url parameter can be a string or a function with receive value from futurable chaining as paremeter.
	 * @param url: url to fetch or function with futurable chaining value that returns url to fetch
	 * @param opts: fetch options or function with futurable chaining value that return fetch options
	 */
	fetch<TResult1 = T, TResult2 = never>(url: string | ((val?: TResult1) => string), opts?: object | RequestInit | ((val?: TResult1) => RequestInit)): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const p = new Futurable((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.internalSignal);
		p.controller = this.controller;
		this.then(val => {
			const urlFetch = typeof url === "function" ? url(val) : url,
				optsFetch = { ...(typeof opts === "function" ? opts(val) : opts), signal: this.internalSignal };

			fetch(urlFetch, optsFetch).then(val => resolve(val as FuturableResolveType<TResult1 | TResult2>)).catch(err => {
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
	 * Executes the callback passed as a parameter when the futurable is cancelled.
	 * @param cb: callback
	 */
	onCancel<TResult1 = T, TResult2 = never>(cb: () => void): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const f = new Futurable((res, rej, utils) => {
			utils.onCancel(cb);
			resolve = res;
			reject = rej;
		}, this.internalSignal);
		f.controller = this.controller;

		this.then(
			val => resolve(val),
			reason => reject(reason)
		);
		return f;
	}

	// promisify<TResult1 = T, TResult2 = never>(): Promise<TResult1 | TResult2> {
	// 	return new Promise((res, rej) => {
	// 		if (this.#signal.aborted) {
	// 			this.#clearTimeout();
	// 			return;
	// 		} else {
	// 			this.then(
	// 				val => res(val),
	// 				reason => rej(reason)
	// 			);
	// 		}
	// 	});
	// }

	/**
	 * Takes a promise and transforms it into a futurizable. Promise can be also a function that receives value from futurable chaining as parameter.
	 * @param promise: Promise to futurize or function that return promise with futurable chaining value as parameter
	 */
	futurizable<TResult1 = T, TResult2 = never>(promise: Promise<TResult1> | ((val?: TResult1) => Promise<TResult1>)): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const f = new Futurable((res, rej) => {
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

	static resolve(value?: any, signal?: AbortSignal): Futurable<any> {
		return new Futurable(res => res(value), signal);
	}

	static reject(reason?: any, signal?: AbortSignal): Futurable<any> {
		return new Futurable((res, rej) => rej(reason), signal);
	}

	/**
	 * OnCancel static method. It accepts a callback or a object with cb property and an optional signal.
	 */
	static onCancel({ cb, signal }: {cb: () => void, signal?: AbortSignal}): Futurable<any> {
		return new Futurable((res, rej, utils) => {
			utils.onCancel(() => res(cb()));
		}, signal);
	}

	/**
	 * Delay static method. It accepts a object with timer and cb properties and an optional signal property.
	 */
	static delay({ cb, timer, signal }: { cb: () => any, timer: number, signal?: AbortSignal }): Futurable<any> {
		return Futurable.resolve(true, signal).delay(cb, timer);
	}

	/**
	 * Sleep static method. It accepts a timer or a object with timer property and an optional signal.
	 */
	static sleep({ timer, signal }: { timer: number, signal?: AbortSignal }): Futurable<any> {
		return Futurable.delay({
			cb: () => { },
			timer,
			signal
		});
	}

	/**
	 * Fetch static method.
	 */
	static fetch(url: string, opts?: RequestInit): Futurable<any> {
		const signal = opts?.signal || undefined;
		opts?.signal && delete opts.signal;
		return Futurable.resolve(true, signal)
			.fetch(url, opts);
	}

	/**
	 * Futurizable static method.
	 */
	static futurizable<TResult1=any, TResult2=never>({ promise, signal }: { promise: Promise<TResult1>, signal?: AbortSignal }): Futurable<TResult1 | TResult2> {
		return new Futurable((res, rej) => {
			promise
				.then(res)
				.catch(rej);
		}, signal);
	}

	private static handleIterables(iterables: FuturableIterable[], signal?: AbortSignal) {
		let resolve, reject;
		const array: (Futurable<any> | any)[] = [];
		const f = new Futurable<any>((res, rej, utils) => {
			resolve = res;
			reject = rej;
			utils.onCancel(() => {
				for (const promise of array) {
					promise.signal !== signal && promise.cancel();
				}
			});
		}, signal);
		signal ||= f.internalSignal;

		for (const i in iterables) {
			if (!(iterables[i] instanceof Futurable)) {
				if (!(iterables[i] instanceof Promise)) {
					array.push(Futurable.resolve(iterables[i]));
				} else {
					array.push(new Futurable((res, rej) => {
						iterables[i].then(res).catch(rej);
					}, signal));
				}
			} else {
				array.push(iterables[i]);
			}
		}

		return { f, resolve, reject, array };
	}

	/**
	 * Creates a Futurable with cancellation support that is resolved with an array of results when all of the provided Futurables resolve, or rejected when any Futurable is rejected.
	 */
	static all(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<any> {
		const { f, resolve, reject, array } = Futurable.handleIterables(iterables, signal);

		super.all(array).then(resolve).catch(reject);

		return f;
	}

	/**
	 * Creates a Futurable with cancellation support that is resolved with an array of results when all of the provided Futurables resolve or reject.
	 */
	static allSettled(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<any> {
		const { f, resolve, reject, array } = Futurable.handleIterables(iterables, signal);

		super.allSettled(array).then(resolve).catch(reject);

		return f;
	}

	/**
	 * Creates a Futurable with cancellation support that is resolved or rejected when any of the provided Futurables are resolved or rejected.
	 */
	static race(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<any> {
		const { f, resolve, reject, array } = Futurable.handleIterables(iterables, signal);

		super.race(array).then(resolve).catch(reject);

		return f;
	}

	/**
	 * The any function returns a futurable with cancellation support that is fulfilled by the first given futurable to be fulfilled,
	 * or rejected with an AggregateError containing an array of rejection reasons if all of the
	 * given futurables are rejected. It resolves all elements of the passed iterable to futurables as
	 * it runs this algorithm.
	 */
	static any(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<any> {
		const { f, resolve, reject, array } = Futurable.handleIterables(iterables, signal);

		super.any(array).then(resolve).catch(reject);

		return f;
	}
}