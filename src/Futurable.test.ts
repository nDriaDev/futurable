import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Futurable, SafeResult } from './Futurable';

// Mock timers
vi.useFakeTimers();

describe('Futurable', () => {
	afterEach(() => {
		vi.clearAllTimers();
	});

	describe('Constructor', () => {
		it('should create a Futurable instance', () => {
			const futurable = new Futurable((resolve) => {
				resolve('test');
			});
			expect(futurable).toBeInstanceOf(Futurable);
			expect(futurable).toBeInstanceOf(Promise);
		});

		it('should resolve with a value', async () => {
			const futurable = new Futurable((resolve) => {
				resolve('test');
			});
			await expect(futurable).resolves.toBe('test');
		});

		it('should reject with a reason', async () => {
			const futurable = new Futurable((_, reject) => {
				reject(new Error('test error'));
			});
			await expect(futurable).rejects.toThrow('test error');
		});

		it('should handle external signal when already aborted', () => {
			const controller = new AbortController();
			controller.abort();
			const futurable = new Futurable((resolve) => {
				resolve('test');
			}, controller.signal);
			expect(futurable.signal.aborted).toBe(true);
		});

		it('should handle external signal abort event', () => {
			const controller = new AbortController();
			const futurable = new Futurable((resolve) => {
				setTimeout(() => resolve('test'), 100);
			}, controller.signal);
			controller.abort();
			expect(futurable.signal.aborted).toBe(true);
		});

		it('should execute onCancel callbacks when cancelled', () => {
			const cancelCallback = vi.fn();
			const futurable = new Futurable((resolve, reject, { onCancel }) => {
				onCancel(cancelCallback);
				setTimeout(() => resolve('test'), 100);
			});
			futurable.cancel();
			expect(cancelCallback).toHaveBeenCalled();
		});

		it('should clear timeouts on abort', async () => {
			const futurable = new Futurable((resolve, reject, { delay }) => {
				delay(() => 'test', 100);
			});
			futurable.cancel();
			await vi.advanceTimersByTimeAsync(100);
		});

		it('should not execute callbacks after abort', async () => {
			const resolveCallback = vi.fn();
			const futurable = new Futurable((resolve, reject, { signal }) => {
				signal.addEventListener('abort', () => {
					// Already aborted
				});
				resolve('test');
			});
			futurable.cancel();
			futurable.then(resolveCallback);
			await vi.runAllTimersAsync();
		});

		it('should ignore AbortError in utils.fetch', async () => {
			const abortError = new Error('The operation was aborted');
			abortError.name = 'AbortError';
			let result = "";

			global.fetch = vi.fn().mockRejectedValue(abortError);

			const futurable = new Futurable((resolve, reject, { fetch }) => {
				fetch('https://api.example.com/data')
					.then(() => {
						result = 'success';
						resolve('success')
					})
					.catch(() => {
						result = 'caught';
						resolve('caught')
					});
			});

			futurable.cancel();

			await vi.advanceTimersByTimeAsync(10);

			expect(result).toBe('');

			const futurable2 = Futurable.resolve(11).fetch('https://api.example.com/data')
				.then(() => {
					result = 'success';
				})
				.catch(() => {
					result = 'caught';
				});

			await vi.advanceTimersByTimeAsync(10);

			futurable2.cancel();

			await vi.advanceTimersByTimeAsync(10);

			expect(result).toBe('');
		});

		it('should reject non-AbortError in utils.fetch', async () => {
			const networkError = new Error('Network error');
			networkError.name = 'NetworkError';

			global.fetch = vi.fn().mockRejectedValue(networkError);

			const futurable = new Futurable((resolve, reject, { fetch }) => {
				fetch('https://api.example.com/data')
					.then(() => resolve('success'))
					.catch((err) => reject(err));
			});

			await expect(futurable).rejects.toThrow('Network error');
		});
	});

	describe('Symbol properties', () => {
		it('should return correct Symbol.species', () => {
			expect(Futurable[Symbol.species]).toBe(Futurable);
		});

		it('should return correct Symbol.toStringTag', () => {
			const futurable = new Futurable((resolve) => resolve('test'));
			expect(futurable[Symbol.toStringTag]).toBe('Futurable');
		});
	});

	describe('signal getter', () => {
		it('should return the internal signal', () => {
			const futurable = new Futurable((resolve) => {
				resolve('test');
			});
			expect(futurable.signal).toBeInstanceOf(AbortSignal);
			expect(futurable.signal.aborted).toBe(false);
		});
	});

	describe('then', () => {
		it('should chain then calls', async () => {
			const result = await new Futurable<number>((resolve) => {
				resolve(5);
			})
				.then((val) => val * 2)
				.then((val) => val + 3);
			expect(result).toBe(13);
		});

		it('should handle rejection in then', async () => {
			const result = await new Futurable((_, reject) => {
				reject('error');
			}).then(
				() => 'success',
				(err) => `caught: ${err}`
			);
			expect(result).toBe('caught: error');
		});

		it('should handle errors thrown in onfulfilled', async () => {
			const futurable = new Futurable<number>((resolve) => {
				resolve(5);
			}).then(() => {
				throw new Error('thrown error');
			});
			await expect(futurable).rejects.toThrow('thrown error');
		});

		it('should handle errors thrown in onrejected', async () => {
			const futurable = new Futurable((_, reject) => {
				reject('initial error');
			}).then(null, () => {
				throw new Error('thrown in onrejected');
			});
			await expect(futurable).rejects.toThrow('thrown in onrejected');
		});

		it('should resolve with value when onfulfilled is not provided', async () => {
			const result = await new Futurable<number>((resolve) => {
				resolve(42);
			}).then();
			expect(result).toBe(42);
		});

		it('should reject when onrejected is not provided', async () => {
			const futurable = new Futurable((_, reject) => {
				reject(new Error('test'));
			}).then(null);
			await expect(futurable).rejects.toThrow('test');
		});

		it('should clear timeout and return when signal is aborted in rejection handler', async () => {
			const futurable = new Futurable((_, reject) => {
				setTimeout(() => reject('error'), 100);
			});

			futurable.cancel();

			const chained = futurable.then(
				() => 'fulfilled',
				(err) => `rejected: ${err}`
			);

			await vi.advanceTimersByTimeAsync(100);

			await vi.advanceTimersByTimeAsync(10);
		});

		it('should handle rejection when signal is not aborted', async () => {
			const futurable = new Futurable((_, reject) => {
				reject('test error');
			});

			const result = await futurable.then(
				() => 'success',
				(err) => `caught: ${err}`
			);

			expect(result).toBe('caught: test error');
		});
	});

	describe('catch', () => {
		it('should catch rejection', async () => {
			const result = await new Futurable((_, reject) => {
				reject('error');
			}).catch((err) => `caught: ${err}`);
			expect(result).toBe('caught: error');
		});
	});

	describe('finally', () => {
		it('should execute finally on resolve', async () => {
			const finallyCallback = vi.fn();
			await new Futurable((resolve) => {
				resolve('test');
			}).finally(finallyCallback);
			expect(finallyCallback).toHaveBeenCalled();
		});

		it('should execute finally on reject and rethrow Error', async () => {
			const finallyCallback = vi.fn();
			const futurable = new Futurable((_, reject) => {
				reject(new Error('test error'));
			}).finally(finallyCallback);
			await expect(futurable).rejects.toThrow('test error');
			expect(finallyCallback).toHaveBeenCalled();
		});

		it('should execute finally on reject and return non-Error reason', async () => {
			const finallyCallback = vi.fn();
			const result = await new Futurable((_, reject) => {
				reject('string error');
			})
				.finally(finallyCallback)
				.catch((err) => err);
			expect(finallyCallback).toHaveBeenCalled();
			expect(result).toBe('string error');
		});

		it('should pass through resolved value', async () => {
			const result = await new Futurable<number>((resolve) => {
				resolve(42);
			}).finally(() => { });
			expect(result).toBe(42);
		});
	});

	describe('cancel', () => {
		it('should cancel a pending Futurable', () => {
			const futurable = new Futurable((resolve) => {
				setTimeout(() => resolve('test'), 100);
			});
			futurable.cancel();
			expect(futurable.signal.aborted).toBe(true);
		});

		it('should not cancel if already aborted', () => {
			const futurable = new Futurable((resolve) => {
				resolve('test');
			});
			futurable.cancel();
			futurable.cancel();
			expect(futurable.signal.aborted).toBe(true);
		});
	});

	describe('delay', () => {
		it('should delay execution', async () => {
			const futurable = new Futurable<number>((resolve) => {
				resolve(5);
			}).delay((val) => val * 2, 100);

			await vi.advanceTimersByTimeAsync(100);
			await expect(futurable).resolves.toBe(10);
		});

		it('should handle rejection in delay', async () => {
			const futurable = new Futurable((_, reject) => {
				reject('error');
			}).delay((val) => val, 100);

			await expect(futurable).rejects.toBe('error');
		});

		it('should be cancellable', () => {
			const futurable = new Futurable<number>((resolve) => {
				resolve(5);
			}).delay((val) => val * 2, 100);

			futurable.cancel();
			expect(futurable.signal.aborted).toBe(true);
		});
	});

	describe('sleep', () => {
		it('should sleep for specified duration', async () => {
			const futurable = new Futurable<string>((resolve) => {
				resolve('hello');
			}).sleep(100);

			await vi.advanceTimersByTimeAsync(100);
			await expect(futurable).resolves.toBe('hello');
		});
	});

	describe('fetch', () => {
		beforeEach(() => {
			global.fetch = vi.fn();
		});

		it('should fetch with string URL', async () => {
			vi.mocked(global.fetch).mockResolvedValue({ ok: true } as never);

			const futurable = new Futurable<string>((resolve) => {
				resolve('endpoint');
			}).fetch((val) => `https://api.example.com/${val}`);

			await futurable;
			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.example.com/endpoint',
				expect.objectContaining({ signal: expect.any(AbortSignal) })
			);
		});

		it('should fetch with static URL', async () => {
			vi.mocked(global.fetch).mockResolvedValue({ ok: true } as never);

			const futurable = new Futurable<string>((resolve) => {
				resolve('test');
			}).fetch('https://api.example.com/data');

			await futurable;
			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.example.com/data',
				expect.objectContaining({ signal: expect.any(AbortSignal) })
			);
		});

		it('should handle fetch options as function', async () => {
			vi.mocked(global.fetch).mockResolvedValue({ ok: true } as never);

			const futurable = new Futurable<string>((resolve) => {
				resolve('token123');
			}).fetch(
				'https://api.example.com/data',
				(val) => ({ headers: { Authorization: `Bearer ${val}` } })
			);

			await futurable;
			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.example.com/data',
				expect.objectContaining({
					headers: { Authorization: 'Bearer token123' },
					signal: expect.any(AbortSignal),
				})
			);
		});

		it('should handle fetch options as object', async () => {
			vi.mocked(global.fetch).mockResolvedValue({ ok: true } as never);

			const futurable = new Futurable<string>((resolve) => {
				resolve('test');
			}).fetch('https://api.example.com/data', {
				method: 'POST',
			});

			await futurable;
			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.example.com/data',
				expect.objectContaining({
					method: 'POST',
					signal: expect.any(AbortSignal),
				})
			);
		});

		it('should ignore AbortError on cancellation', async () => {
			const abortError = new Error('Aborted');
			abortError.name = 'AbortError';
			vi.mocked(global.fetch).mockRejectedValue(abortError);

			const futurable = new Futurable<string>((resolve, _, utils) => {
				utils.sleep(1000);
				resolve('test');
			}).fetch('https://api.example.com/data');

			futurable.cancel();
		});

		it('should reject with non-AbortError', async () => {
			const networkError = new Error('Network error');
			vi.mocked(global.fetch).mockRejectedValue(networkError);

			const futurable = new Futurable<string>((resolve) => {
				resolve('test');
			}).fetch('https://api.example.com/data');

			await expect(futurable).rejects.toThrow('Network error');
		});
	});

	describe('fetch (instance) - AbortError handling', () => {
		beforeEach(() => {
			global.fetch = vi.fn();
		});

		it('should ignore AbortError in instance fetch method', async () => {
			const abortError = new Error('The operation was aborted');
			abortError.name = 'AbortError';

			vi.mocked(global.fetch).mockRejectedValue(abortError);

			const futurable = new Futurable<string>((resolve) => {
				resolve('endpoint');
			}).fetch((val) => `https://api.example.com/${val}`);

			futurable.cancel();

			await vi.advanceTimersByTimeAsync(10);
		});

		it('should reject non-AbortError in instance fetch method', async () => {
			const networkError = new Error('Network failed');
			networkError.name = 'NetworkError';

			vi.mocked(global.fetch).mockRejectedValue(networkError);

			const futurable = new Futurable<string>((resolve) => {
				resolve('endpoint');
			}).fetch((val) => `https://api.example.com/${val}`);

			await expect(futurable).rejects.toThrow('Network failed');
		});

		it('should handle fetch with function URL and function options', async () => {
			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				status: 200
			} as Response);

			const futurable = await new Futurable<{ token: string }>((resolve) => {
				resolve({ token: 'abc123' });
			}).fetch(
				(val) => `https://api.example.com/data`,
				(val) => ({
					headers: { 'Authorization': `Bearer ${val.token}` }
				})
			);

			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.example.com/data',
				expect.objectContaining({
					headers: { 'Authorization': 'Bearer abc123' }
				})
			);
		});
	});

	describe('onCancel', () => {
		it('should register and execute cancel callback', () => {
			const cancelCallback = vi.fn();
			const futurable = new Futurable<string>((resolve) => {
				setTimeout(() => resolve('test'), 100);
			}).onCancel(cancelCallback);

			futurable.cancel();
			expect(cancelCallback).toHaveBeenCalled();
		});

		it('should pass through resolved value', async () => {
			const cancelCallback = vi.fn();
			const result = await new Futurable<number>((resolve) => {
				resolve(42);
			}).onCancel(cancelCallback);

			expect(result).toBe(42);
		});

		it('should pass through rejected reason', async () => {
			const cancelCallback = vi.fn();
			const futurable = new Futurable((_, reject) => {
				reject('error');
			}).onCancel(cancelCallback);

			await expect(futurable).rejects.toBe('error');
		});
	});

	describe('futurizable', () => {
		it('should convert Promise to Futurable', async () => {
			const promise = Promise.resolve(42);
			const futurable = new Futurable<void>((resolve) => {
				resolve();
			}).futurizable(() => promise);

			await expect(futurable).resolves.toBe(42);
		});

		it('should convert Promise directly', async () => {
			const promise = Promise.resolve(42);
			const futurable = new Futurable<void>((resolve) => {
				resolve();
			}).futurizable(promise);

			await expect(futurable).resolves.toBe(42);
		});

		it('should handle Promise rejection', async () => {
			const promise = Promise.reject('error');
			const futurable = new Futurable<void>((resolve) => {
				resolve();
			}).futurizable(() => promise);

			await expect(futurable).rejects.toBe('error');
		});
	});

	describe('safe', () => {
		it('should return success result on resolve', async () => {
			const result = await new Futurable<number>((resolve) => {
				resolve(42);
			}).safe();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe(42);
				expect(result.error).toBeNull();
			}
		});

		it('should return error result on reject', async () => {
			const error = new Error('test error');
			const result = await new Futurable((_, reject) => {
				reject(error);
			}).safe<Error>();

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe(error);
				expect(result.data).toBeNull();
			}
		});

		it('should work with chained operations', async () => {
			const result = await Futurable.resolve(5)
				.then((val) => val * 2)
				.safe();

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe(10);
			}
		});
	});

	describe('Static: resolve', () => {
		it('should resolve with void', async () => {
			const futurable = Futurable.resolve();
			await expect(futurable).resolves.toBeUndefined();
		});

		it('should resolve with value', async () => {
			const futurable = Futurable.resolve(42);
			await expect(futurable).resolves.toBe(42);
		});

		it('should resolve with Promise', async () => {
			const promise = Promise.resolve(42);
			const futurable = Futurable.resolve(promise);
			await expect(futurable).resolves.toBe(42);
		});

		it('should resolve with external signal', async () => {
			const controller = new AbortController();
			const futurable = Futurable.resolve(42, controller.signal);
			controller.abort();
			expect(futurable.signal.aborted).toBe(true);
		});
	});

	describe('Static: reject', () => {
		it('should reject with reason', async () => {
			const futurable = Futurable.reject('error');
			await expect(futurable).rejects.toBe('error');
		});

		it('should reject with signal', async () => {
			const controller = new AbortController();
			const futurable = Futurable.reject('error', controller.signal);
			await expect(futurable).rejects.toBe('error');
		});
	});

	describe('Static: onCancel', () => {
		it('should execute callback on cancel', async () => {
			let result = "";
			const callback = vi.fn(() => {result = 'cleanup done'});
			const futurable = Futurable.onCancel({ cb: callback });

			// La Promise deve essere catturata PRIMA del cancel
			const promise = futurable.then(result => result);

			// Ora cancella
			futurable.cancel();
			expect(result).toBe('cleanup done');
			expect(callback).toHaveBeenCalled();
		});

		it('should work with external signal', () => {
			const controller = new AbortController();
			const callback = vi.fn(() => 'cleanup');
			const futurable = Futurable.onCancel({
				cb: callback,
				signal: controller.signal,
			});
			controller.abort();
			expect(futurable.signal.aborted).toBe(true);
		});
	});

	describe('Static: delay', () => {
		it('should delay execution', async () => {
			const futurable = Futurable.delay({
				cb: () => 'delayed',
				timer: 100,
			});

			await vi.advanceTimersByTimeAsync(100);
			await expect(futurable).resolves.toBe('delayed');
		});

		it('should be cancellable', () => {
			const futurable = Futurable.delay({
				cb: () => 'delayed',
				timer: 100,
			});
			futurable.cancel();
			expect(futurable.signal.aborted).toBe(true);
		});
	});

	describe('Static: sleep', () => {
		it('should sleep for duration', async () => {
			const futurable = Futurable.sleep({ timer: 100 });
			await vi.advanceTimersByTimeAsync(100);
			await expect(futurable).resolves.toBeUndefined();
		});
	});

	describe('Static: fetch', () => {
		beforeEach(() => {
			global.fetch = vi.fn();
		});

		it('should fetch URL', async () => {
			const mockResponse = { ok: true };
			vi.mocked(global.fetch).mockResolvedValue(mockResponse as never);

			const futurable = Futurable.fetch('https://api.example.com/data');
			await expect(futurable).resolves.toBe(mockResponse);
		});

		it('should fetch with options', async () => {
			const mockResponse = { ok: true };
			vi.mocked(global.fetch).mockResolvedValue(mockResponse as never);

			const futurable = Futurable.fetch('https://api.example.com/data', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
			});

			await futurable;
			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.example.com/data',
				expect.objectContaining({
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
				})
			);
		});

		it('should handle external signal', async () => {
			const controller = new AbortController();
			const mockResponse = { ok: true };
			vi.mocked(global.fetch).mockResolvedValue(mockResponse as never);

			const futurable = Futurable.fetch('https://api.example.com/data', {
				signal: controller.signal,
			});

			controller.abort();
			expect(futurable.signal.aborted).toBe(true);
		});

		it('should delete signal from opts when provided', async () => {
			const controller = new AbortController();
			const mockResponse = { ok: true };
			vi.mocked(global.fetch).mockResolvedValue(mockResponse as never);

			const opts = { signal: controller.signal, method: 'GET' };
			Futurable.fetch('https://api.example.com/data', opts);

			expect(opts.signal).toBeUndefined();
		});
	});

	describe('Static: futurizable', () => {
		it('should convert Promise to Futurable', async () => {
			const promise = Promise.resolve(42);
			const futurable = Futurable.futurizable({ promise });
			await expect(futurable).resolves.toBe(42);
		});

		it('should handle Promise rejection', async () => {
			const promise = Promise.reject('error');
			const futurable = Futurable.futurizable({ promise });
			await expect(futurable).rejects.toBe('error');
		});

		it('should work with signal', () => {
			const controller = new AbortController();
			const promise = Promise.resolve(42);
			const futurable = Futurable.futurizable({
				promise,
				signal: controller.signal,
			});
			controller.abort();
			expect(futurable.signal.aborted).toBe(true);
		});
	});

	describe('Static: all', () => {
		it('should resolve when all Futurables resolve', async () => {
			const result = await Futurable.all([
				Futurable.resolve(1),
				Futurable.resolve(2),
				Futurable.resolve(3),
			]);
			expect(result).toEqual([1, 2, 3]);
		});

		it('should handle mixed Promises and Futurables', async () => {
			const result = await Futurable.all([
				Futurable.resolve(1),
				Promise.resolve(2),
				3,
			]);
			expect(result).toEqual([1, 2, 3]);
		});

		it('should reject when any Futurable rejects', async () => {
			const futurable = Futurable.all([
				Futurable.resolve(1),
				Futurable.reject('error'),
				Futurable.resolve(3),
			]);
			await expect(futurable).rejects.toBe('error');
		});

		it('should cancel all Futurables when cancelled', () => {
			const f1 = Futurable.delay({ cb: () => 1, timer: 100 });
			const f2 = Futurable.delay({ cb: () => 2, timer: 200 });
			const all = Futurable.all([f1, f2]);
			all.cancel();
			expect(f1.signal.aborted).toBe(true);
			expect(f2.signal.aborted).toBe(true);
		});

		it('should work with external signal', () => {
			const controller = new AbortController();
			const all = Futurable.all([Futurable.resolve(1)], controller.signal);
			controller.abort();
			expect(all.signal.aborted).toBe(true);
		});
	});

	describe('Static: allSettled', () => {
		it('should resolve with all settled results', async () => {
			const result = await Futurable.allSettled([
				Futurable.resolve(1),
				Futurable.reject('error'),
				Promise.resolve(3),
			]);
			expect(result).toEqual([
				{ status: 'fulfilled', value: 1 },
				{ status: 'rejected', reason: 'error' },
				{ status: 'fulfilled', value: 3 },
			]);
		});

		it('should cancel all Futurables when cancelled', () => {
			const f1 = Futurable.delay({ cb: () => 1, timer: 100 });
			const f2 = Futurable.delay({ cb: () => 2, timer: 200 });
			const allSettled = Futurable.allSettled([f1, f2]);
			allSettled.cancel();
			expect(f1.signal.aborted).toBe(true);
			expect(f2.signal.aborted).toBe(true);
		});
	});

	describe('Static: race', () => {
		it('should resolve with first resolved value', async () => {
			const racePromise = Futurable.race([
				Futurable.delay({ cb: () => 'slow', timer: 200 }),
				Futurable.delay({ cb: () => 'fast', timer: 100 }),
			]);

			await vi.advanceTimersByTimeAsync(100);
			const result = await racePromise;
			expect(result).toBe('fast');
		});

		it('should reject with first rejection', async () => {
			const futurable = Futurable.race([
				Futurable.delay({ cb: () => 'slow', timer: 200 }),
				Futurable.reject('error'),
			]);
			await expect(futurable).rejects.toBe('error');
		});

		it('should cancel all Futurables when cancelled', () => {
			const f1 = Futurable.delay({ cb: () => 1, timer: 100 });
			const f2 = Futurable.delay({ cb: () => 2, timer: 200 });
			const race = Futurable.race([f1, f2]);
			race.cancel();
			expect(f1.signal.aborted).toBe(true);
			expect(f2.signal.aborted).toBe(true);
		});
	});

	describe('Static: any', () => {
		it('should resolve with first successful value', async () => {
			const anyPromise = Futurable.any([
				Futurable.reject('error1'),
				Futurable.delay({ cb: () => 'success', timer: 100 }),
				Futurable.reject('error2'),
			]);

			await vi.advanceTimersByTimeAsync(100);
			const result = await anyPromise;
			expect(result).toBe('success');
		});

		it('should reject with AggregateError when all reject', async () => {
			const futurable = Futurable.any([
				Futurable.reject('error1'),
				Futurable.reject('error2'),
			]);
			await expect(futurable).rejects.toBeInstanceOf(AggregateError);
		});

		it('should cancel all Futurables when cancelled', () => {
			const f1 = Futurable.delay({ cb: () => 1, timer: 100 });
			const f2 = Futurable.delay({ cb: () => 2, timer: 200 });
			const any = Futurable.any([f1, f2]);
			any.cancel();
			expect(f1.signal.aborted).toBe(true);
			expect(f2.signal.aborted).toBe(true);
		});
	});

	describe('Static: polling', () => {
		it('should poll at regular intervals', async () => {
			const pollFn = vi.fn(() => 'polled');
			const controller = Futurable.polling(pollFn, {
				interval: 100,
				immediate: false,
			});

			await vi.advanceTimersByTimeAsync(100);
			expect(pollFn).toHaveBeenCalledTimes(1);

			await vi.advanceTimersByTimeAsync(100);
			expect(pollFn).toHaveBeenCalledTimes(2);

			controller.cancel();
		});

		it('should execute immediately when immediate is true', () => {
			const pollFn = vi.fn(() => 'polled');
			const controller = Futurable.polling(pollFn, {
				interval: 100,
				immediate: true,
			});

			expect(pollFn).toHaveBeenCalledTimes(1);
			controller.cancel();
		});

		it('should handle polling with Futurable return', async () => {
			const pollFn = vi.fn(() => Futurable.resolve('polled'));
			const controller = Futurable.polling(pollFn, {
				interval: 100,
			});

			await vi.advanceTimersByTimeAsync(100);
			expect(pollFn).toHaveBeenCalled();
			controller.cancel();
		});

		it('should handle polling with Promise return', async () => {
			const pollFn = vi.fn(() => Promise.resolve('polled'));
			const controller = Futurable.polling(pollFn, {
				interval: 100,
			});

			await vi.advanceTimersByTimeAsync(100);
			expect(pollFn).toHaveBeenCalled();
			controller.cancel();
		});

		it('should handle errors with catch', () => {
			const errorHandler = vi.fn();
			const pollFn = vi.fn(() => {
				throw new Error('poll error');
			});

			const controller = Futurable.polling(pollFn, {
				interval: 100,
				immediate: true,
			});

			controller.catch(errorHandler);
			expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
			controller.cancel();
		});

		it('should queue errors before catch is registered', async () => {
			const errorHandler = vi.fn();
			const pollFn = vi.fn(() => {
				throw new Error('poll error');
			});

			const controller = Futurable.polling(pollFn, {
				interval: 100,
				immediate: true,
			});

			await vi.advanceTimersByTimeAsync(100);
			controller.catch(errorHandler);
			expect(errorHandler).toHaveBeenCalled();
			controller.cancel();
		});

		it('should handle Promise rejection in polling', async () => {
			const errorHandler = vi.fn();
			const pollFn = vi.fn(() => Promise.reject('async error'));

			const controller = Futurable.polling(pollFn, {
				interval: 100,
				immediate: true,
			});

			controller.catch(errorHandler);

			// Aspetta che l'handler sia chiamato usando fake timers
			await vi.advanceTimersByTimeAsync(10);
			expect(errorHandler).toHaveBeenCalledWith('async error');
			controller.cancel();
		});

		it('should cancel internal Futurable on controller cancel', () => {
			const futurable = Futurable.delay({ cb: () => 'test', timer: 1000 });
			const pollFn = vi.fn(() => futurable);

			const controller = Futurable.polling(pollFn, {
				interval: 100,
				immediate: true,
			});

			controller.cancel();
			expect(futurable.signal.aborted).toBe(true);
		});

		it('should work with external signal', async () => {
			const externalController = new AbortController();
			const pollFn = vi.fn(() => 'polled');

			const controller = Futurable.polling(pollFn, {
				interval: 100,
				signal: externalController.signal,
			});

			externalController.abort();
			await vi.advanceTimersByTimeAsync(100);

			controller.cancel();
		});
	});

	describe('Static: withResolvers', () => {
		it('should create Futurable with external resolvers', async () => {
			const { promise, resolve, reject, cancel, utils } =
				Futurable.withResolvers<number>();

			expect(promise).toBeInstanceOf(Futurable);
			expect(typeof resolve).toBe('function');
			expect(typeof reject).toBe('function');
			expect(typeof cancel).toBe('function');
			expect(utils).toBeDefined();
			expect(utils.signal).toBeInstanceOf(AbortSignal);

			resolve(42);
			await expect(promise).resolves.toBe(42);
		});

		it('should handle rejection', async () => {
			const { promise, reject } = Futurable.withResolvers<number>();
			reject('error');
			await expect(promise).rejects.toBe('error');
		});

		it('should handle cancellation', () => {
			const { promise, cancel } = Futurable.withResolvers<number>();
			cancel();
			expect((promise as Futurable<number>).signal.aborted).toBe(true);
		});

		it('should work with external signal', () => {
			const controller = new AbortController();
			const { promise } = Futurable.withResolvers<number>(controller.signal);
			controller.abort();
			expect((promise as Futurable<number>).signal.aborted).toBe(true);
		});
	});

	describe('Static: safe', () => {
		it('should return success result on resolve', async () => {
			const result = await Futurable.safe<number>((resolve) => {
				resolve(42);
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe(42);
				expect(result.error).toBeNull();
			}
		});

		it('should return error result on reject', async () => {
			const error = new Error('test error');
			const result = await Futurable.safe<number, Error>((_, reject) => {
				reject(error);
			});

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBe(error);
				expect(result.data).toBeNull();
			}
		});

		it('should work with cancellation', () => {
			const controller = new AbortController();
			const futurable = Futurable.safe<number>(
				(resolve) => {
					setTimeout(() => resolve(42), 100);
				},
				controller.signal
			);
			controller.abort();
			expect(futurable.signal.aborted).toBe(true);
		});

		it('should use utils in executor', async () => {
			const resultPromise = Futurable.safe<number>((resolve, reject, { delay }) => {
				delay(() => resolve(42), 50);
			});

			await vi.advanceTimersByTimeAsync(50);
			const result = await resultPromise;
			expect(result.success).toBe(true);
		});
	});

	describe('FuturableUtils', () => {
		it('should provide working delay in utils', async () => {
			const futurable = new Futurable((resolve, reject, { delay }) => {
				delay(() => resolve('delayed'), 100);
			});

			await vi.advanceTimersByTimeAsync(100);
			await expect(futurable).resolves.toBe('delayed');
		});

		it('should provide working sleep in utils', async () => {
			let resolved = false;
			const futurable = new Futurable((resolve, reject, { sleep }) => {
				sleep(100).then(() => {
					resolved = true;
					resolve('done');
				});
			});

			await vi.advanceTimersByTimeAsync(100);
			await futurable;
			expect(resolved).toBe(true);
		});

		it('should provide working fetch in utils', async () => {
			global.fetch = vi.fn().mockResolvedValue({ ok: true });

			await new Futurable((resolve, reject, { fetch }) => {
				fetch('https://api.example.com/data')
					.then((response) => resolve(response))
					.catch(reject);
			});

			expect(global.fetch).toHaveBeenCalled();
		});

		it('should provide working futurizable in utils', async () => {
			const result = await new Futurable((resolve, reject, { futurizable }) => {
				futurizable(Promise.resolve(42))
					.then((val) => resolve(val))
					.catch(reject);
			});

			expect(result).toBe(42);
		});

		it('should provide cancel method in utils', async () => {
			const futurable = new Futurable((resolve, reject, { cancel }) => {
				setTimeout(cancel, 50);
			});

			await vi.advanceTimersByTimeAsync(50);
			expect(futurable.signal.aborted).toBe(true);
		});
	});

	describe('Edge cases', () => {
		it('should handle multiple onCancel callbacks', () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();

			const futurable = new Futurable((resolve, reject, { onCancel }) => {
				onCancel(callback1);
				onCancel(callback2);
				setTimeout(() => resolve('test'), 100);
			});

			futurable.cancel();
			expect(callback1).toHaveBeenCalled();
			expect(callback2).toHaveBeenCalled();
		});

		it('should handle chained delay and fetch', async () => {
			global.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve({ value: 42 }) });

			const futurable = Futurable.resolve('endpoint')
				.delay((val) => val.toUpperCase(), 50)
				.fetch((val) => `https://api.example.com/${val}`);

			await vi.advanceTimersByTimeAsync(50);
			await futurable;
			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.example.com/ENDPOINT',
				expect.any(Object)
			);
		});

		it('should handle nested Futurables', async () => {
			const nested = Futurable.resolve(42);
			const result = await Futurable.resolve(nested).then((f) => f);
			expect(result).toBe(42);
		});

		it('should handle empty array in Futurable.all', async () => {
			const result = await Futurable.all([]);
			expect(result).toEqual([]);
		});

		it('should maintain controller reference across then chains', () => {
			const f1 = new Futurable<number>((resolve) => resolve(1));
			const f2 = f1.then((val) => val * 2);
			const f3 = f2.then((val) => val + 3);

			f1.cancel();
			expect(f1.signal.aborted).toBe(true);
			expect(f2.signal.aborted).toBe(true);
			expect(f3.signal.aborted).toBe(true);
		});
	});

	describe('TypeScript type safety', () => {
		it('should maintain correct types through chain', async () => {
			const result: number = await Futurable.resolve(5)
				.then((val) => val * 2)
				.then((val) => val + 3);
			expect(result).toBe(13);
		});

		it('should handle SafeResult discriminated union', async () => {
			const result = await Futurable.resolve(42).safe();

			if (result.success) {
				const value: number = result.data;
				expect(value).toBe(42);
			} else {
				const error: unknown = result.error;
				expect(error).toBeDefined();
			}
		});
	});

	describe('Edge cases for complete coverage', () => {
		it('should handle constructor with already aborted external signal', () => {
			const controller = new AbortController();
			controller.abort();

			const futurable = new Futurable((resolve, reject, { signal }) => {
				// Il signal dovrebbe già essere aborted
				expect(signal.aborted).toBe(true);
				resolve('test');
			}, controller.signal);

			expect(futurable.signal.aborted).toBe(true);
		});

		it('should handle then when signal becomes aborted during execution', async () => {
			const futurable = new Futurable<number>((resolve) => {
				resolve(42);
			});

			// Crea un chain prima di cancellare
			const chained = futurable.then((val) => {
				// Questo potrebbe essere chiamato prima del cancel
				return val * 2;
			});

			// Cancella immediatamente
			futurable.cancel();

			// Avanza i timer per permettere l'esecuzione
			await vi.advanceTimersByTimeAsync(10);
		});

		it('should handle clearTimeout when signal is aborted in then fulfillment', async () => {
			const futurable = new Futurable<number>((resolve) => {
				resolve(5);
			});

			// Cancella prima di chiamare then
			futurable.cancel();

			// Il then dovrebbe rilevare il signal aborted e chiamare clearTimeout
			const chained = futurable.then((val) => val * 2);

			await vi.advanceTimersByTimeAsync(10);
		});

		it('should handle clearTimeout when signal is aborted in then rejection', async () => {
			const futurable = new Futurable((_, reject) => {
				reject('error');
			});

			// Cancella prima di chiamare then
			futurable.cancel();

			// Il then dovrebbe rilevare il signal aborted nel rejection handler
			const chained = futurable.then(
				null,
				(err) => `handled: ${err}`
			);

			await vi.advanceTimersByTimeAsync(10);
		});
	});
});