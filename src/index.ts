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

export type FuturableIterable<T=any> = Futurable<T> | Promise<T> | T;

export interface FuturableLike<T> {
	then<TResult1 = T, TResult2 = never>(onfulfilled?: FuturableOnfulfilled<TResult1, TResult2>, onrejected?: FuturableOnrejected<TResult2>): FuturableLike<TResult1 | TResult2>;
}

enum FUTURABLE_STATUS {
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
			delay: <T>(cb: () => any, timer: number): Futurable<T> => {
				return new Futurable<T>(res => {
					idsTimeout.push(setTimeout(() => {
						res(cb());
					}, timer));
				}, sign);
			},
			sleep: <T>(timer: number): Futurable<T> => {
				return utils.delay(() => { }, timer);
			},
			fetch: <T>(url: string, opts?: RequestInit): Futurable<T> => {
				return new Futurable<T>((res, rej) => {
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

		const p = new Promise<T>((resolve, reject) => {
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
					resolve(val as T);
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

	private clearTimeout() {
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
				this.clearTimeout();
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
				this.clearTimeout();
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
	onCancel<TResult1 = void, TResult2 = never>(cb: () => void): Futurable<TResult1 | TResult2> {
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
	futurizable<TResult1 = any, TResult2 = never>(promise: Promise<TResult1> | ((val?: TResult1) => Promise<TResult1>)): Futurable<TResult1 | TResult2> {
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

	static resolve<T = any, TResult2 = never>(value?: T, signal?: AbortSignal): Futurable<T | TResult2> {
		return new Futurable<T>(res => res(value), signal);
	}

	static reject<T = any, TResult2 = never>(reason?: T, signal?: AbortSignal): Futurable<T | TResult2> {
		return new Futurable<T>((res, rej) => rej(reason), signal);
	}

	/**
	 * OnCancel static method. It accepts a callback or a object with cb property and an optional signal.
	 */
	static onCancel<T=void>({ cb, signal }: {cb: () => T, signal?: AbortSignal}): Futurable<T> {
		return new Futurable<T>((res, rej, utils) => {
			utils.onCancel(() => res(cb()));
		}, signal);
	}

	/**
	 * Delay static method. It accepts a object with timer and cb properties and an optional signal property.
	 */
	static delay<T = any, TResult2 = never>({ cb, timer, signal }: { cb: () => any, timer: number, signal?: AbortSignal }): Futurable<T | TResult2> {
		return new Futurable<T>((res, rej, utils) => {
			utils.delay(cb, timer).then(res);
		}, signal)
	}

	/**
	 * Sleep static method. It accepts a timer or a object with timer property and an optional signal.
	 */
	static sleep<T = any, TResult2 = never>({ timer, signal }: { timer: number, signal?: AbortSignal }): Futurable<T | TResult2> {
		return Futurable.delay<T>({
			cb: () => { },
			timer,
			signal
		});
	}

	/**
	 * Fetch static method.
	 */
	static fetch<T=any, TResult2 = never>(url: string, opts?: RequestInit): Futurable<T | TResult2> {
		const signal = opts?.signal || undefined;
		opts?.signal && delete opts.signal;
		return new Futurable<T>((res, rej, utils) => {
			utils.fetch(url, opts).then(res);
		}, signal)
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

	private static handleIterables<T extends readonly unknown[] | []>(iterables: FuturableIterable<T>[], signal?: AbortSignal): { f: Futurable<T>, array: Futurable<T>[], resolve: FuturableResolve<T>, reject: FuturableReject } {
		const obj: { f?: Futurable<{ -readonly [P in keyof T]: Awaited<T[P]> }>, array: Futurable<{ -readonly [P in keyof T]: Awaited<T[P]> }>[], resolve?: FuturableResolve<T>, reject?: FuturableReject} = {
			array: []
		}
		obj.f = new Futurable<T>((res, rej, utils) => {
			obj.resolve = res;
			obj.reject = rej;
			utils.onCancel(() => {
				for (const futurable of obj.array) {
					futurable.cancel();
				}
			});
		}, signal);
		signal ||= obj.f.internalSignal;

		for (const i in iterables) {
			if ((iterables[i] instanceof Futurable)) {
				obj.array.push(iterables[i] as Futurable<T>);
			}
			else if ((iterables[i] instanceof Promise)) {
				obj.array.push(new Futurable<T>((res, rej) => {
					const f = iterables[i];
					(f as Promise<T>)
						.then((val: T) => res(val))
						.catch(rej);
				}, signal));
			} else {
				obj.array.push(Futurable.resolve<T>(iterables[i] as T, signal));
			}
		}

		return obj as { f: Futurable<T>, array: Futurable<T>[], resolve: FuturableResolve<T>, reject: FuturableReject };
	}

	/**
	 * Creates a Futurable with cancellation support that is resolved with an array of results when all of the provided Futurables resolve, or rejected when any Futurable is rejected.
	 */
	static all<T extends readonly unknown[] | []>(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
		const { f, resolve, reject, array } = Futurable.handleIterables(iterables, signal);

		super.all(array).then(resolve).catch(reject);

		return f;
	}

	/**
	 * Creates a Futurable with cancellation support that is resolved with an array of results when all of the provided Futurables resolve or reject.
	 */
	static allSettled<T extends readonly unknown[] | []>(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
		const { f, resolve, reject, array } = Futurable.handleIterables(iterables, signal);

		super.allSettled(array).then(resolve).catch(reject);

		return f;
	}

	/**
	 * Creates a Futurable with cancellation support that is resolved or rejected when any of the provided Futurables are resolved or rejected.
	 */
	static race<T extends readonly unknown[] | []>(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
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
	static any<T extends readonly unknown[] | []>(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
		const { f, resolve, reject, array } = Futurable.handleIterables(iterables, signal);

		super.any(array).then(resolve).catch(reject);

		return f;
	}
}