export interface FuturableLike<T> {
	/**
	 * Attaches callbacks for the resolution and/or rejection of the Futurable.
	 * @param onfulfilled The callback to execute when the Futurable is resolved.
	 * @param onrejected The callback to execute when the Futurable is rejected.
	 * @returns A Futurable for the completion of which ever callback is executed.
	 */
	then<TResult1 = T, TResult2 = never>(
		onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1> | FuturableLike<TResult1>) | undefined | null,
		onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2> | FuturableLike<TResult2>) | undefined | null
	): FuturableLike<TResult1 | TResult2>;
}
export interface FuturableResolve<T> {
	(value: T | FuturableLike<T> | PromiseLike<T>): void;
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
	delay: <TResult=T, TResult2=never>(cb: () => TResult, timer: number) => FuturableLike<TResult | TResult2>;
	/**
	 * Waits for timer parameter (in milliseconds) before returning the value.
	 * @param timer: timer to wait (in milliseconds)
	 */
	sleep: (timer: number) => FuturableLike<void>;
	/**
	 * Extension of the fetch API with cancellation support. Url parameter can be a string or a function with receive value from futurable chaining as paremeter.
	 * @param url: url to fetch
	 * @param opts: fetch options
	 */
	fetch: (url: string, opts?: RequestInit) => Futurable<Response>;
	/**
	 * Takes a promise and transforms it into a futurizable. Promise can be also a function that receives value from futurable chaining as parameter.
	 * @param promise: Promise to futurize
	 */
	futurizable: <TResult=any>(promise: Promise<TResult>) => Futurable<TResult>;
}

export type FuturableExecutor<T> = (
	resolve: FuturableResolve<T>,
	reject: FuturableReject,
	/**
	 * Object containing implemented functionalities.
	 */
	utils: FuturableUtils<T>
) => void;

export type FuturableIterable<T = any> = Iterable<FuturableLike<T> | PromiseLike<T> | T>;

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

		const utils: FuturableUtils<T> = {
			signal: sign,
			cancel: (): void => this.controller?.abort(),
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

				const res: FuturableResolve<T> = (val) => {
					status = FUTURABLE_STATUS.FULFILLED;
					resolve(val as T | PromiseLike<T>);
				};

				const rej: FuturableReject = (reason) => {
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
	then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1> | FuturableLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2> | FuturableLike<TResult2>) | undefined | null): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1|TResult2>, reject: FuturableReject;
		const p = new Futurable<TResult1|TResult2>((res, rej) => {
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
	 */
	catch<TResult2 = never>(onRejected: ((reason: any) => TResult2 | PromiseLike<TResult2> | FuturableLike<TResult2>) | undefined | null): Futurable<T | TResult2> {
		return this.then(null, onRejected);
	}

	/**
	 * Attaches a callback that is invoked when the Futurable is settled (fulfilled or rejected).
	 * The resolved value cannot be modified from the callback.
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
	 * Waits for timer parameter (in milliseconds) before returning the value.
	 * @param timer: timer to wait (in milliseconds)
	 */
	sleep(timer: number): Futurable<T> {
		return this.delay(val => val, timer);
	}

	/**
	 * Extension of the fetch API with cancellation support. Url parameter can be a string or a function with receive value from futurable chaining as paremeter.
	 * @param url: url to fetch or function with futurable chaining value that returns url to fetch
	 * @param opts: fetch options or function with futurable chaining value that return fetch options
	 */
	fetch(url: string | ((val?: T) => string), opts?: object | RequestInit | ((val?: T) => RequestInit)): Futurable<Response> {
		let resolve: FuturableResolve<Response>, reject: FuturableReject;
		const p = new Futurable<Response>((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.internalSignal);
		p.controller = this.controller;
		this.then(val => {
			const urlFetch = typeof url === "function" ? url(val) : url,
				optsFetch = { ...(typeof opts === "function" ? opts(val) : opts), signal: this.internalSignal };

			fetch(urlFetch, optsFetch).then(val => resolve(val)).catch(err => {
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

	static resolve(): Futurable<void>;
	static resolve<T=any>(value: T | PromiseLike<T> | FuturableLike<T>, signal?: AbortSignal): Futurable<T>;
	static resolve<T=any>(value?: T | PromiseLike<T> | FuturableLike<T>, signal?: AbortSignal): Futurable<T|void> {
		return value
			? new Futurable(res => res(value), signal)

		: new Futurable<void>(res=> res(), signal);
	}

	static reject<T = never>(reason?: any, signal?: AbortSignal): Futurable<T> {
		return new Futurable((res, rej) => rej(reason), signal);
	}

	/**
	 * OnCancel static method. It accepts a callback or a object with cb property and an optional signal.
	 */
	static onCancel<T=void>({ cb, signal }: {cb: () => T, signal?: AbortSignal}): Futurable<T> {
		return new Futurable((res, rej, utils) => {
			utils.onCancel(() => res(cb()));
		}, signal);
	}

	/**
	 * Delay static method. It accepts a object with timer and cb properties and an optional signal property.
	 */
	static delay<T = any, TResult2 = never>({ cb, timer, signal }: { cb: () => any, timer: number, signal?: AbortSignal }): Futurable<T | TResult2> {
		return new Futurable((res, rej, utils) => {
			utils.delay(cb, timer).then(res, rej);
		}, signal)
	}

	/**
	 * Sleep static method. It accepts a timer or a object with timer property and an optional signal.
	 */
	static sleep({ timer, signal }: { timer: number, signal?: AbortSignal }): Futurable<void> {
		return Futurable.delay<void>({
			cb: () => { },
			timer,
			signal
		});
	}

	/**
	 * Fetch static method.
	 */
	static fetch(url: string, opts?: RequestInit): Futurable<Response> {
		const signal = opts?.signal || undefined;
		opts?.signal && delete opts.signal;
		return new Futurable((res, rej, utils) => {
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

	private static handleValues<T extends readonly unknown[] | []>(values: T, signal?: AbortSignal): Futurable<T>[] {
		const array: Futurable<T>[] = [];

		for (const i in values) {
			if ((values[i] instanceof Futurable)) {
				array.push(values[i] as Futurable<{ -readonly [P in keyof T]: T[P] }>);
			}
			else if ((values[i] instanceof Promise)) {
				array.push(
					new Futurable<{ - readonly [P in keyof T]: T[P] }>(
						(res, rej) => {
							(values[i] as Promise<{ -readonly [P in keyof T]: T[P] }>)
								.then((val) => res(val))
								.catch(rej);
						},
						signal
					)
				);
			} else {
				array.push(
					new Futurable<{ - readonly [P in keyof T]: T[P] }>(
						res => res(values[i] as { -readonly [P in keyof T]: T[P] | FuturableLike<T[P]> | PromiseLike<T[P]> }),
						signal
					)
				);
			}
		}

		return array;
	}

	/**
	 * Creates a Futurable with cancellation support that is resolved with an array of results when all of the provided Futurables resolve, or rejected when any Futurable is rejected.
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
	 * Creates a Futurable with cancellation support that is resolved with an array of results when all of the provided Futurables resolve or reject.
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
	 * Creates a Futurable with cancellation support that is resolved or rejected when any of the provided Futurables are resolved or rejected.
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
	 * The any function returns a futurable with cancellation support that is fulfilled by the first given futurable to be fulfilled,
	 * or rejected with an AggregateError containing an array of rejection reasons if all of the
	 * given futurables are rejected. It resolves all elements of the passed iterable to futurables as
	 * it runs this algorithm.
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
}