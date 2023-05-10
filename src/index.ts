const FUTURABLE_STATUS: FuturableStatus = {
	PENDING: "pending",
	FULFILLED: "fulfilled",
	REJECTED: "rejected"
};

export class Futurable<T> extends Promise<T> {
	#controller: AbortController|null;
	#signal: AbortSignal;
	#idsTimeout: ReturnType<typeof setTimeout>[];

	constructor(
		executor: ((
			resolve: (value?: void | Response | T | PromiseLike<T>) => void,
			reject: (reason?: any) => void,
			utils: { signal: AbortSignal, cancel: () => void, onAbort: (cb: () => void) => void, delay: (cb: () => void, timer: number) => Futurable<T>, sleep: (timer: number) => Futurable<T>, fetch: (url: string, opts: RequestInit) => Futurable<T> }
		) => void),
		signal: AbortSignal
	) {
		const controller = signal ? null : new AbortController();
		const sign = signal || controller?.signal;
		const idsTimeout: ReturnType<typeof setTimeout>[] = [];

		const abortTimeout = () => {
			for (const timeout of idsTimeout) {
				clearTimeout(timeout);
			}
		};

		let abort: ()=>void;

		const onAbort = (cb:()=>void):void => {
			abort = cb;
		};

		const utils = {
			signal: sign,
			cancel: () => this.#controller?.abort(),
			onAbort,
			delay: (cb:()=>void, timer:number):Futurable<T> => {
				return new Futurable(res => {
					idsTimeout.push(setTimeout(() => res(cb()), timer));
				}, sign);
			},
			sleep: (timer:number) => {
				return utils.delay(() => { }, timer);
			},
			fetch: (url:string, opts: RequestInit):Futurable<T> => {
				return new Futurable((res, rej) => {
					fetch(url, { ...(opts || {}), signal: sign }).then(res).catch(err => {
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

		const p = new Promise((resolve: (value?: void | Response | T | PromiseLike<T>)=>void, reject: (reason?:any)=>any) => {
			if (!sign.aborted) {
				const func: (()=>void) = typeof sign.onabort === "function" ? sign.onabort as ()=>void : () => { };
				sign.onabort = () => {
					func();
					abortTimeout();
					if (status === FUTURABLE_STATUS.PENDING) {
						abort && abort();
					}
					return;
				};

				const res = (value?: void | Response | T | PromiseLike<T>):void => {
					status = FUTURABLE_STATUS.FULFILLED;
					resolve(value);
				};

				const rej = (reason: any):void => {
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
			p.then(value => resolve(value as T | PromiseLike<T>)).catch(reject);
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

	then(onFulfilled: { (value?: void | T | Response | PromiseLike<T> | undefined): void; (value: void | T | Response | undefined): void; (val: T): void; (): void; (val: any): void; (val: any): void; (val: any): any; (val: any): void; (arg0: T): any; } | null | undefined, onRejected: { (reason: any): void; (): void; (reason: any): void; (reason: any): any; (reason: any): void; (arg0: any): any; } | undefined) {
		let resolve: (value?: void | Response | T | PromiseLike<T>) => void,
			reject: (reason?: any) => void;
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
					resolve(val);
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

	catch(onRejected: { (reason: any): void; (): void; (reason: any): void; (reason: any): any; (reason: any): void; (arg0: any): any; } | undefined) {
		return this.then(null, onRejected);
	}

	finally(onFinally: () => void) {
		return this.then(
			() => {
				onFinally();
			},
			() => {
				onFinally();
			}
		);
	}

	cancel() {
		!this.#signal?.aborted && this.#controller?.abort();
	}

	delay(cb:()=>void, timer:number) {
		let resolve, reject;
		const p = new Futurable((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.#signal);
		p.#controller = this.#controller;
		this.then(
			val => {
				this.#idsTimeout.push(setTimeout(() => resolve(cb(val)), timer));
			},
			reason => {
				this.#idsTimeout.push(setTimeout(() => resolve(cb(reason)), timer));
			},
		);
		return p;
	}

	sleep(timer) {
		return this.delay(val => val, timer);
	}

	fetch(url, opts) {
		let resolve, reject;
		const p = new Futurable((res, rej) => {
			resolve = res;
			reject = rej;
		}, this.#signal);
		p.#controller = this.#controller;
		this.then(val => {
			const urlFetch = typeof url === "function" ? url(val) : url,
				optsFetch = { ...(typeof opts === "function" ? opts(val) : opts), signal: this.#signal };

			fetch(urlFetch, optsFetch).then(resolve).catch(err => {
				if (err.name === "AbortError") {
					return;
				} else {
					reject(err);
				}
			});
		});
		return p;
	}

	onAbort(cb) {
		let resolve,
			reject,
			f = new Futurable((res, rej, utils) => {
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

	promisify() {
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

	static resolve(value, signal) {
		return new Futurable(res => res(value), signal);
	}

	static reject(reason, signal) {
		return new Futurable((res, rej) => rej(reason), signal);
	}

	static onAbort(cb, signal) {
		return new Futurable((res, rej, utils) => {
			utils.onAbort(() => res(cb()));
		}, signal);
	}

	static delay(cb, timer) {
		let timeout = timer, signal;
		if (typeof timer === "object") {
			timeout = timer.timer;
			signal = timer?.signal;
		}
		return Futurable.resolve(true, signal).delay(cb, timeout);
	}

	static sleep(timer) {
		return Futurable.delay(() => { }, timer);
	}

	static fetch(url, opts = {}) {
		const signal = opts?.signal || null;
		opts?.signal && delete opts.signal;
		return Futurable.resolve(true, signal)
			.fetch(url, opts);
	}

	static #handleIterables(iterables, signal) {
		let resolve, reject, array = [];
		const f = new Futurable((res, rej, utils) => {
			resolve = res;
			reject = rej;
			utils.onAbort(() => {
				for (let promise of array) {
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

	static all(iterables, signal) {
		const { f, resolve, reject, array } = Futurable.#handleIterables(iterables, signal);

		super.all(array).then(resolve).catch(reject);

		return f;
	}

	static allSettled(iterables, signal) {
		const { f, resolve, reject, array } = Futurable.#handleIterables(iterables, signal);

		super.allSettled(array).then(resolve).catch(reject);

		return f;
	}

	static race(iterables, signal) {
		const { f, resolve, reject, array } = Futurable.#handleIterables(iterables, signal);

		super.race(array).then(resolve).catch(reject);

		return f;
	}

	static any(iterables, signal) {
		const { f, resolve, reject, array } = Futurable.#handleIterables(iterables, signal);

		super.any(array).then(resolve).catch(reject);

		return f;
	}
}