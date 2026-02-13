import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { Futurable } from './Futurable.js';

describe('Futurable', () => {
	describe('Constructor and Basic Operations', () => {
		it('should create a Futurable that resolves', async () => {
			const f = new Futurable<number>((resolve) => {
				resolve(42);
			});
			const result = await f;
			assert.strictEqual(result, 42);
		});

		it('should create a Futurable that rejects', async () => {
			const f = new Futurable<number>((_, reject) => {
				reject(new Error('test error'));
			});
			await assert.rejects(f, /test error/);
		});

		it('should handle executor with utils', async () => {
			const f = new Futurable<string>((resolve, _, utils) => {
				assert.ok(utils.signal);
				assert.ok(typeof utils.cancel === 'function');
				resolve('ok');
			});
			await f;
		});

		it('should respect external signal', async () => {
			const controller = new AbortController();
			const f = new Futurable<number>((resolve) => {
				setTimeout(() => resolve(1), 100);
			}, controller.signal);

			controller.abort();
			assert.ok(f.signal.aborted);
		});

		it('should handle already aborted signal', async () => {
			const controller = new AbortController();
			controller.abort();

			const f = new Futurable<number>((resolve) => {
				resolve(1);
			}, controller.signal);

			assert.ok(f.signal.aborted);
		});
	});

	describe('then() method', () => {
		it('should chain then callbacks', async () => {
			const result = await Futurable.resolve(5)
			.then(x => x * 2)
			.then(x => x + 3);
			assert.strictEqual(result, 13);
		});

		it('should handle async then callbacks', async () => {
			const result = await Futurable.resolve(5)
			.then(async x => {
				await new Promise(r => setTimeout(r, 10));
				return x * 2;
			});
			assert.strictEqual(result, 10);
		});

		it('should propagate value when onfulfilled is null', async () => {
			const result = await Futurable.resolve(42).then(null);
			assert.strictEqual(result, 42);
		});

		it('should handle errors in onfulfilled', async () => {
			await assert.rejects(
				Futurable.resolve(1).then(() => {
					throw new Error('callback error');
				}),
				/callback error/
			);
		});

		it('should call onrejected on rejection', async () => {
			const result = await Futurable.reject('error').then(
				null,
				(err) => `handled: ${err}`
			);
			assert.strictEqual(result, 'handled: error');
		});

		it('should handle errors in onrejected', async () => {
			await assert.rejects(
				Futurable.reject('initial').then(null, () => {
					throw new Error('onrejected error');
				}),
				/onrejected error/
			);
		});

		it('should not execute callbacks when cancelled', async () => {
			let executed = false;
			const f = new Futurable<number>((resolve) => {
				setTimeout(() => resolve(1), 100);
			});

			const chained = f.then(() => {
				executed = true;
				return 2;
			});

			f.cancel();
			await new Promise(r => setTimeout(r, 150));
			assert.strictEqual(executed, false);
		});

		it('should share controller between chained futurables', async () => {
			const f1 = Futurable.resolve(1);
			const f2 = f1.then(x => x + 1);

			f1.cancel();
			assert.ok(f2.signal.aborted);
		});
	});

	describe('catch() method', () => {
		it('should catch rejections', async () => {
			const result = await Futurable.reject('error').catch(
				err => `caught: ${err}`
			);
			assert.strictEqual(result, 'caught: error');
		});

		it('should not catch fulfilled values', async () => {
			let caught = false;
			const result = await Futurable.resolve(42).catch(() => {
				caught = true;
				return 0;
			});
			assert.strictEqual(result, 42);
			assert.strictEqual(caught, false);
		});
	});

	describe('finally() method', () => {
		it('should execute finally on resolution', async () => {
			let finallyCalled = false;
			const result = await Futurable.resolve(42).finally(() => {
				finallyCalled = true;
			});
			assert.strictEqual(result, 42);
			assert.ok(finallyCalled);
		});

		it('should execute finally on rejection', async () => {
			let finallyCalled = false;
			try {
				Futurable.reject('error').finally(() => {
					finallyCalled = true;
				});
			} catch (error) {}
			assert.ok(finallyCalled);
		});

		it('should propagate original value', async () => {
			const result = await Futurable.resolve(100).finally(() => {
				return null; // This should be ignored
			});
			assert.strictEqual(result, 100);
		});

		it('should propagate original error', async () => {
			await assert.rejects(
				Futurable.reject(new Error('original')).finally(() => {
					return null;
				}),
				/original/
			);
		});
	});

	describe('cancel() method', () => {
		it('should abort the signal', () => {
			const f = new Futurable<number>((resolve) => {
				setTimeout(() => resolve(1), 100);
			});

			assert.strictEqual(f.signal.aborted, false);
			f.cancel();
			assert.ok(f.signal.aborted);
		});

		it('should be idempotent', () => {
			const f = new Futurable<number>((resolve) => {
				resolve(1);
			});

			f.cancel();
			f.cancel();
			f.cancel();
			assert.ok(f.signal.aborted);
		});

		it('should trigger onCancel callbacks', async () => {
			let callbackCalled = false;
			const f = new Futurable<number>((resolve, _, utils) => {
				utils.onCancel(() => {
					callbackCalled = true;
				});
				setTimeout(() => resolve(1), 100);
			});

			f.cancel();
			await new Promise(r => setTimeout(r, 10));
			assert.ok(callbackCalled);
		});

		it('should clear timeouts', async () => {
			const f = new Futurable<number>((resolve, _, utils) => {
				utils.sleep(1000).then(() => resolve(1));
			});

			f.cancel();
			await new Promise(r => setTimeout(r, 50));
			// Should not throw or hang
		});
	});

	describe('delay() method', () => {
		it('should delay execution', async () => {
			const start = Date.now();
			const result = await Futurable.resolve(5).delay(x => x * 2, 100);
			const elapsed = Date.now() - start;

			assert.strictEqual(result, 10);
			assert.ok(elapsed >= 100);
		});

		it('should be cancellable', async () => {
			let executed = false;
			const f = Futurable.resolve(5).delay(() => {
				executed = true;
				return 10;
			}, 100);

			setTimeout(() => f.cancel(), 50);
			await new Promise(r => setTimeout(r, 150));
			assert.strictEqual(executed, false);
		});

		it('should propagate rejection without delay', async () => {
			await assert.rejects(
				Futurable.reject('error').delay(x => x, 100),
				/error/
			);
		});

		it('should handle async callbacks', async () => {
			const result = await Futurable.resolve(5).delay(async x => {
				await new Promise(r => setTimeout(r, 10));
				return x * 3;
			}, 50);
			assert.strictEqual(result, 15);
		});
	});

	describe('sleep() method', () => {
		it('should pause execution', async () => {
			const start = Date.now();
			const result = await Futurable.resolve(42).sleep(100);
			const elapsed = Date.now() - start;

			assert.strictEqual(result, 42);
			assert.ok(elapsed >= 100);
		});

		it('should be cancellable', async () => {
			const f = Futurable.resolve(1).sleep(100);
			setTimeout(() => f.cancel(), 50);
			await new Promise(r => setTimeout(r, 150));
			// Should complete without error
		});
	});

	describe('fetch() method', () => {
		// Note: These tests require a mock fetch implementation
		it('should perform fetch with value', async () => {
			global.fetch = (async (url: string) => {
				return new Response(JSON.stringify({ url }));
			}) as typeof fetch;

			const response = await Futurable.resolve('test').fetch(
				val => `https://api.example.com/${val}`
			);
			const data = await response.json();
			assert.strictEqual(data.url, 'https://api.example.com/test');
		});

		it('should use static url', async () => {
			global.fetch = (async (url: string) => {
				return new Response(JSON.stringify({ url }));
			}) as typeof fetch;

			const response = await Futurable.resolve('ignored').fetch(
				'https://static.example.com'
			);
			const data = await response.json();
			assert.strictEqual(data.url, 'https://static.example.com');
		});

		it('should pass options', async () => {
			let receivedOptions: RequestInit = {};
			global.fetch = (async (url: string, opts?: RequestInit) => {
				receivedOptions = opts || {};
				return new Response('{}');
			}) as typeof fetch;

			await Futurable.resolve('test').fetch(
				'https://example.com',
				{ method: 'POST' }
			);
			assert.strictEqual(receivedOptions.method, 'POST');
		});

		it('should use dynamic options', async () => {
			let receivedOptions: RequestInit = {};
			global.fetch = (async (url: string, opts?: RequestInit) => {
				receivedOptions = opts || {};
				return new Response('{}');
			}) as typeof fetch;

			await Futurable.resolve('user').fetch(
				'https://example.com',
				(val) => ({ method: 'POST', body: val })
			);
			assert.strictEqual(receivedOptions.method, 'POST');
			assert.strictEqual(receivedOptions.body, 'user');
		});

		it('should cancel fetch on abort', async () => {
			let aborted = false;
			global.fetch = (async (url: string, opts?: RequestInit) => {
				return new Promise((resolve, reject) => {
					opts?.signal?.addEventListener('abort', () => {
						aborted = true;
						reject(new DOMException('Aborted', 'AbortError'));
					});
					setTimeout(() => resolve(new Response('{}')), 100);
				});
			}) as typeof fetch;

			const f = Futurable.resolve('test').fetch('https://example.com');
			setTimeout(() => f.cancel(), 50);
			await new Promise(r => setTimeout(r, 150));
			assert.ok(aborted);
		});

		it('should handle fetch errors', async () => {
			global.fetch = async () => {
				throw new Error('Network error');
			};

			await assert.rejects(
				Futurable.resolve('test').fetch('https://example.com'),
				/Network error/
			);
		});

		it('should ignore AbortError', async () => {
			global.fetch = (async (url: string, opts?: RequestInit) => {
				throw new DOMException('Aborted', 'AbortError');
			}) as typeof fetch;

			const f = Futurable.resolve('test').fetch('https://example.com');
			f.cancel();
			await new Promise(r => setTimeout(r, 50));
			// Should not throw
		});
	});

	describe('onCancel() method', () => {
		it('should register cancel callback', async () => {
			let called = false;
			const f = new Futurable<number>((resolve) => {
				setTimeout(() => resolve(1), 100);
			}).onCancel(() => {
				called = true;
			});

			f.cancel();
			await new Promise(r => setTimeout(r, 10));
			assert.ok(called);
		});

		it('should register multiple callbacks', async () => {
			let count = 0;
			const f = new Futurable<number>((resolve) => {
				setTimeout(() => resolve(1), 100);
			})
			.onCancel(() => count++)
			.onCancel(() => count++)
			.onCancel(() => count++);

			f.cancel();
			await new Promise(r => setTimeout(r, 10));
			assert.strictEqual(count, 3);
		});

		it('should propagate value through chain', async () => {
			let called = false;
			const result = await Futurable.resolve(42).onCancel(() => {
				called = true;
			});
			assert.strictEqual(result, 42);
			assert.strictEqual(called, false);
		});
	});

	describe('futurizable() method', () => {
		it('should convert Promise to Futurable', async () => {
			const promise = Promise.resolve(42);
			const result = await Futurable.resolve().futurizable(promise);
			assert.strictEqual(result, 42);
		});

		it('should convert with function', async () => {
			const result = await Futurable.resolve(5).futurizable(
				val => Promise.resolve(val! * 2)
			);
			assert.strictEqual(result, 10);
		});

		it('should handle Promise rejection', async () => {
			const promise = Promise.reject('error');
			await assert.rejects(
				Futurable.resolve().futurizable(promise),
				/error/
			);
		});

		it('should be cancellable', async () => {
			let resolved = false;
			const promise = new Promise(resolve => {
				setTimeout(() => {
					resolved = true;
					resolve(42);
				}, 100);
			});

			const f = Futurable.resolve().futurizable(promise);
			f.cancel();
			await new Promise(r => setTimeout(r, 150));
			// Note: The original promise still resolves, but the Futurable ignores it
			assert.ok(f.signal.aborted);
		});
	});

	describe('Static resolve() method', () => {
		it('should resolve with void', async () => {
			const result = await Futurable.resolve();
			assert.strictEqual(result, undefined);
		});

		it('should resolve with value', async () => {
			const result = await Futurable.resolve(42);
			assert.strictEqual(result, 42);
		});

		it('should resolve with Promise', async () => {
			const promise = Promise.resolve(100);
			const result = await Futurable.resolve(promise);
			assert.strictEqual(result, 100);
		});

		it('should resolve with Futurable', async () => {
			const f1 = Futurable.resolve(50);
			const result = await Futurable.resolve(f1);
			assert.strictEqual(result, 50);
		});

		it('should respect external signal', async () => {
			const controller = new AbortController();
			const f = Futurable.resolve(1, controller.signal);
			controller.abort();
			assert.ok(f.signal.aborted);
		});
	});

	describe('Static reject() method', () => {
		it('should reject with reason', async () => {
			await assert.rejects(
				Futurable.reject('error'),
				/error/
			);
		});

		it('should reject with Error', async () => {
			await assert.rejects(
				Futurable.reject(new Error('test')),
				/test/
			);
		});

		it('should respect external signal', async () => {
			const controller = new AbortController();
			const f = Futurable.reject('error', controller.signal);
			controller.abort();
			assert.ok(f.signal.aborted);
		});
	});

	describe('Static onCancel() method', () => {
		it('should execute callback on cancel', async () => {
			let result = 0;
			const f = Futurable.onCancel({
				cb: () => result = 42
			});

			f.cancel();
			await new Promise(r => setTimeout(r, 10));
			assert.strictEqual(result, 42);
		});

		it('should resolve with callback result', async () => {
			const f = Futurable.onCancel({
				cb: () => 'cancelled'
			});

			f.cancel();
			const result = await f;
			assert.strictEqual(result, 'cancelled');
		});

		it('should respect external signal', async () => {
			const controller = new AbortController();
			let called = false;
			const f = Futurable.onCancel({
				cb: () => { called = true; return 1; },
				signal: controller.signal
			});

			controller.abort();
			await new Promise(r => setTimeout(r, 10));
			assert.ok(called);
		});
	});

	describe('Static delay() method', () => {
		it('should delay callback execution', async () => {
			const start = Date.now();
			const result = await Futurable.delay({
				cb: () => 42,
				timer: 100
			});
			const elapsed = Date.now() - start;

			assert.strictEqual(result, 42);
			assert.ok(elapsed >= 100);
		});

		it('should be cancellable', async () => {
			let executed = false;
			const f = Futurable.delay({
				cb: () => { executed = true; return 1; },
				timer: 100
			});

			setTimeout(() => f.cancel(), 50);
			await new Promise(r => setTimeout(r, 150));
			assert.strictEqual(executed, false);
		});

		it('should respect external signal', async () => {
			const controller = new AbortController();
			const f = Futurable.delay({
				cb: () => 1,
				timer: 100,
				signal: controller.signal
			});

			controller.abort();
			assert.ok(f.signal.aborted);
		});
	});

	describe('Static sleep() method', () => {
		it('should sleep for specified time', async () => {
			const start = Date.now();
			await Futurable.sleep({ timer: 100 });
			const elapsed = Date.now() - start;

			assert.ok(elapsed >= 100);
		});

		it('should be cancellable', async () => {
			const f = Futurable.sleep({ timer: 100 });
			setTimeout(() => f.cancel(), 50);
			await new Promise(r => setTimeout(r, 150));
			assert.ok(f.signal.aborted);
		});

		it('should respect external signal', async () => {
			const controller = new AbortController();
			const f = Futurable.sleep({
				timer: 100,
				signal: controller.signal
			});

			controller.abort();
			assert.ok(f.signal.aborted);
		});
	});

	describe('Static fetch() method', () => {
		it('should perform fetch', async () => {
			global.fetch = (async (url: string) => {
				return new Response(JSON.stringify({ url }));
			}) as typeof fetch;

			const response = await Futurable.fetch('https://example.com');
			const data = await response.json();
			assert.strictEqual(data.url, 'https://example.com');
		});

		it('should pass options', async () => {
			let receivedOptions: RequestInit = {};
			global.fetch = (async (url: string, opts?: RequestInit) => {
				receivedOptions = opts || {};
				return new Response('{}');
			}) as typeof fetch;

			await Futurable.fetch('https://example.com', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			assert.strictEqual(receivedOptions.method, 'POST');
		});

		it('should use provided signal', async () => {
			const controller = new AbortController();
			let receivedSignal: AbortSignal | null | undefined;

			global.fetch = (async (url: string, opts?: RequestInit) => {
				receivedSignal = opts?.signal;
				return new Response('{}');
			}) as typeof fetch;

			await Futurable.fetch('https://example.com', {
				signal: controller.signal
			});

			assert.strictEqual(receivedSignal, controller.signal);
		});

		it('should be cancellable', async () => {
			let aborted = false;
			global.fetch = (async (url: string, opts?: RequestInit) => {
				return new Promise((resolve) => {
					opts?.signal?.addEventListener('abort', () => {
						aborted = true;
					});
					setTimeout(() => resolve(new Response('{}')), 100);
				});
			}) as typeof fetch;

			const f = Futurable.fetch('https://example.com');
			setTimeout(() => f.cancel(), 50);
			await new Promise(r => setTimeout(r, 150));
			assert.ok(aborted);
		});
	});

	describe('Static futurizable() method', () => {
		it('should convert Promise to Futurable', async () => {
			const promise = Promise.resolve(42);
			const result = await Futurable.futurizable({ promise });
			assert.strictEqual(result, 42);
		});

		it('should handle rejection', async () => {
			const promise = Promise.reject('error');
			await assert.rejects(
				Futurable.futurizable({ promise }),
				/error/
			);
		});

		it('should respect external signal', async () => {
			const controller = new AbortController();
			const promise = new Promise(r => setTimeout(() => r(1), 100));
			const f = Futurable.futurizable({
				promise,
				signal: controller.signal
			});

			controller.abort();
			assert.ok(f.signal.aborted);
		});
	});

	describe('Static all() method', () => {
		it('should resolve all futurables', async () => {
			const result = await Futurable.all([
				Futurable.resolve(1),
				Futurable.resolve(2),
				Futurable.resolve(3)
			]);
			assert.deepStrictEqual(result, [1, 2, 3]);
		});

		it('should handle mixed types', async () => {
			const result = await Futurable.all([
				Futurable.resolve(1),
				Promise.resolve(2),
				3
			]);
			assert.deepStrictEqual(result, [1, 2, 3]);
		});

		it('should reject if any rejects', async () => {
			await assert.rejects(
				Futurable.all([
					Futurable.resolve(1),
					Futurable.reject('error'),
					Futurable.resolve(3)
				]),
				/error/
			);
		});

		it('should cancel all on cancellation', async () => {
			const f1 = Futurable.resolve(1).sleep(100);
			const f2 = Futurable.resolve(2).sleep(100);
			const f3 = Futurable.resolve(3).sleep(100);

			const all = Futurable.all([f1, f2, f3]);
			setTimeout(() => all.cancel(), 50);

			await new Promise(r => setTimeout(r, 150));
			assert.ok(f1.signal.aborted);
			assert.ok(f2.signal.aborted);
			assert.ok(f3.signal.aborted);
		});

		it('should respect external signal', async () => {
			const controller = new AbortController();
			const all = Futurable.all(
				[Futurable.resolve(1)],
				controller.signal
			);

			controller.abort();
			assert.ok(all.signal.aborted);
		});

		it('should use futurable signal if no external signal', async () => {
			const all = Futurable.all([Futurable.resolve(1)]);
			all.cancel();
			assert.ok(all.signal.aborted);
		});
	});

	describe('Static allSettled() method', () => {
		it('should settle all futurables', async () => {
			const result = await Futurable.allSettled([
				Futurable.resolve(1),
				Futurable.reject('error'),
				Futurable.resolve(3)
			]);

			assert.strictEqual(result[0].status, 'fulfilled');
			assert.strictEqual((result[0] as any).value, 1);
			assert.strictEqual(result[1].status, 'rejected');
			assert.strictEqual((result[1] as any).reason, 'error');
			assert.strictEqual(result[2].status, 'fulfilled');
			assert.strictEqual((result[2] as any).value, 3);
		});

		it('should handle mixed types', async () => {
			const result = await Futurable.allSettled([
				Futurable.resolve(1),
				Promise.reject('error'),
				2
			]);

			assert.strictEqual(result[0].status, 'fulfilled');
			assert.strictEqual(result[1].status, 'rejected');
			assert.strictEqual(result[2].status, 'fulfilled');
		});

		it('should cancel all on cancellation', async () => {
			const f1 = Futurable.resolve(1).sleep(100);
			const f2 = Futurable.resolve(2).sleep(100);

			const all = Futurable.allSettled([f1, f2]);
			setTimeout(() => all.cancel(), 50);

			await new Promise(r => setTimeout(r, 150));
			assert.ok(f1.signal.aborted);
			assert.ok(f2.signal.aborted);
		});
	});

	describe('Static race() method', () => {
		it('should resolve with first to settle', async () => {
			const result = await Futurable.race([
				Futurable.delay({ cb: () => 1, timer: 100 }),
				Futurable.delay({ cb: () => 2, timer: 50 }),
				Futurable.delay({ cb: () => 3, timer: 150 })
			]);
			assert.strictEqual(result, 2);
		});

		it('should reject if first to settle rejects', async () => {
			await assert.rejects(
				Futurable.race([
					Futurable.delay({ cb: () => 1, timer: 100 }),
					Futurable.delay({ cb: () => { throw new Error('fast error'); }, timer: 50 })
				]),
				/fast error/
			);
		});

		it('should cancel losers', async () => {
			const f1 = Futurable.delay({ cb: () => 1, timer: 100 });
			const f2 = Futurable.delay({ cb: () => 2, timer: 50 });

			await Futurable.race([f1, f2]);
			await new Promise(r => setTimeout(r, 150));
			// f1 should have been cancelled after f2 won
		});

		it('should handle plain values', async () => {
			const result = await Futurable.race([
				Futurable.delay({ cb: () => 1, timer: 100 }),
				2
			]);
			assert.strictEqual(result, 2);
		});
	});

	describe('Static any() method', () => {
		it('should resolve with first successful', async () => {
			const result = await Futurable.any([
				Futurable.reject('error1'),
				Futurable.delay({ cb: () => 2, timer: 50 }),
				Futurable.reject('error3')
			]);
			assert.strictEqual(result, 2);
		});

		it('should reject if all reject', async () => {
			await assert.rejects(
				Futurable.any([
					Futurable.reject('error1'),
					Futurable.reject('error2')
				])
			);
		});

		it('should handle plain values', async () => {
			const result = await Futurable.any([
				Futurable.reject('error'),
				42
			]);
			assert.strictEqual(result, 42);
		});
	});

	describe('Static polling() method', () => {
		it('should poll at interval', async () => {
			let count = 0;
			const polling = Futurable.polling(
				() => { count++; return count; },
				{ interval: 50 }
			);

			await new Promise(r => setTimeout(r, 160));
			polling.cancel();

			assert.ok(count >= 3);
		});

		it('should execute immediately when immediate is true', async () => {
			let count = 0;
			const polling = Futurable.polling(
				() => { count++; return count; },
				{ interval: 100, immediate: true }
			);

			await new Promise(r => setTimeout(r, 10));
			assert.strictEqual(count, 1);

			polling.cancel();
		});

		it('should handle errors with catch', async () => {
			const errors: any[] = [];
			let count = 0;

			const polling = Futurable.polling(
				() => {
					count++;
					if (count % 2 === 0) {
						throw new Error(`error ${count}`);
					}
					return count;
				},
				{ interval: 50 }
			);

			polling.catch(err => errors.push(err));

			await new Promise(r => setTimeout(r, 160));
			polling.cancel();

			assert.ok(errors.length > 0);
		});

		it('should handle async functions', async () => {
			let count = 0;
			const polling = Futurable.polling(
				async () => {
					await new Promise(r => setTimeout(r, 10));
					count++;
					return count;
				},
				{ interval: 50 }
			);

			await new Promise(r => setTimeout(r, 160));
			polling.cancel();

			assert.ok(count >= 2);
		});

		it('should handle Futurable returns', async () => {
			let count = 0;
			const polling = Futurable.polling(
				() => Futurable.delay({ cb: () => ++count, timer: 10 }),
				{ interval: 50 }
			);

			await new Promise(r => setTimeout(r, 160));
			polling.cancel();

			assert.ok(count >= 2);
		});

		it('should respect external signal', async () => {
			const controller = new AbortController();
			let count = 0;

			const polling = Futurable.polling(
				() => { count++; return count; },
				{ interval: 50, signal: controller.signal }
			);

			await new Promise(r => setTimeout(r, 80));
			controller.abort();
			polling.cancel();

			const finalCount = count;
			await new Promise(r => setTimeout(r, 100));
			// Should not increment after abort
			assert.strictEqual(count, finalCount);
		});

		it('should queue errors before catch is registered', async () => {
			const errors: any[] = [];

			const polling = Futurable.polling(
				() => { throw new Error('test'); },
				{ interval: 50, immediate: true }
			);

			await new Promise(r => setTimeout(r, 10));

			polling.catch(err => errors.push(err));

			assert.strictEqual(errors.length, 1);
			polling.cancel();
		});

		it('should cancel internal futurables on cancel', async () => {
			let cancelled = false;

			const polling = Futurable.polling(
				() => new Futurable((res, rej, utils) => {
					utils.onCancel(() => { cancelled = true; });
					setTimeout(() => res(1), 200);
				}),
				{ interval: 50, immediate: true }
			);

			await new Promise(r => setTimeout(r, 10));
			polling.cancel();
			await new Promise(r => setTimeout(r, 10));

			assert.ok(cancelled);
		});
	});

	describe('Static withResolvers() method', () => {
		it('should create futurable with resolvers', async () => {
			const { promise, resolve } = Futurable.withResolvers<number>();

			setTimeout(() => resolve(42), 50);
			const result = await promise;

			assert.strictEqual(result, 42);
		});

		it('should provide reject function', async () => {
			const { promise, reject } = Futurable.withResolvers<number>();

			setTimeout(() => reject('error'), 50);

			await assert.rejects(promise, /error/);
		});

		it('should provide cancel function', async () => {
			const { promise, cancel } = Futurable.withResolvers<number>();

			cancel();

			assert.ok((promise as Futurable<number>).signal.aborted);
		});

		it('should provide utils', async () => {
			const { utils } = Futurable.withResolvers<number>();

			assert.ok(utils.signal);
			assert.ok(typeof utils.cancel === 'function');
			assert.ok(typeof utils.onCancel === 'function');
			assert.ok(typeof utils.delay === 'function');
			assert.ok(typeof utils.sleep === 'function');
			assert.ok(typeof utils.fetch === 'function');
			assert.ok(typeof utils.futurizable === 'function');
		});

		it('should respect external signal', async () => {
			const controller = new AbortController();
			const { promise } = Futurable.withResolvers<number>(controller.signal);

			controller.abort();

			assert.ok((promise as Futurable<number>).signal.aborted);
		});
	});

	describe('Symbol.species', () => {
		it('should return Futurable class', () => {
			assert.strictEqual(Futurable[Symbol.species], Futurable);
		});
	});

	describe('Symbol.toStringTag', () => {
		it('should return "Futurable"', () => {
			const f = new Futurable(res => res(1));
			assert.strictEqual(f[Symbol.toStringTag], 'Futurable');
		});
	});

	describe('Edge cases and error handling', () => {
		it('should handle synchronous executor', async () => {
			const result = await new Futurable<number>(resolve => {
				resolve(42);
			});
			assert.strictEqual(result, 42);
		});

		it('should handle executor throwing error', async () => {
			await assert.rejects(
				new Futurable(() => {
					throw new Error('executor error');
				}),
				/executor error/
			);
		});

		it('should handle utils functions with cancelled signal', async () => {
			const f = new Futurable<number>((resolve, reject, utils) => {
				utils.cancel();
				utils.sleep(100).then(() => resolve(1));
			});

			await new Promise(r => setTimeout(r, 150));
			assert.ok(f.signal.aborted);
		});

		it('should clear multiple timeouts on cancel', async () => {
			const f = new Futurable<number>((resolve, reject, utils) => {
				utils.sleep(100);
				utils.sleep(200);
				utils.delay(() => 1, 300).then(resolve);
			});

			f.cancel();
			await new Promise(r => setTimeout(r, 350));
			// Should complete without hanging
		});
	});
});
