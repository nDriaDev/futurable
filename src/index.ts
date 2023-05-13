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
	signal: AbortSignal;
	cancel: () => void;
	onAbort: (cb: () => void) => void;
	delay: (cb: () => any, timer: number) => Futurable<T>;
	sleep: (timer: number) => Futurable<T>;
	fetch: (url: string, opts?: RequestInit) => Futurable<T>;
}

export type FuturableExecutor<T> = (
	resolve: FuturableResolve<T>,
	reject: FuturableReject,
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
	#controller;
	#signal;
	#idsTimeout;

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

		const onAbort = (cb: () => void): void => {
			abort = cb;
		};

		const utils = {
			signal: sign,
			cancel: (): void => this.#controller?.abort(),
			onAbort,
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
		this.#controller = controller;
		this.#signal = sign;
		this.#idsTimeout = idsTimeout;
	}

	static get [Symbol.species]() {
		return this;
	}

	get [Symbol.toStringTag]() {
		return 'Futurable';
	}

	get signal() {
		return this.#signal;
	}

	#clearTimeout() {
		for (const timeout of this.#idsTimeout) {
			clearTimeout(timeout);
		}
	}

	then<TResult1 = T, TResult2 = never>(onFulfilled: FuturableOnfulfilled<TResult1, TResult2>, onRejected?: FuturableOnrejected<TResult2>): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const p = new Futurable((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.#signal);
		p.#controller = this.#controller;
		super.then(val => {
			if (this.#signal?.aborted) {
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
			if (this.#signal?.aborted) {
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

	catch<TResult = never>(onRejected: FuturableOnrejected<TResult>): Futurable<T | TResult> {
		return this.then(null, onRejected);
	}

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

	cancel(): void {
		!this.#signal?.aborted && this.#controller?.abort();
	}

	delay<TResult1 = T, TResult2 = never>(cb: (val?: TResult1) => any, timer: number): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>;
		const p = new Futurable(res => {
			resolve = res;
		}, this.#signal);
		p.#controller = this.#controller;
		this.then(
			val => {
				this.#idsTimeout.push(setTimeout(() => resolve(cb(val)), timer));
			},
			null
		);
		return p;
	}

	sleep<TResult1 = T, TResult2 = never>(timer: number): Futurable<TResult1 | TResult2> {
		return this.delay(val => val, timer);
	}

	fetch<TResult1 = T, TResult2 = never>(url: string | ((val?: TResult1) => string), opts?: object | RequestInit | ((val?: TResult1) => RequestInit)): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const p = new Futurable((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.#signal);
		p.#controller = this.#controller;
		this.then(val => {
			const urlFetch = typeof url === "function" ? url(val) : url,
				optsFetch = { ...(typeof opts === "function" ? opts(val) : opts), signal: this.#signal };

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

	onAbort<TResult1 = T, TResult2 = never>(cb: () => void): Futurable<TResult1 | TResult2> {
		let resolve: FuturableResolve<TResult1 | TResult2>, reject: FuturableReject;
		const f = new Futurable((res, rej, utils) => {
			utils.onAbort(cb);
			resolve = res;
			reject = rej;
		}, this.#signal);
		f.#controller = this.#controller;

		this.then(
			val => resolve(val),
			reason => reject(reason)
		);
		return f;
	}

	promisify<TResult1 = T, TResult2 = never>(): Promise<TResult1 | TResult2> {
		return new Promise((res, rej) => {
			if (this.#signal.aborted) {
				this.#clearTimeout();
				return;
			} else {
				this.then(
					val => res(val),
					reason => rej(reason)
				);
			}
		});
	}

	static resolve(value?: any, signal?: AbortSignal): Futurable<any> {
		return new Futurable(res => res(value), signal);
	}

	static reject(reason?: any, signal?: AbortSignal): Futurable<any> {
		return new Futurable((res, rej) => rej(reason), signal);
	}

	static onAbort(cb: () => void, signal?: AbortSignal): Futurable<any> {
		return new Futurable((res, rej, utils) => {
			utils.onAbort(() => res(cb()));
		}, signal);
	}

	static delay(cb: () => any, timer: number | { timer: number, signal?: AbortSignal }): Futurable<any> {
		let timeout: any = timer, signal;
		if (typeof timer === "object") {
			timeout = timer.timer;
			signal = timer?.signal;
		}
		return Futurable.resolve(true, signal).delay(cb, timeout as number);
	}

	static sleep(timer: number | { timer: number, signal?: AbortSignal }): Futurable<any> {
		return Futurable.delay(() => { }, timer);
	}

	static fetch(url: string, opts?: RequestInit): Futurable<any> {
		const signal = opts?.signal || undefined;
		opts?.signal && delete opts.signal;
		return Futurable.resolve(true, signal)
			.fetch(url, opts);
	}

	static #handleIterables(iterables: FuturableIterable[], signal?: AbortSignal) {
		let resolve, reject;
		const array: (Futurable<any> | any)[] = [];
		const f = new Futurable<any>((res, rej, utils) => {
			resolve = res;
			reject = rej;
			utils.onAbort(() => {
				for (const promise of array) {
					promise.signal !== signal && promise.cancel();
				}
			});
		}, signal);
		signal ||= f.signal;

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

	static all(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<any> {
		const { f, resolve, reject, array } = Futurable.#handleIterables(iterables, signal);

		super.all(array).then(resolve).catch(reject);

		return f;
	}

	static allSettled(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<any> {
		const { f, resolve, reject, array } = Futurable.#handleIterables(iterables, signal);

		super.allSettled(array).then(resolve).catch(reject);

		return f;
	}

	static race(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<any> {
		const { f, resolve, reject, array } = Futurable.#handleIterables(iterables, signal);

		super.race(array).then(resolve).catch(reject);

		return f;
	}

	static any(iterables: FuturableIterable[], signal?: AbortSignal): Futurable<any> {
		const { f, resolve, reject, array } = Futurable.#handleIterables(iterables, signal);

		super.any(array).then(resolve).catch(reject);

		return f;
	}
}