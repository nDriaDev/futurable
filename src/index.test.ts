import { describe, expect, jest, test } from '@jest/globals';
import { Futurable } from './index';

jest.useFakeTimers({ advanceTimers: true });
// jest.spyOn(global, "setTimeout");
jest.spyOn(global, 'fetch');
// jest.replaceProperty(object, 'setTimeout', value)

describe('Futurable', () => {
	test("toString", () => {
		expect(new Futurable(() => { }).toString()).toBe(
			"[object Futurable]"
		);
	});
	test("get internal signal", () => {
		expect(new Futurable(() => { }).signal).toBeInstanceOf(AbortSignal);
	});
	test("get internal signal passed from outside", () => {
		const controller = new AbortController();
		const signal = controller.signal;
		expect(new Futurable(() => { }, signal).signal).toEqual(signal);
	});
	test('then', () => {
		expect.assertions(1);
		return new Futurable(res => res(3)).then(val => {
			expect(val).toBe(3);
		})
	});
	test("then empty", () => {
		expect.assertions(1);
		return new Futurable((res) => res(3)).then((val) => {
			expect(val).toBe(3);
		});
	});
	test("then throw error", () => {
		expect.assertions(1);
		return new Futurable((res) => res(3)).then(() => {
			throw Error("thenError");
		}).catch(err => {
			expect(err.message).toBe("thenError");
		});
	});
	test('catch', () => {
		expect.assertions(1);
		return new Futurable((res, rej) => rej(3)).catch(val => {
			expect(val).toBe(3);
		})
	});
	test("catch empty", () => {
		expect.assertions(1);
		return new Futurable((res, rej) => rej(3)).catch((val) => {
			expect(val).toBe(3);
		});
	});
	test("catch throw error", () => {
		expect.assertions(1);
		return new Futurable((res, rej) => rej(3)).catch(() => {
			throw Error("catchError");
		}).catch((err) => {
			expect(err.message).toBe("catchError");
		});
	});
	test("finally after resolve", () => {
		expect.assertions(1);
		let data:number|undefined;
		return new Futurable(res => res(3))
			.finally(() => {
				expect(data).toBeUndefined();
			});
	});
	test("finally after reject", () => {
		expect.assertions(1);
		let data:number|undefined;
		return new Futurable((res, rej) => rej(3)).finally(() => {
			expect(data).toBeUndefined();
		});
	});
	test("finally with error throwed", () => {
		expect.assertions(1);
		let data: number | undefined;
		return new Futurable(() => {
			throw Error("error with finally")
		}).finally(() => {
			data = 1;
		}).catch(() => {
			expect(data).toBe(1);
		});
	});
	test("signal already aborted", async () => {
		expect.assertions(1);
		let signal;
		await new Promise<void>((resolve) => {
			const controller = new AbortController();
			signal = controller.signal;
			signal.addEventListener('abort', () => {
				resolve();
			});
			controller.abort();
			new Futurable(res => {
				res(true);
			}, signal);
		});
		expect(signal).toBeInstanceOf(AbortSignal);
	});
	test('internal onCancel and sleep', async () => {
		expect.assertions(1);
		let data:number, f:Futurable<boolean>;
		await new Promise<void>(resolve => {
			setTimeout(() => {
				f.cancel();
			}, 1000);
			f = new Futurable<boolean>((res, rej, utils) => {
				utils.onCancel(() => {
				});
				utils.onCancel(() => {
					expect(data).toBeUndefined();
					resolve();
				});
				utils.sleep(3000).then(() => {
					data = 1;
					res(true);
				})
			});
			jest.advanceTimersByTime(1000);
		});
	});
	test("internal delay", () => {
		expect.assertions(2);
		let data: number|undefined;
		const f:Promise<void> = new Promise(resolve => {
				new Futurable((res, rej, utils) => {
					utils.delay(() => {
						data = 1;
						res(true);
					}, 1000);
				}).delay(() => {
					resolve();
				}, 3000);;
				setTimeout(() => {
					expect(data).toBe(1);
				}, 2000);
			});
		expect(data).toBeUndefined();
		jest.advanceTimersByTime(2000);
		return f;
	});
	test("internal fetch", async () => {
		(fetch as any).mockReturnValue(Promise.resolve({ json: () => Promise.resolve({}) }));
		expect.assertions(1);
		let data:number|undefined;
		await new Promise<void>((resolve) => {
			new Futurable<void>((res, rej, utils) => {
				utils.fetch('fake fake')
					.then(resp => resp.json())
					.then(() => {
						data = 1;
					})
					.then(() => {
						expect(data).toBe(1);
						res();
						resolve();
					});
			});
		});
	});
	test("internal fetch abort", async () => {
		// fetch.withImplementation(
		// 	()=> new Promise(res => setTimeout(res, 3000)),
		// 	Promise.resolve({ json: () => Promise.resolve({}) })
		// );
		let resolver:(value:void | PromiseLike<void>)=>void;
		(fetch as any).mockImplementation((url:string, opts: RequestInit) => new Promise((res, rej) => {
			opts?.signal!.addEventListener('abort', () => {
				rej({ name: "AbortError" });
				resolver();
			})
			setTimeout(() => {
				return res({ json: () => Promise.resolve({}) });
			}, 2000);
		}));
		expect.assertions(1);
		let data:number|undefined;
		await new Promise<void>((resolve) => {
			resolver = resolve;
			new Futurable<void>((res, rej, utils) => {
				setTimeout(() => {
					utils.cancel();
				}, 500);
				utils
					.fetch("fake fake")
					.then((resp) => resp.json())
					.then(() => {
						data = 1;
					})
					.then(() => {
						res();
						resolve();
					});
			});
			jest.advanceTimersByTime(1000);
		});
		expect(data).toBeUndefined();
	});
	test("internal fetch error", async () => {
		// fetch.withImplementation(
		// 	()=> new Promise(res => setTimeout(res, 3000)),
		// 	Promise.resolve({ json: () => Promise.resolve({}) })
		// );
		let resolver:(value:void | PromiseLike<void>)=>void;
		(fetch as any).mockImplementation(
			(url:string, opts:RequestInit) =>
				new Promise((res, rej) => {
					opts?.signal!.addEventListener("abort", () => {
						rej({ name: "Error" });
						resolver();
					});
					setTimeout(() => {
						return res({ json: () => Promise.resolve({}) });
					}, 2000);
				})
		);
		expect.assertions(1);
		let data:number|undefined;
		await new Promise<void>((resolve) => {
			resolver = resolve;
			new Futurable<void>((res, rej, utils) => {
				setTimeout(() => {
					utils.cancel();
				}, 500);
				utils
					.fetch("fake fake")
					.then((resp) => resp.json())
					.then(() => {
						data = 1;
					})
					.then(() => {
						res();
						resolve();
					});
			});
			jest.advanceTimersByTime(1000);
		});
		expect(data).toBeUndefined();
	});
	test("then with signal aborted", async () => {
		expect.assertions(1);
		let data:number|undefined;
		await new Promise<void>(async resolve2 => {
			let resolver: (value: void | PromiseLike<void>) => void;
			const controller = new AbortController();
			setTimeout(() => {
				controller.abort();
				resolver();
			}, 1000);
			await new Promise<void>((resolve) => {
				resolver = resolve;
				new Futurable<number>((res, rej, utils) => {
					utils.delay(() => {
						data = 1;
					}, 2000)
					res(4);
					jest.advanceTimersByTime(1000);
				}, controller.signal).then((val) => (data = val));
			});
			setTimeout(() => {
				resolve2();
			}, 1000);
			jest.advanceTimersByTimeAsync(1000);
		})
		expect(data).toBeUndefined();
	});
	test("delay", async () => {
		let data:number|undefined;
		await new Promise<void>(res => {
			Futurable.resolve(3).delay(() => {
				data = 4;
				res();
			}, 4000);
			jest.advanceTimersByTime(4000);
		});
		expect(data).toBe(4);
	});
	test("delay with reject", async () => {
		let data:number|undefined;
		await new Promise<void>(res => {
			Futurable.reject(3).delay(() => {
				data = 4;
				res();
			}, 4000).catch(()=>res());
			jest.advanceTimersByTime(4000);
		});
		expect(data).toBeUndefined();
	});
	test("sleep", async () => {
		expect.assertions(2);
		let data:number|undefined;
		await new Promise<void>(async resolve => {
			new Futurable(res => {
				data = 1;
				res(true);
			})
				.sleep(3000)
				.then(() => {
					data = 2;
					resolve();
				});
			expect(data).toBe(1);
			jest.advanceTimersByTime(3000);
		})
		expect(data).toBe(2);
	});
	test("fetch with string and object as parameters", async () => {
		(fetch as any).mockReturnValue(Promise.resolve({ json: () => Promise.resolve({}) }));
		expect.assertions(1);
		let data:number|undefined;
		await new Promise<void>((resolve) => {
			new Futurable((res) => {
				res(true);
			})
				.fetch('fake fake', {method: "GET"})
				.then(resp => resp.json())
				.then(() => {
					data = 1;
				})
				.then(() => {
					resolve();
				});
		});
		expect(data).toBe(1);
	});
	test("fetch with functions as parameters", async () => {
		(fetch as any).mockReturnValue(Promise.resolve({ json: () => Promise.resolve({}) }));
		expect.assertions(1);
		let data: number | undefined;
		await new Promise<void>((resolve) => {
			new Futurable<{url:string, method:string}>((res) => {
				res({url:"fake", method: "GET"});
			})
				.fetch((val) => val!.url + ' fake', (val) => ({method: val!.method}))
				.then(resp => resp.json())
				.then(() => {
					data = 1;
				})
				.then(() => {
					resolve();
				});
		});
		expect(data).toBe(1);
	});
	test("fetch rejected", async () => {
		(fetch as any).mockReturnValue(Promise.reject({ json: () => Promise.reject({}) }));
		expect.assertions(1);
		let data:number|undefined;
		await new Promise<void>((resolve) => {
			new Futurable((res) => {
				res(true);
			})
				.fetch('fake fake')
				.then(resp => resp.json())
				.then(() => {
					data = 1;
				})
				.then(() => {
					resolve();
				})
				.catch(() => {
					resolve();
				})
				;
		});
		expect(data).toBeUndefined();
	});
	test("fetch abort", async () => {
		// fetch.withImplementation(
		// 	()=> new Promise(res => setTimeout(res, 3000)),
		// 	Promise.resolve({ json: () => Promise.resolve({}) })
		// );
		let resolver:(value:void | PromiseLike<void>)=>void;
		(fetch as any).mockImplementation((url:string, opts:RequestInit) => new Promise((res, rej) => {
			opts?.signal!.addEventListener('abort', () => {
				rej({ name: "AbortError" });
				resolver();
			})
			setTimeout(() => {
				return res({ json: () => Promise.resolve({}) });
			}, 2000);
		}));
		expect.assertions(1);
		let data, f: Futurable<void>;
		await new Promise<void>((resolve) => {
			resolver = resolve;
			setTimeout(() => {
				f.cancel();
			}, 500)
			f = new Futurable((res) => {
				res(true);
			}).fetch("fake fake")
				.then((resp) => resp.json())
				.then(() => {
					data = 1;
				})
				.then(() => {
					resolve();
				});
			jest.advanceTimersByTimeAsync(1000);
		});
		expect(data).toBeUndefined();
	});
	test("fetch error", async () => {
		// fetch.withImplementation(
		// 	()=> new Promise(res => setTimeout(res, 3000)),
		// 	Promise.resolve({ json: () => Promise.resolve({}) })
		// );
		let resolver:(value:void | PromiseLike<void>)=>void;
		(fetch as any).mockImplementation(
			(url:string, opts:RequestInit) =>
				new Promise((res, rej) => {
					opts?.signal!.addEventListener("abort", () => {
						rej({ name: "Error" });
						resolver();
					});
					setTimeout(() => {
						return res({ json: () => Promise.resolve({}) });
					}, 2000);
				})
		);
		expect.assertions(1);
		let data, f:Futurable<void>;
		await new Promise<void>((resolve) => {
			resolver = resolve;
			setTimeout(() => {
				f.cancel();
			}, 500)
			f = new Futurable((res) => {
				res(true);
			}).fetch("fake fake")
				.then((resp) => resp.json())
				.then(() => {
					data = 1;
				})
				.then(() => {
					resolve();
				});
			jest.advanceTimersByTimeAsync(1000);
		});
		expect(data).toBeUndefined();
	});
	test("abort with resolve", async () => {
		expect.assertions(1);
		let data:number|undefined;
		await new Promise<void>((resolve) => {
			new Futurable((res) => {
				res(true);
			})
				.then(() => data = 1)
				.onCancel(() => {
					resolve();
				})
				.cancel();
		});
		expect(data).toBeUndefined();
	});
	test("abort with reject", async () => {
		expect.assertions(1);
		let data:number|undefined;
		await new Promise<void>((resolve) => {
			new Futurable((res, rej) => {
				rej(true);
			})
				.catch(() => data = 1)
				.onCancel(() => {
					resolve();
				})
				.cancel();
		});
		expect(data).toBeUndefined();
	});
	// test('promisify', async () => {
	// 	let data = 1;
	// 	await Futurable.delay({
	// 		cb: () => data = 2,
	// 		timer: 3000
	// 	}).promisify();
	// 	jest.advanceTimersByTime(3000);
	// 	expect(data).toBe(2);
	// });
	// test('promisify with signal aborted', async () => {
	// 	let resolver:(value: void | PromiseLike<void>)=>void, data = 1;
	// 	const controller = new AbortController();
	// 	setTimeout(() => {
	// 		controller.abort();
	// 		resolver();
	// 	}, 1000)
	// 	await new Promise<void>(async res => {
	// 		resolver = res;
	// 		jest.advanceTimersByTime(1000);
	// 		await Futurable.delay(() => data = 2, { timer: 3000, signal: controller.signal }).promisify();
	// 	})
	// 	expect(data).toBe(1);
	// });
	test('futurizable utils', async () => {
		const data = 1;
		const newData = await new Futurable<number>((resolve, reject, utils) => {
			utils.futurizable(new Promise<number>(res => res(1)))
			.then(resolve)
		})
			.then(val => val + data);
		jest.advanceTimersByTime(3000);
		expect(newData).toBe(2);
	});
	test('futurizable futurable chaining with function as parameter', async () => {
		const newData = await Futurable.resolve(1).futurizable<number>(val => new Promise(res => res(val!+1)))
			.sleep(3000)
		jest.advanceTimersByTime(3000);
		expect(newData).toBe(2);
	});
	test('futurizable futurable chaining with promise as parameter', async () => {
		const newData = await Futurable.resolve(2).futurizable<number>(new Promise(res => res(1)))
			.sleep(3000)
		jest.advanceTimersByTime(3000);
		expect(newData).toBe(1);
	});
	test('static futurizable', async () => {
		const data = 1;
		const newData = await Futurable.futurizable<number>({ promise: new Promise(res => res(1)) })
			.sleep(3000)
			.then(val => val + data);
		jest.advanceTimersByTime(3000);
		expect(newData).toBe(2);
	});
	test('static resolve', async () => {
		let data = 1;
		data = await Futurable.resolve(3);
		expect(data).toBe(3);
	});
	test('static reject', async () => {
		let data = 1;
		data = await Futurable.reject(3).catch(val => val);
		expect(data).toBe(3);
	});
	test('static onCancel', () => {
		let data = 1;
		const controller = new AbortController();
		Futurable.onCancel({
			cb: () => {
				expect(data).toBe(1);
			},
			signal: controller.signal
		});
		Futurable.resolve(3, controller.signal).then(val => data = val).cancel();
	});
	test('static sleep', async () => {
		expect.assertions(2);
		let data = 1;
		setTimeout(() => {
			expect(data).toBe(1);
		}, 1000);
		await Futurable.sleep({timer: 3000});
		jest.advanceTimersByTime(1000);
		data = 2;
		jest.advanceTimersByTime(3000);
		expect(data).toBe(2);
	});
	test("static fetch", async () => {
		(fetch as any).mockReturnValue(Promise.resolve({ json: () => Promise.resolve({ id: 0 }) }));
		expect.assertions(1);
		const resp = await Futurable.fetch('fake fake');
		const data = await resp.json();
		expect(data.id).toBe(0);
	});
	test("static fetch abort", async () => {
		let resolver:(value:void | PromiseLike<void>)=>void;
		(fetch as any).mockImplementation((url:string, opts:RequestInit) => new Promise((res, rej) => {
			opts?.signal!.addEventListener('abort', () => {
				rej({ name: "AbortError" });
				resolver();
			})
			setTimeout(() => {
				return res({ json: () => Promise.resolve({}) });
			}, 2000);
		}));
		expect.assertions(1);
		let data, f:Futurable<void>;
		await new Promise<void>((resolve) => {
			resolver = resolve;
			setTimeout(() => {
				f.cancel();
			}, 500)
			f = Futurable.fetch("fake fake")
				.then((resp) => resp.json())
				.then(() => {
					data = 1;
				})
				.then(() => {
					resolve();
				});
			jest.advanceTimersByTimeAsync(1000);
		});
		expect(data).toBeUndefined();
	});
	test("static fetch error", async () => {
		let resolver:(value:void | PromiseLike<void>)=>void;
		(fetch as any).mockImplementation((url:string, opts:RequestInit) => new Promise((res, rej) => {
			opts?.signal!.addEventListener('abort', () => {
				rej({ name: "Error" });
				resolver();
			})
			setTimeout(() => {
				return res({ json: () => Promise.resolve({}) });
			}, 2000);
		}));
		expect.assertions(1);
		let data, f: Futurable<void>;
		await new Promise<void>((resolve) => {
			resolver = resolve;
			setTimeout(() => {
				f.cancel();
			}, 500)
			f = Futurable.fetch("fake fake")
				.then((resp) => resp.json())
				.then(() => {
					data = 1;
				})
				.then(() => {
					resolve();
				});
			jest.advanceTimersByTimeAsync(1000);
		});
		expect(data).toBeUndefined();
	});
	test("all with one futurable resolve and one promise resolve", async () => {
		expect.assertions(2);
		const data = await Futurable.all([
			Futurable.resolve(1),
			Promise.resolve(1)
		]);
		expect(data).toBeInstanceOf(Array);
		expect(data).toContainEqual(1);
	});
	test("all aborted with two futurable delay", async () => {
		expect.assertions(1);
		let data, f: Futurable<[number,number]>, resolve: (value: void | PromiseLike<void>) => void;
		setTimeout(() => {
			f.cancel();
			resolve();
		}, 500);
		await new Promise<void>(async res => {
			resolve = res;
			f = Futurable.all([
				Futurable.delay<number>({
					cb: () => 1,
					timer: 2000
				}),
				Futurable.delay<number>({
					cb: () => 1,
					timer: 3000
				})
			]);
			jest.advanceTimersByTime(1000);
			data = await f;
			res();
		})
		expect(data).toBeUndefined();
	});
	test("all with one futurable resolve one value and one futurable rejected", async () => {
		expect.assertions(1);
		let data:number|undefined|unknown;
		try {
			data = await Futurable.all([
				Futurable.resolve(1),
				1,
				Futurable.reject(1)
			]);
		} catch (e) {
			data = e;
		}
		expect(data).toBe(1);
	});
	test("allSettled with one futurable resolve one value and one futurable rejected", async () => {
		expect.assertions(4);
		const data = await Futurable.allSettled([
			Futurable.resolve(1),
			1,
			Futurable.reject(1)
		]);
		expect(data).toBeInstanceOf(Array);
		expect(data[0].status).toBe("fulfilled");
		expect(data[1].status).toBe("fulfilled");
		expect(data[2].status).toBe("rejected");
	});
	test("allSettled aborted with two futurable delay", async () => {
		expect.assertions(1);
		let data, f: Futurable<[PromiseSettledResult<number>, PromiseSettledResult<number>]>, resolve: (value: void | PromiseLike<void>) => void;
		setTimeout(() => {
			f.cancel();
			resolve();
		}, 500);
		await new Promise<void>(async res => {
			resolve = res;
			f = Futurable.allSettled([
				Futurable.delay<number>({
					cb: () => 1,
					timer: 2000
				}),
				Futurable.delay<number>({
					cb: () => 1,
					timer: 3000
				})
			]);
			jest.advanceTimersByTime(1000);
			data = await f;
			res();
		})
		expect(data).toBeUndefined();
	});
	test("race with one futurable delay one value and one futurable resolve", async () => {
		expect.assertions(1);
		const data = await Futurable.race([
			Futurable.delay({
				cb: () => 1,
				timer: 3000
			}),
			1,
			Futurable.resolve(2)
		]);
		expect(data).toBe(1);
	});
	test("race aborted with two futurable delay", async () => {
		expect.assertions(1);
		let data, f: Futurable<number>, resolve: (value: void | PromiseLike<void>) => void;
		setTimeout(() => {
			f.cancel();
			resolve();
		}, 500);
		await new Promise<void>(async res => {
			resolve = res;
			f = Futurable.race([
				Futurable.delay<number>({
					cb: () => 1,
					timer: 2000
				}),
				Futurable.delay<number>({
					cb: () => 1,
					timer: 3000
				})
			]);
			jest.advanceTimersByTime(1000);
			data = await f;
			res();
		})
		expect(data).toBeUndefined();
	});
	test("any with one futurable delay one value and one futurable reject", async () => {
		expect.assertions(1);
		const data = await Futurable.race([
			Futurable.delay({
				cb: () => 3,
				timer: 3000
			}),
			1,
			Futurable.reject(2)
		]);
		expect(data).toBe(1);
	});
	test("any with all rejected", async () => {
		expect.assertions(4);
		let data:any[];
		try {
			data = await Futurable.any([
				Promise.reject(1),
				Promise.reject(4),
				Promise.reject(2)
			]);
		} catch (aggregateErrors) {
			data = (aggregateErrors as AggregateError).errors;
		}
		expect(data).toBeInstanceOf(Array);
		expect(data[0]).toBe(1);
		expect(data[1]).toBe(4);
		expect(data[2]).toBe(2);
	});
	test("any aborted with two futurable delay", async () => {
		expect.assertions(1);
		let data, f: Futurable<number>, resolve: (value: void | PromiseLike<void>) => void;
		setTimeout(() => {
			f.cancel();
			resolve();
		}, 500);
		await new Promise<void>(async res => {
			resolve = res;
			f = Futurable.any([
				Futurable.delay<number>({
					cb: () => 1,
					timer: 2000
				}),
				Futurable.delay<number>({
					cb: () => 1,
					timer: 3000
				})
			]);
			jest.advanceTimersByTime(1000);
			data = await f;
			res();
		})
		expect(data).toBeUndefined();
	});
})