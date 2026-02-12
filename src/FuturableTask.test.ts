import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { FuturableTask } from './FuturableTask';
import { Futurable } from '.';

// Type-safe fetch mock for Jest 29.7.0
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('FuturableTask', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.clearAllTimers();
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe('Constructor and Basic Properties', () => {
		test('should create a task with executor', async () => {
			const task = new FuturableTask<number>((res) => res(42));
			const result = await task.run();
			expect(result).toBe(42);
		});

		test('should expose internal signal', () => {
			const task = new FuturableTask<number>((res) => res(42));
			expect(task.signal).toBeInstanceOf(AbortSignal);
			expect(task.signal.aborted).toBe(false);
		});

		test('should link external signal on construction', async () => {
			const controller = new AbortController();
			const task = new FuturableTask<number>((res) => res(42), controller.signal);

			controller.abort();
			expect(task.signal.aborted).toBe(true);
		});

		test('should handle already aborted external signal', async () => {
			const controller = new AbortController();
			controller.abort();

			const task = new FuturableTask<number>((res) => res(42), controller.signal);
			expect(task.signal.aborted).toBe(true);
		});
	});

	describe('cancel()', () => {
		test('should cancel a pending task', () => {
			const task = new FuturableTask<number>((res) => {
				setTimeout(() => res(42), 1000);
			});

			expect(task.signal.aborted).toBe(false);
			task.cancel();
			expect(task.signal.aborted).toBe(true);
		});

		test('should be idempotent', () => {
			const task = new FuturableTask<number>((res) => res(42));

			task.cancel();
			task.cancel();
			task.cancel();

			expect(task.signal.aborted).toBe(true);
		});

		test('should trigger onCancel callbacks', () => {
			const callback = jest.fn();
			const task = new FuturableTask<number>((res) => res(42));

			task.onCancel(callback);
			task.cancel();

			expect(callback).toHaveBeenCalledTimes(1);
		});

		test('should trigger multiple onCancel callbacks in order', () => {
			const calls: number[] = [];
			const task = new FuturableTask<number>((res) => res(42));

			task.onCancel(() => calls.push(1));
			task.onCancel(() => calls.push(2));
			task.onCancel(() => calls.push(3));

			task.cancel();

			expect(calls).toEqual([1, 2, 3]);
		});

		test('should not trigger onCancel on second cancel', () => {
			const callback = jest.fn();
			const task = new FuturableTask<number>((res) => res(42));

			task.onCancel(callback);
			task.cancel();
			task.cancel();

			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('onCancel()', () => {
		test('should return this for chaining', () => {
			const task = new FuturableTask<number>((res) => res(42));
			const result = task.onCancel(() => { });

			expect(result).toBe(task);
		});

		test('should register callback even if never run', () => {
			const callback = jest.fn();
			const task = new FuturableTask<number>((res) => res(42));

			task.onCancel(callback);
			task.cancel();

			expect(callback).toHaveBeenCalled();
		});
	});

	describe('run()', () => {
		test('should execute the task', async () => {
			const task = new FuturableTask<number>((res) => res(42));
			const result = await task.run();

			expect(result).toBe(42);
		});

		test('should create independent executions', async () => {
			let counter = 0;
			const task = new FuturableTask<number>((res) => res(++counter));

			const result1 = await task.run();
			const result2 = await task.run();

			expect(result1).toBe(1);
			expect(result2).toBe(2);
		});

		test('should handle rejection', async () => {
			const task = new FuturableTask<number>((_, rej) => rej(new Error('fail')));

			await expect(task.run()).rejects.toThrow('fail');
		});

		test('should cancel all runs when task is cancelled', async () => {
			const task = new FuturableTask<number>((res) => {
				setTimeout(() => res(42), 1000);
			});

			const run1 = task.run();
			const run2 = task.run();

			task.cancel();

			jest.advanceTimersByTime(2000);

			// Both should be pending (never resolve)
			const isPending1 = await Promise.race([
				run1.then(() => false),
				Promise.resolve(true)
			]);
			const isPending2 = await Promise.race([
				run2.then(() => false),
				Promise.resolve(true)
			]);

			expect(isPending1).toBe(true);
			expect(isPending2).toBe(true);
		});

		test('should accept override signal', async () => {
			const task = new FuturableTask<number>((res) => {
				setTimeout(() => res(42), 1000);
			});

			const controller = new AbortController();
			const run = task.run(controller.signal);

			controller.abort();

			jest.advanceTimersByTime(2000);

			const isPending = await Promise.race([
				run.then(() => false),
				Promise.resolve(true)
			]);

			expect(isPending).toBe(true);
		});

		test('should handle already aborted override signal', async () => {
			const task = new FuturableTask<number>((res) => {
				setTimeout(() => res(42), 1000);
			});

			const controller = new AbortController();
			controller.abort();

			const run = task.run(controller.signal);

			jest.advanceTimersByTime(2000);

			const isPending = await Promise.race([
				run.then(() => false),
				Promise.resolve(true)
			]);

			expect(isPending).toBe(true);
		});

		test('should return pending futurable when task is already cancelled', async () => {
			const task = new FuturableTask<number>((res) => res(42));
			task.cancel();

			const run = task.run();

			const isPending = await Promise.race([
				run.then(() => false),
				Promise.resolve(true)
			]);

			expect(isPending).toBe(true);
		});
	});

	describe('memoize()', () => {
		test('should cache the first execution', async () => {
			let counter = 0;
			const task = new FuturableTask<number>((res) => res(++counter)).memoize();

			const result1 = await task.run();
			const result2 = await task.run();
			const result3 = await task.run();

			expect(result1).toBe(1);
			expect(result2).toBe(1);
			expect(result3).toBe(1);
		});

		test('should retry on failure by default', async () => {
			let counter = 0;
			const task = new FuturableTask<number>((res, rej) => {
				counter++;
				if (counter === 1) {
					rej(new Error('first fail'));
				} else {
					res(counter);
				}
			}).memoize();

			await expect(task.run()).rejects.toThrow('first fail');
			const result = await task.run();

			expect(result).toBe(2);
		});

		test('should cache errors when catchErrors is true', async () => {
			let counter = 0;
			const task = new FuturableTask<number>((res, rej) => {
				counter++;
				rej(new Error(`fail ${counter}`));
			}).memoize(true);

			await expect(task.run()).rejects.toThrow('fail 1');
			await expect(task.run()).rejects.toThrow('fail 1');

			expect(counter).toBe(1);
		});

		test('should clear cache if cached futurable is aborted', async () => {
			let counter = 0;
			const task = new FuturableTask<number>((res) => {
				setTimeout(() => res(++counter), 100);
			}).memoize();

			const run1 = task.run();
			run1.cancel();

			jest.advanceTimersByTime(200);

			const result = await task.run();
			jest.advanceTimersByTime(200);

			expect(result).toBe(2);
		});
	});

	describe('map()', () => {
		test('should transform the result', async () => {
			const task = FuturableTask.resolve(5).map(x => x * 2);
			const result = await task.run();

			expect(result).toBe(10);
		});

		test('should support async transformations', async () => {
			const task = FuturableTask.resolve(5).map(async x => {
				return x * 2;
			});
			const result = await task.run();

			expect(result).toBe(10);
		});

		test('should pass signal to mapper function', async () => {
			let receivedSignal: AbortSignal | undefined;
			const task = FuturableTask.resolve(5).map((x, signal) => {
				receivedSignal = signal;
				return x * 2;
			});

			await task.run();

			expect(receivedSignal).toBeInstanceOf(AbortSignal);
		});

		test('should propagate errors from mapper', async () => {
			const task = FuturableTask.resolve(5).map(() => {
				throw new Error('map error');
			});

			await expect(task.run()).rejects.toThrow('map error');
		});
	});

	describe('flatMap()', () => {
		test('should chain tasks', async () => {
			const task = FuturableTask.resolve(5)
				.flatMap(x => FuturableTask.resolve(x * 2));

			const result = await task.run();
			expect(result).toBe(10);
		});

		test('should propagate errors from the original task', async () => {
			const task = FuturableTask.reject(new Error('original error'))
				.flatMap(x => FuturableTask.resolve(x));

			await expect(task.run()).rejects.toThrow('original error');
		});

		test('should propagate errors from the chained task', async () => {
			const task = FuturableTask.resolve(5)
				.flatMap(() => FuturableTask.reject(new Error('chained error')));

			await expect(task.run()).rejects.toThrow('chained error');
		});
	});

	describe('andThen()', () => {
		test('should sequence tasks', async () => {
			const results: number[] = [];

			const task1 = FuturableTask.of(() => results.push(1));
			const task2 = FuturableTask.of(() => results.push(2));

			await task1.andThen(task2).run();

			expect(results).toEqual([1, 2]);
		});

		test('should return the second task result', async () => {
			const task1 = FuturableTask.resolve(5);
			const task2 = FuturableTask.resolve(10);

			const result = await task1.andThen(task2).run();

			expect(result).toBe(10);
		});
	});

	describe('tap()', () => {
		test('should execute side effect without modifying value', async () => {
			const sideEffects: number[] = [];

			const result = await FuturableTask.resolve(42)
				.tap(x => sideEffects.push(x))
				.run();

			expect(result).toBe(42);
			expect(sideEffects).toEqual([42]);
		});

		test('should support async side effects', async () => {
			const sideEffects: number[] = [];

			const result = await FuturableTask.resolve(42)
				.tap(async x => {
					await Promise.resolve();
					sideEffects.push(x);
				})
				.run();

			expect(result).toBe(42);
			expect(sideEffects).toEqual([42]);
		});

		test('should propagate errors from side effect', async () => {
			const task = FuturableTask.resolve(42)
				.tap(() => {
					throw new Error('tap error');
				});

			await expect(task.run()).rejects.toThrow('tap error');
		});
	});

	describe('tapError()', () => {
		test('should execute side effect on error', async () => {
			const errors: string[] = [];

			const task = FuturableTask.reject(new Error('fail'))
				.tapError(err => errors.push(err.message));

			await expect(task.run()).rejects.toThrow('fail');
			expect(errors).toEqual(['fail']);
		});

		test('should not execute on success', async () => {
			const errors: string[] = [];

			const result = await FuturableTask.resolve(42)
				.tapError(err => errors.push(err.message))
				.run();

			expect(result).toBe(42);
			expect(errors).toEqual([]);
		});

		test('should propagate original error even if side effect throws', async () => {
			const task = FuturableTask.reject(new Error('original'))
				.tapError(() => {
					throw new Error('side effect error');
				});

			await expect(task.run()).rejects.toThrow('original');
		});

		test('should log side effect errors to console', async () => {
			const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

			const task = FuturableTask.reject<number>(new Error('original'))
				.tapError(() => {
					throw new Error('side effect error');
				});

			await expect(task.run()).rejects.toThrow('original');
			expect(consoleSpy).toHaveBeenCalledWith(
				'tapError callback failed: ',
				expect.any(Error)
			);

			consoleSpy.mockRestore();
		});

		test('should support async side effects', async () => {
			const errors: string[] = [];

			const task = FuturableTask.reject(new Error('fail'))
				.tapError(async err => {
					await Promise.resolve();
					errors.push(err.message);
				});

			await expect(task.run()).rejects.toThrow('fail');
			expect(errors).toEqual(['fail']);
		});
	});

	describe('catchError()', () => {
		test('should recover from error with fallback task', async () => {
			const task = FuturableTask.reject<number>(new Error('fail'))
				.catchError(() => FuturableTask.resolve(42));

			const result = await task.run();
			expect(result).toBe(42);
		});

		test('should pass through on success', async () => {
			const task = FuturableTask.resolve(42)
				.catchError(() => FuturableTask.resolve(99));

			const result = await task.run();
			expect(result).toBe(42);
		});

		test('should allow type transformation', async () => {
			const task: FuturableTask<number | null> = FuturableTask.reject<number>(new Error('fail'))
				.catchError(() => FuturableTask.resolve(null));

			const result = await task.run();
			expect(result).toBeNull();
		});

		test('should propagate fallback task errors', async () => {
			const task = FuturableTask.reject<number>(new Error('original'))
				.catchError(() => FuturableTask.reject(new Error('fallback')));

			await expect(task.run()).rejects.toThrow('fallback');
		});
	});

	describe('orElse()', () => {
		test('should provide alternative on failure', async () => {
			const task = FuturableTask.reject<number>(new Error('fail'))
				.orElse(() => FuturableTask.resolve(42));

			const result = await task.run();
			expect(result).toBe(42);
		});

		test('should pass through on success', async () => {
			const task = FuturableTask.resolve(42)
				.orElse(() => FuturableTask.resolve(99));

			const result = await task.run();
			expect(result).toBe(42);
		});

		test('should propagate fallback errors', async () => {
			const task = FuturableTask.reject<number>(new Error('original'))
				.orElse(() => FuturableTask.reject(new Error('fallback')));

			await expect(task.run()).rejects.toThrow('fallback');
		});
	});

	describe('fallbackTo()', () => {
		test('should return default value on error', async () => {
			const task = FuturableTask.reject<number>(new Error('fail'))
				.fallbackTo(42);

			const result = await task.run();
			expect(result).toBe(42);
		});

		test('should pass through on success', async () => {
			const task = FuturableTask.resolve(99)
				.fallbackTo(42);

			const result = await task.run();
			expect(result).toBe(99);
		});

		test('should work with null/undefined', async () => {
			const task1 = FuturableTask.reject<number | null>(new Error('fail')).fallbackTo(null);
			const task2 = FuturableTask.reject<number | undefined>(new Error('fail')).fallbackTo(undefined);

			expect(await task1.run()).toBeNull();
			expect(await task2.run()).toBeUndefined();
		});
	});

	describe('ifElse()', () => {
		test('should execute onTrue branch when condition is true', async () => {
			const task = FuturableTask.resolve(10)
				.ifElse(
					x => x > 5,
					x => FuturableTask.resolve(`big: ${x}`),
					x => FuturableTask.resolve(`small: ${x}`)
				);

			const result = await task.run();
			expect(result).toBe('big: 10');
		});

		test('should execute onFalse branch when condition is false', async () => {
			const task = FuturableTask.resolve(3)
				.ifElse(
					x => x > 5,
					x => FuturableTask.resolve(`big: ${x}`),
					x => FuturableTask.resolve(`small: ${x}`)
				);

			const result = await task.run();
			expect(result).toBe('small: 3');
		});

		test('should support async condition', async () => {
			const task = FuturableTask.resolve(10)
				.ifElse(
					async x => {
						await Promise.resolve();
						return x > 5;
					},
					x => FuturableTask.resolve(`big: ${x}`),
					x => FuturableTask.resolve(`small: ${x}`)
				);

			const result = await task.run();
			expect(result).toBe('big: 10');
		});

		test('should propagate errors from condition', async () => {
			const task = FuturableTask.resolve(10)
				.ifElse(
					() => { throw new Error('condition error'); },
					x => FuturableTask.resolve(x),
					x => FuturableTask.resolve(x)
				);

			await expect(task.run()).rejects.toThrow('condition error');
		});

		test('should propagate errors from branches', async () => {
			const task = FuturableTask.resolve(10)
				.ifElse(
					x => x > 5,
					() => FuturableTask.reject(new Error('branch error')),
					x => FuturableTask.resolve(x)
				);

			await expect(task.run()).rejects.toThrow('branch error');
		});
	});

	describe('fold()', () => {
		test('should apply onSuccess for successful task', async () => {
			const task = FuturableTask.resolve(42)
				.fold(
					() => FuturableTask.resolve('error'),
					x => FuturableTask.resolve(`success: ${x}`)
				);

			const result = await task.run();
			expect(result).toBe('success: 42');
		});

		test('should apply onFailure for failed task', async () => {
			const task = FuturableTask.reject<number>(new Error('fail'))
				.fold(
					err => FuturableTask.resolve(`error: ${err.message}`),
					x => FuturableTask.resolve(`success: ${x}`)
				);

			const result = await task.run();
			expect(result).toBe('error: fail');
		});

		test('should propagate errors from onSuccess', async () => {
			const task = FuturableTask.resolve(42)
				.fold(
					() => FuturableTask.resolve('error'),
					() => FuturableTask.reject(new Error('fold error'))
				);

			await expect(task.run()).rejects.toThrow('fold error');
		});

		test('should propagate errors from onFailure', async () => {
			const task = FuturableTask.reject<number>(new Error('original'))
				.fold(
					() => FuturableTask.reject(new Error('fold error')),
					x => FuturableTask.resolve(x)
				);

			await expect(task.run()).rejects.toThrow('fold error');
		});
	});

	describe('finally()', () => {
		test('should execute callback on success', async () => {
			const callbacks: string[] = [];

			const result = await FuturableTask.resolve(42)
				.finally(() => callbacks.push('finally'))
				.run();

			expect(result).toBe(42);
			expect(callbacks).toEqual(['finally']);
		});

		test('should execute callback on error', async () => {
			const callbacks: string[] = [];

			const task = FuturableTask.reject(new Error('fail'))
				.finally(() => callbacks.push('finally'));

			await expect(task.run()).rejects.toThrow('fail');
			expect(callbacks).toEqual(['finally']);
		});

		test('should support async callback', async () => {
			const callbacks: string[] = [];

			const result = await FuturableTask.resolve(42)
				.finally(async () => {
					await Promise.resolve();
					callbacks.push('finally');
				})
				.run();

			expect(result).toBe(42);
			expect(callbacks).toEqual(['finally']);
		});

		test('should propagate callback errors', async () => {
			const task = FuturableTask.resolve(42)
				.finally(() => {
					throw new Error('finally error');
				});

			await expect(task.run()).rejects.toThrow('finally error');
		});

		test('should propagate callback errors even on original error', async () => {
			const task = FuturableTask.reject(new Error('original'))
				.finally(() => {
					throw new Error('finally error');
				});

			await expect(task.run()).rejects.toThrow('finally error');
		});
	});

	describe('timeout()', () => {
		test('should resolve if task completes in time', async () => {
			const task = new FuturableTask<number>((res) => {
				setTimeout(() => res(42), 100);
			}).timeout(200);

			const promise = task.run();
			jest.advanceTimersByTime(150);

			const result = await promise;
			expect(result).toBe(42);
		});

		test('should reject if task exceeds timeout', async () => {
			const task = new FuturableTask<number>((res) => {
				setTimeout(() => res(42), 300);
			}).timeout(200);

			const promise = task.run();
			jest.advanceTimersByTime(250);

			await expect(promise).rejects.toBe('TimeoutExceeded');
		});

		test('should use custom timeout reason', async () => {
			const task = new FuturableTask<number>((res) => {
				setTimeout(() => res(42), 300);
			}).timeout(200, new Error('Custom timeout'));

			const promise = task.run();
			jest.advanceTimersByTime(250);

			await expect(promise).rejects.toThrow('Custom timeout');
		});

		test('should clear timeout on success', async () => {
			const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

			const task = new FuturableTask<number>((res) => {
				setTimeout(() => res(42), 100);
			}).timeout(200);

			const promise = task.run();
			jest.advanceTimersByTime(150);
			await promise;

			expect(clearTimeoutSpy).toHaveBeenCalled();
			clearTimeoutSpy.mockRestore();
		});

		test('should clear timeout on error', async () => {
			const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

			const task = new FuturableTask<number>((res, rej) => {
				setTimeout(() => rej(new Error('fail')), 100);
			}).timeout(200);

			const promise = task.run();
			jest.advanceTimersByTime(150);

			try {
				await promise;
			} catch (e) {
				// Expected
			}

			expect(clearTimeoutSpy).toHaveBeenCalled();
			clearTimeoutSpy.mockRestore();
		});

		test('should clear timeout on cancellation', async () => {
			const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

			const task = new FuturableTask<number>((res) => {
				setTimeout(() => res(42), 100);
			}).timeout(200);

			task.run();
			task.cancel();

			expect(clearTimeoutSpy).toHaveBeenCalled();
			clearTimeoutSpy.mockRestore();
		});
	});

	describe('delay()', () => {
		test('should delay execution by specified time', async () => {
			const task = FuturableTask.resolve(42).delay(1000);

			const promise = task.run();
			jest.advanceTimersByTime(500);

			const isPending = await Promise.race([
				promise.then(() => false),
				Promise.resolve(true)
			]);

			expect(isPending).toBe(true);

			jest.advanceTimersByTime(600);
			const result = await promise;

			expect(result).toBe(42);
		});

		test('should be cancellable', async () => {
			const task = FuturableTask.resolve(42).delay(1000);

			const promise = task.run();
			task.cancel();

			jest.advanceTimersByTime(2000);

			const isPending = await Promise.race([
				promise.then(() => false),
				Promise.resolve(true)
			]);

			expect(isPending).toBe(true);
		});
	});

	describe('retry()', () => {
		test('should retry on failure', async () => {
			let attempts = 0;
			const task = new FuturableTask<number>((res, rej) => {
				attempts++;
				if (attempts < 3) {
					rej(new Error('fail'));
				} else {
					res(attempts);
				}
			}).retry(3);

			const result = await task.run();
			expect(result).toBe(3);
			expect(attempts).toBe(3);
		});

		test('should fail if all retries exhausted', async () => {
			let attempts = 0;
			const task = new FuturableTask<number>((res, rej) => {
				attempts++;
				rej(new Error(`fail ${attempts}`));
			}).retry(2);

			await expect(task.run()).rejects.toThrow('fail 3');
			expect(attempts).toBe(3); // initial + 2 retries
		});

		test('should succeed on first try', async () => {
			let attempts = 0;
			const task = new FuturableTask<number>((res) => {
				attempts++;
				res(42);
			}).retry(3);

			const result = await task.run();
			expect(result).toBe(42);
			expect(attempts).toBe(1);
		});

		test('should delay between retries', async () => {
			let attempts = 0;
			const task = new FuturableTask<number>((res, rej) => {
				attempts++;
				if (attempts < 2) {
					rej(new Error('fail'));
				} else {
					res(attempts);
				}
			}).retry(2, 1000);

			const promise = task.run();

			// First attempt fails immediately
			await Promise.resolve();

			// Wait for retry delay
			jest.advanceTimersByTime(1000);

			const result = await promise;
			expect(result).toBe(2);
		});

		test('should stop retrying if cancelled', async () => {
			let attempts = 0;
			const task = new FuturableTask<number>((res, rej) => {
				attempts++;
				rej(new Error('fail'));
			}).retry(5, 1000);

			const promise = task.run();
			task.cancel();

			jest.advanceTimersByTime(10000);

			const isPending = await Promise.race([
				promise.then(() => false).catch(() => false),
				Promise.resolve(true)
			]);

			expect(isPending).toBe(true);
			expect(attempts).toBeLessThan(6);
		});
	});

	describe('debounce()', () => {
		test('should debounce rapid calls', async () => {
			let executions = 0;
			const task = new FuturableTask<number>((res) => {
				executions++;
				res(executions);
			}).debounce(1000);

			const run1 = task.run();
			const run2 = task.run();
			const run3 = task.run();

			jest.advanceTimersByTime(1100);

			const result = await run3;

			expect(executions).toBe(1);
			expect(result).toBe(1);
		});

		test('should work with smart debounce (chained debounce)', async () => {
			let executions = 0;
			const sourceTask = new FuturableTask<number>((res) => {
				executions++;
				res(executions);
			});

			const task = sourceTask.debounce(200).debounce(300);

			task.run();
			jest.advanceTimersByTime(350);

			expect(executions).toBe(1);
		});

		test('should cancel previous timeout on new run', async () => {
			let executions = 0;
			const task = new FuturableTask<number>((res) => {
				executions++;
				res(executions);
			}).debounce(1000);

			task.run();
			jest.advanceTimersByTime(500);

			task.run();
			jest.advanceTimersByTime(500);

			expect(executions).toBe(0); // Still waiting

			jest.advanceTimersByTime(600);

			expect(executions).toBe(1); // Only one execution
		});

		test('should clear timeout on cancellation', async () => {
			const task = new FuturableTask<number>((res) => res(42)).debounce(1000);

			task.run();
			task.cancel();

			jest.advanceTimersByTime(2000);

			// Should not execute
		});

		test('should preserve sourceTask reference', () => {
			const source = new FuturableTask<number>((res) => res(42));
			const debounced1 = source.debounce(200);
			const debounced2 = debounced1.debounce(300);

			expect((debounced2 as any).sourceTask).toBe(source);
		});
	});

	describe('throttle()', () => {
		test('should throttle rapid calls', async () => {
			let executions = 0;
			const task = new FuturableTask<number>((res) => {
				res(++executions);
			}).throttle(1000);

			const result1 = await task.run(); // Executes immediately
			const result2 = await task.run(); // Reuses result1
			const result3 = await task.run(); // Reuses result1

			expect(result1).toBe(1);
			expect(result2).toBe(1);
			expect(result3).toBe(1);
			expect(executions).toBe(1);
		});

		test('should allow execution after throttle period', async () => {
			let executions = 0;
			const task = new FuturableTask<number>((res) => {
				res(++executions);
			}).throttle(1000);

			const result1 = await task.run();

			jest.advanceTimersByTime(1100);

			const result2 = await task.run();

			expect(result1).toBe(1);
			expect(result2).toBe(2);
			expect(executions).toBe(2);
		});

		test('should handle errors in throttled execution', async () => {
			let executions = 0;
			const task = new FuturableTask<number>((res, rej) => {
				executions++;
				rej(new Error(`fail ${executions}`));
			}).throttle(1000);

			await expect(task.run()).rejects.toThrow('fail 1');
			await expect(task.run()).rejects.toThrow('fail 1'); // Reuses error
		});
	});

	describe('zip()', () => {
		test('should combine two tasks into a tuple', async () => {
			const task1 = FuturableTask.resolve(42);
			const task2 = FuturableTask.resolve('hello');

			const result = await task1.zip(task2).run();

			expect(result).toEqual([42, 'hello']);
		});

		test('should execute tasks in parallel', async () => {
			const executions: number[] = [];

			const task1 = new FuturableTask<number>((res) => {
				setTimeout(() => {
					executions.push(1);
					res(1);
				}, 100);
			});

			const task2 = new FuturableTask<number>((res) => {
				setTimeout(() => {
					executions.push(2);
					res(2);
				}, 50);
			});

			const promise = task1.zip(task2).run();

			jest.advanceTimersByTime(60);
			expect(executions).toEqual([2]);

			jest.advanceTimersByTime(50);
			await promise;
			expect(executions).toEqual([2, 1]);
		});

		test('should fail if either task fails', async () => {
			const task1 = FuturableTask.resolve(42);
			const task2 = FuturableTask.reject(new Error('fail'));

			await expect(task1.zip(task2).run()).rejects.toThrow('fail');
		});
	});

	describe('zipWith()', () => {
		test('should combine tasks with a function', async () => {
			const task1 = FuturableTask.resolve(5);
			const task2 = FuturableTask.resolve(10);

			const result = await task1.zipWith(task2, (a, b) => a + b).run();

			expect(result).toBe(15);
		});

		test('should work with different types', async () => {
			const task1 = FuturableTask.resolve(42);
			const task2 = FuturableTask.resolve('hello');

			const result = await task1.zipWith(task2, (a, b) => `${b}: ${a}`).run();

			expect(result).toBe('hello: 42');
		});
	});

	describe('bimap()', () => {
		test('should transform success value', async () => {
			const task = FuturableTask.resolve(42)
				.bimap(
					x => x * 2,
					() => 'error'
				);

			const result = await task.run();
			expect(result).toBe(84);
		});

		test('should transform error', async () => {
			const task = FuturableTask.reject<number>(new Error('original'))
				.bimap(
					x => x,
					err => new Error(`transformed: ${err.message}`)
				);

			await expect(task.run()).rejects.toThrow('transformed: original');
		});
	});

	describe('repeat()', () => {
		test('should repeat task n times', async () => {
			let counter = 0;
			const task = new FuturableTask<number>((res) => res(++counter));

			const results = await task.repeat(3).run();

			expect(results).toEqual([1, 2, 3]);
		});

		test('should work with n=0', async () => {
			const task = FuturableTask.resolve(42);
			const results = await task.repeat(0).run();

			expect(results).toEqual([42]);
		});
	});

	describe('pipe()', () => {
		test('should compose transformations', () => {
			const addRetry = (task: FuturableTask<number>) => task.retry(3);
			const addTimeout = (task: FuturableTask<number>) => task.timeout(5000);
			const double = (task: FuturableTask<number>) => task.map(x => x * 2);

			const result = FuturableTask.resolve(5).pipe(
				addRetry,
				addTimeout,
				double
			);

			expect(result).toBeInstanceOf(FuturableTask);
		});

		test('should work with multiple transformations', async () => {
			const result = await FuturableTask.resolve(5).pipe(
				t => t.map(x => x * 2),
				t => t.map(x => x + 3),
				t => t.map(x => x.toString())
			).run();

			expect(result).toBe('13');
		});
	});

	describe('Static: of()', () => {
		test('should create task from value', async () => {
			const task = FuturableTask.of(42);
			const result = await task.run();

			expect(result).toBe(42);
		});

		test('should create task from function', async () => {
			const task = FuturableTask.of(() => 42);
			const result = await task.run();

			expect(result).toBe(42);
		});

		test('should create task from async function', async () => {
			const task = FuturableTask.of(async () => {
				await Promise.resolve();
				return 42;
			});

			const result = await task.run();
			expect(result).toBe(42);
		});

		test('should pass utils to function', async () => {
			let receivedUtils: any;
			const task = FuturableTask.of((utils) => {
				receivedUtils = utils;
				return 42;
			});

			await task.run();

			expect(receivedUtils).toBeDefined();
			expect(receivedUtils.signal).toBeInstanceOf(AbortSignal);
		});

		test('should handle function errors', async () => {
			const task = FuturableTask.of(() => {
				throw new Error('function error');
			});

			await expect(task.run()).rejects.toThrow('function error');
		});

		test('should accept external signal', () => {
			const controller = new AbortController();
			const task = FuturableTask.of(42, controller.signal);

			expect(task.signal).toBeDefined();
		});
	});

	describe('Static: resolve()', () => {
		test('should create resolved task', async () => {
			const task = FuturableTask.resolve(42);
			const result = await task.run();

			expect(result).toBe(42);
		});

		test('should work with different types', async () => {
			const task1 = FuturableTask.resolve('hello');
			const task2 = FuturableTask.resolve(null);
			const task3 = FuturableTask.resolve({ key: 'value' });

			expect(await task1.run()).toBe('hello');
			expect(await task2.run()).toBeNull();
			expect(await task3.run()).toEqual({ key: 'value' });
		});
	});

	describe('Static: reject()', () => {
		test('should create rejected task', async () => {
			const task = FuturableTask.reject<number>(new Error('fail'));

			await expect(task.run()).rejects.toThrow('fail');
		});

		test('should work with any rejection reason', async () => {
			const task1 = FuturableTask.reject<string>('string error');
			const task2 = FuturableTask.reject<number>(404);
			const task3 = FuturableTask.reject<{ code: string }>({ code: 'ERROR' });

			await expect(task1.run()).rejects.toBe('string error');
			await expect(task2.run()).rejects.toBe(404);
			await expect(task3.run()).rejects.toEqual({ code: 'ERROR' });
		});
	});

	describe('Static: all()', () => {
		test('should resolve when all tasks complete', async () => {
			const tasks = [
				FuturableTask.resolve(1),
				FuturableTask.resolve(2),
				FuturableTask.resolve(3)
			];

			const results = await FuturableTask.all(tasks).run();

			expect(results).toEqual([1, 2, 3]);
		});

		test('should reject if any task fails', async () => {
			const tasks = [
				FuturableTask.resolve(1),
				FuturableTask.reject(new Error('fail')),
				FuturableTask.resolve(3)
			];

			await expect(FuturableTask.all(tasks).run()).rejects.toThrow('fail');
		});

		test('should work with empty array', async () => {
			const results = await FuturableTask.all([]).run();
			expect(results).toEqual([]);
		});
	});

	describe('Static: allSettled()', () => {
		test('should wait for all tasks to settle', async () => {
			const tasks = [
				FuturableTask.resolve(1),
				FuturableTask.reject(new Error('fail')),
				FuturableTask.resolve(3)
			];

			const results = await FuturableTask.allSettled(tasks).run();

			expect(results).toHaveLength(3);
			expect(results[0]).toEqual({ status: 'fulfilled', value: 1 });
			expect(results[1]).toMatchObject({ status: 'rejected', reason: expect.any(Error) });
			expect(results[2]).toEqual({ status: 'fulfilled', value: 3 });
		});

		test('should work with empty array', async () => {
			const results = await FuturableTask.allSettled([]).run();
			expect(results).toEqual([]);
		});
	});

	describe('Static: race()', () => {
		test('should resolve with first completed task', async () => {
			const task1 = new FuturableTask<number>((res) => {
				setTimeout(() => res(1), 200);
			});
			const task2 = new FuturableTask<number>((res) => {
				setTimeout(() => res(2), 100);
			});

			const promise = FuturableTask.race([task1, task2]).run();

			jest.advanceTimersByTime(150);

			const result = await promise;
			expect(result).toBe(2);
		});

		test('should reject with first rejected task', async () => {
			const task1 = new FuturableTask<number>((res) => {
				setTimeout(() => res(1), 200);
			});
			const task2 = new FuturableTask<number>((res, rej) => {
				setTimeout(() => rej(new Error('fast fail')), 100);
			});

			const promise = FuturableTask.race([task1, task2]).run();

			jest.advanceTimersByTime(150);

			await expect(promise).rejects.toThrow('fast fail');
		});
	});

	describe('Static: any()', () => {
		test('should resolve with first successful task', async () => {
			const tasks = [
				FuturableTask.reject(new Error('fail1')),
				FuturableTask.resolve(42),
				FuturableTask.reject(new Error('fail2'))
			];

			const result = await FuturableTask.any(tasks).run();
			expect(result).toBe(42);
		});

		test('should reject if all tasks fail', async () => {
			const tasks = [
				FuturableTask.reject(new Error('fail1')),
				FuturableTask.reject(new Error('fail2'))
			];

			await expect(FuturableTask.any(tasks).run()).rejects.toThrow();
		});
	});

	describe('Static: delay()', () => {
		test('should create delayed task', async () => {
			const task = FuturableTask.delay(1000);

			const promise = task.run();

			jest.advanceTimersByTime(500);
			const isPending = await Promise.race([
				promise.then(() => false),
				Promise.resolve(true)
			]);
			expect(isPending).toBe(true);

			jest.advanceTimersByTime(600);
			await promise;
		});

		test('should accept external signal', () => {
			const controller = new AbortController();
			const task = FuturableTask.delay(1000, controller.signal);

			expect(task.signal).toBeDefined();
		});
	});

	describe('Static: fromEvent()', () => {
		test('should create task from event', async () => {
			const target = new EventTarget();
			const task = FuturableTask.fromEvent(target, 'custom');

			const promise = task.run();

			const event = new Event('custom');
			target.dispatchEvent(event);

			const result = await promise;
			expect(result).toBe(event);
		});

		test('should remove listener after event fires', async () => {
			const target = new EventTarget();
			const removeEventListenerSpy = jest.spyOn(target, 'removeEventListener');

			const task = FuturableTask.fromEvent(target, 'custom');

			const promise = task.run();
			target.dispatchEvent(new Event('custom'));
			await promise;

			expect(removeEventListenerSpy).toHaveBeenCalledWith('custom', expect.any(Function));
		});

		test('should not remove listener when opts.once is true', async () => {
			const target = new EventTarget();
			const removeEventListenerSpy = jest.spyOn(target, 'removeEventListener');

			const task = FuturableTask.fromEvent(target, 'custom', { once: true });

			const promise = task.run();
			target.dispatchEvent(new Event('custom'));
			await promise;

			expect(removeEventListenerSpy).not.toHaveBeenCalled();
		});

		test('should remove listener on cancellation', async () => {
			const target = new EventTarget();
			const removeEventListenerSpy = jest.spyOn(target, 'removeEventListener');

			const task = FuturableTask.fromEvent(target, 'custom');

			task.run();
			task.cancel();

			expect(removeEventListenerSpy).toHaveBeenCalled();
		});

		test('should support event options', async () => {
			const target = new EventTarget();
			const addEventListenerSpy = jest.spyOn(target, 'addEventListener');

			const task = FuturableTask.fromEvent(target, 'custom', {
				capture: true,
				passive: true
			});

			task.run();

			expect(addEventListenerSpy).toHaveBeenCalledWith(
				'custom',
				expect.any(Function),
				{ capture: true, passive: true }
			);
		});
	});

	describe('Static: sequence()', () => {
		test('should execute tasks sequentially', async () => {
			const executions: number[] = [];

			const tasks = [
				new FuturableTask<number>((res) => {
					setTimeout(() => {
						executions.push(1);
						res(1);
					}, 100);
				}),
				new FuturableTask<number>((res) => {
					setTimeout(() => {
						executions.push(2);
						res(2);
					}, 50);
				}),
				new FuturableTask<number>((res) => {
					executions.push(3);
					res(3);
				})
			];

			const promise = FuturableTask.sequence(tasks).run();

			jest.advanceTimersByTime(110);
			expect(executions).toEqual([1]);

			jest.advanceTimersByTime(60);
			expect(executions).toEqual([1, 2]);

			await promise;
			expect(executions).toEqual([1, 2, 3]);
		});

		test('should stop on first error', async () => {
			let executions = 0;

			const tasks = [
				FuturableTask.of(() => { executions++; return 1; }),
				FuturableTask.reject(new Error('fail')),
				FuturableTask.of(() => { executions++; return 3; })
			];

			await expect(FuturableTask.sequence(tasks).run()).rejects.toThrow('fail');
			expect(executions).toBe(1);
		});

		test('should stop if cancelled', async () => {
			let executions = 0;

			const tasks = [
				new FuturableTask<number>((res) => {
					setTimeout(() => {
						executions++;
						res(1);
					}, 100);
				}),
				new FuturableTask<number>((res) => {
					setTimeout(() => {
						executions++;
						res(2);
					}, 100);
				})
			];

			const task = FuturableTask.sequence(tasks);
			const promise = task.run();

			jest.advanceTimersByTime(110);
			task.cancel();
			jest.advanceTimersByTime(200);

			expect(executions).toBe(1);
		});
	});

	describe('Static: parallel()', () => {
		test('should limit concurrent executions', async () => {
			let running = 0;
			let maxRunning = 0;

			const createTask = () => new FuturableTask<number>((res) => {
				running++;
				maxRunning = Math.max(maxRunning, running);
				setTimeout(() => {
					running--;
					res(1);
				}, 100);
			});

			const tasks = Array(10).fill(null).map(() => createTask());

			const promise = FuturableTask.parallel(tasks, 3).run();

			jest.advanceTimersByTime(110);
			expect(maxRunning).toBe(3);

			jest.advanceTimersByTime(400);
			await promise;
		});

		test('should return results in order', async () => {
			const tasks = [
				FuturableTask.resolve(1),
				FuturableTask.resolve(2),
				FuturableTask.resolve(3),
				FuturableTask.resolve(4),
				FuturableTask.resolve(5)
			];

			const results = await FuturableTask.parallel(tasks, 2).run();

			expect(results).toEqual([1, 2, 3, 4, 5]);
		});

		test('should stop all on error', async () => {
			let executions = 0;

			const tasks = [
				new FuturableTask<number>((res) => {
					setTimeout(() => {
						executions++;
						res(1);
					}, 100);
				}),
				FuturableTask.reject(new Error('fail')),
				new FuturableTask<number>((res) => {
					setTimeout(() => {
						executions++;
						res(3);
					}, 100);
				})
			];

			await expect(FuturableTask.parallel(tasks, 2).run()).rejects.toThrow('fail');
		});

		test('should handle cancellation', async () => {
			let executions = 0;

			const tasks = Array(5).fill(null).map(() =>
				new FuturableTask<number>((res) => {
					setTimeout(() => {
						executions++;
						res(1);
					}, 100);
				})
			);

			const task = FuturableTask.parallel(tasks, 2);
			const promise = task.run();

			jest.advanceTimersByTime(50);
			task.cancel();
			jest.advanceTimersByTime(200);

			expect(executions).toBeLessThan(5);
		});
	});

	describe('Static: createLimiter()', () => {
		test('should create a limiter function', () => {
			const limiter = FuturableTask.createLimiter(2);

			expect(typeof limiter).toBe('function');
			expect(limiter.concurrency).toBe(2);
			expect(limiter.activeCount).toBe(0);
			expect(limiter.pendingCount).toBe(0);
		});

		test('should limit concurrent executions', async () => {
			const limiter = FuturableTask.createLimiter(2);

			let running = 0;
			let maxRunning = 0;

			const createTask = () => limiter(
				new FuturableTask<number>((res) => {
					running++;
					maxRunning = Math.max(maxRunning, running);
					setTimeout(() => {
						running--;
						res(1);
					}, 100);
				})
			);

			const tasks = Array(5).fill(null).map(() => createTask());

			const promise = FuturableTask.all(tasks).run();

			jest.advanceTimersByTime(110);
			expect(maxRunning).toBe(2);

			jest.advanceTimersByTime(300);
			await promise;
		});

		test('should track activeCount and pendingCount', async () => {
			const limiter = FuturableTask.createLimiter(2);

			const tasks = Array(5).fill(null).map((_, i) =>
				limiter(new FuturableTask<number>((res) => {
					setTimeout(() => res(i), 100);
				}))
			);

			tasks.forEach(t => t.run());

			await Promise.resolve(); // Let tasks enter queue

			expect(limiter.activeCount).toBe(2);
			expect(limiter.pendingCount).toBe(3);

			jest.advanceTimersByTime(110);

			expect(limiter.activeCount).toBe(2);
			expect(limiter.pendingCount).toBe(1);
		});

		test('should call onActive event', async () => {
			const onActive = jest.fn();
			const limiter = FuturableTask.createLimiter(1, { onActive });

			const task = limiter(FuturableTask.resolve(42));
			await task.run();

			expect(onActive).toHaveBeenCalledTimes(1);
		});

		test('should call onCompleted event', async () => {
			const onCompleted = jest.fn();
			const limiter = FuturableTask.createLimiter(1, { onCompleted });

			const task = limiter(FuturableTask.resolve(42));
			await task.run();

			expect(onCompleted).toHaveBeenCalledWith(42);
		});

		test('should call onError event', async () => {
			const onError = jest.fn();
			const limiter = FuturableTask.createLimiter(1, { onError });

			const task = limiter(FuturableTask.reject(new Error('fail')));

			try {
				await task.run();
			} catch (e) {
				// Expected
			}

			expect(onError).toHaveBeenCalledWith(expect.any(Error));
		});

		test('should call onIdle event', async () => {
			const onIdle = jest.fn();
			const limiter = FuturableTask.createLimiter(2, { onIdle });

			const tasks = [
				limiter(FuturableTask.resolve(1)),
				limiter(FuturableTask.resolve(2))
			];

			await FuturableTask.all(tasks).run();

			expect(onIdle).toHaveBeenCalledTimes(1);
		});

		test('should remove cancelled tasks from queue', async () => {
			const limiter = FuturableTask.createLimiter(1);

			const task1 = limiter(new FuturableTask<number>((res) => {
				setTimeout(() => res(1), 100);
			}));

			const task2 = limiter(FuturableTask.resolve(2));
			const task3 = limiter(FuturableTask.resolve(3));

			task1.run();
			task2.run();
			task3.run();

			await Promise.resolve(); // Let tasks enter queue

			expect(limiter.pendingCount).toBe(2);

			task2.cancel();

			expect(limiter.pendingCount).toBe(1);
		});
	});

	describe('Static: compose()', () => {
		test('should compose operations', async () => {
			const result = await FuturableTask.compose(
				FuturableTask.resolve(5),
				t => t.map(x => x * 2),
				t => t.map(x => x + 3),
				t => t.map(x => x.toString())
			).run();

			expect(result).toBe('13');
		});

		test('should work with single operation', async () => {
			const result = await FuturableTask.compose(
				FuturableTask.resolve(5),
				t => t.map(x => x * 2)
			).run();

			expect(result).toBe(10);
		});
	});

	describe('Static: filter()', () => {
		test('should filter task results', async () => {
			const tasks = [
				FuturableTask.resolve(1),
				FuturableTask.resolve(2),
				FuturableTask.resolve(3),
				FuturableTask.resolve(4),
				FuturableTask.resolve(5)
			];

			const results = await FuturableTask.filter(tasks, x => x % 2 === 0).run();

			expect(results).toEqual([2, 4]);
		});

		test('should support async predicate', async () => {
			const tasks = [
				FuturableTask.resolve(1),
				FuturableTask.resolve(2),
				FuturableTask.resolve(3)
			];

			const results = await FuturableTask.filter(tasks, async x => {
				await Promise.resolve();
				return x > 1;
			}).run();

			expect(results).toEqual([2, 3]);
		});

		test('should stop on cancellation', async () => {
			let evaluations = 0;

			const tasks = Array(5).fill(null).map((_, i) => FuturableTask.resolve(i));

			const filterTask = FuturableTask.filter(tasks, () => {
				evaluations++;
				return true;
			});

			const promise = filterTask.run();
			filterTask.cancel();

			await Promise.resolve();

			expect(evaluations).toBeLessThan(5);
		});
	});

	describe('Static: reduce()', () => {
		test('should reduce task results', async () => {
			const tasks = [
				FuturableTask.resolve(1),
				FuturableTask.resolve(2),
				FuturableTask.resolve(3),
				FuturableTask.resolve(4)
			];

			const sum = await FuturableTask.reduce(
				tasks,
				(acc, val) => acc + val,
				0
			).run();

			expect(sum).toBe(10);
		});

		test('should pass index to reducer', async () => {
			const tasks = [
				FuturableTask.resolve('a'),
				FuturableTask.resolve('b'),
				FuturableTask.resolve('c')
			];

			const result = await FuturableTask.reduce(
				tasks,
				(acc, val, idx) => acc + `${idx}:${val},`,
				''
			).run();

			expect(result).toBe('0:a,1:b,2:c,');
		});

		test('should support async reducer', async () => {
			const tasks = [
				FuturableTask.resolve(1),
				FuturableTask.resolve(2)
			];

			const result = await FuturableTask.reduce(
				tasks,
				async (acc, val) => {
					await Promise.resolve();
					return acc + val;
				},
				0
			).run();

			expect(result).toBe(3);
		});

		test('should stop on cancellation', async () => {
			let reductions = 0;

			const tasks = Array(5).fill(null).map((_, i) => FuturableTask.resolve(i));

			const reduceTask = FuturableTask.reduce(
				tasks,
				(acc, val) => {
					reductions++;
					return acc + val;
				},
				0
			);

			const promise = reduceTask.run();
			reduceTask.cancel();

			await Promise.resolve();

			expect(reductions).toBeLessThan(5);
		});
	});

	describe('Static: whilst()', () => {
		test('should repeat while condition is true', async () => {
			let counter = 0;

			const results = await FuturableTask.whilst(
				() => counter < 5,
				FuturableTask.of(() => ++counter)
			).run();

			expect(results).toEqual([1, 2, 3, 4, 5]);
		});

		test('should support async condition', async () => {
			let counter = 0;

			const results = await FuturableTask.whilst(
				async () => {
					await Promise.resolve();
					return counter < 3;
				},
				FuturableTask.of(() => ++counter)
			).run();

			expect(results).toEqual([1, 2, 3]);
		});

		test('should stop immediately if condition is false', async () => {
			const results = await FuturableTask.whilst(
				() => false,
				FuturableTask.resolve(42)
			).run();

			expect(results).toEqual([]);
		});

		test('should stop on cancellation', async () => {
			let iterations = 0;

			const whilstTask = FuturableTask.whilst(
				() => true,
				FuturableTask.of(() => {
					iterations++;
					return iterations;
				})
			);

			const promise = whilstTask.run();
			whilstTask.cancel();

			await Promise.resolve();

			expect(iterations).toBeLessThan(100);
		});
	});

	describe('Static: until()', () => {
		test('should repeat until condition is true', async () => {
			let counter = 0;

			const results = await FuturableTask.until(
				() => counter >= 5,
				FuturableTask.of(() => ++counter)
			).run();

			expect(results).toEqual([1, 2, 3, 4, 5]);
		});

		test('should support async condition', async () => {
			let counter = 0;

			const results = await FuturableTask.until(
				async () => {
					await Promise.resolve();
					return counter >= 3;
				},
				FuturableTask.of(() => ++counter)
			).run();

			expect(results).toEqual([1, 2, 3]);
		});
	});

	describe('Static: times()', () => {
		test('should execute task n times', async () => {
			const results = await FuturableTask.times(
				5,
				i => FuturableTask.resolve(i * 2)
			).run();

			expect(results).toEqual([0, 2, 4, 6, 8]);
		});

		test('should work with n=0', async () => {
			const results = await FuturableTask.times(
				0,
				i => FuturableTask.resolve(i)
			).run();

			expect(results).toEqual([]);
		});

		test('should stop on error', async () => {
			const task = FuturableTask.times(
				5,
				i => i === 2
					? FuturableTask.reject(new Error('fail at 2'))
					: FuturableTask.resolve(i)
			);

			await expect(task.run()).rejects.toThrow('fail at 2');
		});

		test('should stop on cancellation', async () => {
			let executions = 0;

			const timesTask = FuturableTask.times(
				10,
				() => FuturableTask.of(() => {
					executions++;
					return executions;
				})
			);

			const promise = timesTask.run();
			timesTask.cancel();

			await Promise.resolve();

			expect(executions).toBeLessThan(10);
		});
	});

	describe('Static: traverse()', () => {
		test('should map values to tasks and execute sequentially', async () => {
			const values = [1, 2, 3, 4, 5];

			const results = await FuturableTask.traverse(
				values,
				x => FuturableTask.resolve(x * 2)
			).run();

			expect(results).toEqual([2, 4, 6, 8, 10]);
		});

		test('should pass index to mapper', async () => {
			const values = ['a', 'b', 'c'];

			const results = await FuturableTask.traverse(
				values,
				(val, idx) => FuturableTask.resolve(`${idx}:${val}`)
			).run();

			expect(results).toEqual(['0:a', '1:b', '2:c']);
		});
	});

	describe('Instance: fetch()', () => {
		test('should fetch with value from task', async () => {
			mockFetch.mockResolvedValueOnce(
				new Response('ok', { status: 200 })
			);

			const task = FuturableTask.resolve('users/123')
				.fetch(id => `https://api.example.com/${id}`);

			const response = await task.run();

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/users/123',
				expect.objectContaining({ signal: expect.any(AbortSignal) })
			);
			expect(response.status).toBe(200);
		});

		test('should fetch with static URL', async () => {
			mockFetch.mockResolvedValueOnce(
				new Response('ok', { status: 200 })
			);

			const task = FuturableTask.resolve(42)
				.fetch('https://api.example.com/data');

			await task.run();

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/data',
				expect.any(Object)
			);
		});

		test('should support dynamic options', async () => {
			mockFetch.mockResolvedValueOnce(
				new Response('ok', { status: 200 })
			);

			const task = FuturableTask.resolve({ id: 123, token: 'abc' })
				.fetch(
					data => `https://api.example.com/users/${data.id}`,
					data => ({ headers: { Authorization: `Bearer ${data.token}` } })
				);

			await task.run();

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/users/123',
				expect.objectContaining({
					headers: { Authorization: 'Bearer abc' }
				})
			);
		});

		test('should handle fetch errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const task = FuturableTask.resolve(1)
				.fetch('https://api.example.com/data');

			await expect(task.run()).rejects.toThrow('Network error');
		});

		test('should ignore AbortError', async () => {
			const abortError = new Error('AbortError');
			abortError.name = 'AbortError';
			mockFetch.mockRejectedValueOnce(abortError);

			const task = FuturableTask.resolve(1)
				.fetch('https://api.example.com/data');

			const promise = task.run();
			task.cancel();

			// Should not reject
			const isPending = await Promise.race([
				promise.then(() => false).catch(() => false),
				Promise.resolve(true)
			]);

			expect(isPending).toBe(true);
		});

		test('should propagate task error', async () => {
			const task = FuturableTask.reject<number>(new Error('task error'))
				.fetch('https://api.example.com/data');

			await expect(task.run()).rejects.toThrow('task error');
		});
	});

	describe('Static: fetch()', () => {
		test('should create a fetch task', async () => {
			mockFetch.mockResolvedValueOnce(
				new Response('ok', { status: 200 })
			);

			const task = FuturableTask.fetch('https://api.example.com/data');
			const response = await task.run();

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/data',
				undefined
			);
			expect(response.status).toBe(200);
		});

		test('should pass options to fetch', async () => {
			mockFetch.mockResolvedValueOnce(
				new Response('ok', { status: 200 })
			);

			const task = FuturableTask.fetch('https://api.example.com/data', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			await task.run();

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.example.com/data',
				expect.objectContaining({
					method: 'POST',
					headers: { 'Content-Type': 'application/json' }
				})
			);
		});

		test('should handle fetch errors', async () => {
			mockFetch.mockRejectedValueOnce(new Error('Network error'));

			const task = FuturableTask.fetch('https://api.example.com/data');

			await expect(task.run()).rejects.toThrow('Network error');
		});

		test('should accept external signal', async () => {
			mockFetch.mockResolvedValueOnce(
				new Response('ok', { status: 200 })
			);

			const controller = new AbortController();
			const task = FuturableTask.fetch(
				'https://api.example.com/data',
				{},
				controller.signal
			);

			expect(task.signal).toBeDefined();
		});

		test('should ignore AbortError', async () => {
			const abortError = new Error('AbortError');
			abortError.name = 'AbortError';
			mockFetch.mockRejectedValueOnce(abortError);

			const task = FuturableTask.fetch('https://api.example.com/data');
			const promise = task.run();
			task.cancel();

			// Should not reject
			const isPending = await Promise.race([
				promise.then(() => false).catch(() => false),
				Promise.resolve(true)
			]);

			expect(isPending).toBe(true);
		});
	});
});