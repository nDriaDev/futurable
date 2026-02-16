import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FuturableTask, FuturableTaskLimiter } from './FuturableTask';
import { Futurable } from './Futurable';

// Mock timers
vi.useFakeTimers();

describe('FuturableTask', () => {
	afterEach(() => {
		vi.clearAllTimers();
	});

	describe('Constructor', () => {
		it('should create a FuturableTask instance', () => {
			const task = new FuturableTask((resolve) => {
				resolve('test');
			});
			expect(task).toBeInstanceOf(FuturableTask);
		});

		it('should not execute until run is called', () => {
			const executor = vi.fn((resolve: any) => {
				resolve('test');
			});
			const task = new FuturableTask(executor);
			expect(executor).not.toHaveBeenCalled();
		});

		it('should handle external signal when already aborted', () => {
			const controller = new AbortController();
			controller.abort();
			const task = new FuturableTask((resolve) => {
				resolve('test');
			}, controller.signal);
			expect(task.signal.aborted).toBe(true);
		});

		it('should handle external signal abort event', () => {
			const controller = new AbortController();
			const task = new FuturableTask((resolve) => {
				setTimeout(() => resolve('test'), 100);
			}, controller.signal);
			controller.abort();
			expect(task.signal.aborted).toBe(true);
		});
	});

	describe('signal getter', () => {
		it('should return the internal signal', () => {
			const task = new FuturableTask((resolve) => {
				resolve('test');
			});
			expect(task.signal).toBeInstanceOf(AbortSignal);
			expect(task.signal.aborted).toBe(false);
		});
	});

	describe('cancel', () => {
		it('should abort the signal', () => {
			const task = new FuturableTask((resolve) => {
				resolve('test');
			});
			task.cancel();
			expect(task.signal.aborted).toBe(true);
		});

		it('should execute onCancel callbacks', () => {
			const callback = vi.fn();
			const task = new FuturableTask((resolve) => {
				resolve('test');
			}).onCancel(callback);
			task.cancel();
			expect(callback).toHaveBeenCalled();
		});

		it('should be idempotent', () => {
			const callback = vi.fn();
			const task = new FuturableTask((resolve) => {
				resolve('test');
			}).onCancel(callback);
			task.cancel();
			task.cancel();
			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('onCancel', () => {
		it('should register cancel callback', () => {
			const callback = vi.fn();
			const task = new FuturableTask((resolve) => {
				resolve('test');
			}).onCancel(callback);
			task.cancel();
			expect(callback).toHaveBeenCalled();
		});

		it('should support multiple callbacks', () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();
			const task = new FuturableTask((resolve) => {
				resolve('test');
			})
				.onCancel(callback1)
				.onCancel(callback2);
			task.cancel();
			expect(callback1).toHaveBeenCalled();
			expect(callback2).toHaveBeenCalled();
		});

		it('should return this for chaining', () => {
			const task = new FuturableTask((resolve) => {
				resolve('test');
			});
			const result = task.onCancel(() => { });
			expect(result).toBe(task);
		});
	});

	describe('run', () => {
		it('should execute the task and resolve', async () => {
			const task = new FuturableTask((resolve) => {
				resolve(42);
			});
			await expect(task.run()).resolves.toBe(42);
		});

		it('should execute the task and reject', async () => {
			const task = new FuturableTask((_, reject) => {
				reject(new Error('test error'));
			});
			await expect(task.run()).rejects.toThrow('test error');
		});

		it('should return a Futurable', () => {
			const task = new FuturableTask((resolve) => {
				resolve(42);
			});
			const result = task.run();
			expect(result).toBeInstanceOf(Futurable);
		});

		it('should support multiple independent runs', async () => {
			let counter = 0;
			const task = new FuturableTask((resolve) => {
				resolve(++counter);
			});
			const result1 = await task.run();
			const result2 = await task.run();
			expect(result1).toBe(1);
			expect(result2).toBe(2);
		});

		it('should use memoized result when enabled', async () => {
			let counter = 0;
			const task = new FuturableTask((resolve) => {
				resolve(++counter);
			}).memoize();
			const result1 = await task.run();
			const result2 = await task.run();
			expect(result1).toBe(1);
			expect(result2).toBe(1);
		});

		it('should not execute if task is cancelled', async () => {
			const executor = vi.fn((resolve: any) => {
				resolve('test');
			});
			const task = new FuturableTask(executor);
			task.cancel();
			const futurable = task.run();
			await vi.advanceTimersByTimeAsync(10);
			expect(executor).not.toHaveBeenCalled();
		});

		it('should pass external signal to execution', async () => {
			const controller = new AbortController();
			const task = new FuturableTask((resolve, reject, utils) => {
				if (utils.signal.aborted) {
					return;
				}
				resolve('test');
			});
			controller.abort();
			const futurable = task.run(controller.signal);
			await vi.advanceTimersByTimeAsync(10);
		});

		describe('runSafe', () => {
			it('should return success result on resolve', async () => {
				const task = new FuturableTask((resolve) => {
					resolve(42);
				});
				const result = await task.runSafe();
				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.data).toBe(42);
					expect(result.error).toBeNull();
				}
			});

			it('should return error result on reject', async () => {
				const error = new Error('test error');
				const task = new FuturableTask((_, reject) => {
					reject(error);
				});
				const result = await task.runSafe();
				expect(result.success).toBe(false);
				if (!result.success) {
					expect(result.error).toBe(error);
					expect(result.data).toBeNull();
				}
			});

			it('should work with overrideSignal', async () => {
				const controller = new AbortController();
				const task = new FuturableTask((resolve) => {
					resolve(42);
				});
				const result = await task.runSafe(controller.signal);
				expect(result.success).toBe(true);
			});
		});

		describe('memoize', () => {
			it('should cache the result', async () => {
				let counter = 0;
				const task = new FuturableTask((resolve) => {
					resolve(++counter);
				}).memoize();

				const result1 = await task.run();
				const result2 = await task.run();
				expect(result1).toBe(1);
				expect(result2).toBe(1);
				expect(counter).toBe(1);
			});

			it('should cache errors when catchErrors is true', async () => {
				let counter = 0;
				const task = new FuturableTask((_, reject) => {
					reject(new Error(`error ${++counter}`));
				}).memoize(true);

				await expect(task.run()).rejects.toThrow('error 1');
				await expect(task.run()).rejects.toThrow('error 1');
				expect(counter).toBe(1);
			});

			it('should not cache errors when catchErrors is false', async () => {
				let counter = 0;
				const task = new FuturableTask((resolve, reject) => {
					counter++;
					if (counter < 2) {
						reject('error');
					} else {
						resolve('success');
					}
				}).memoize(false);

				await expect(task.run()).rejects.toBe('error');
				await expect(task.run()).resolves.toBe('success');
				expect(counter).toBe(2);
			});

			it('should return a new FuturableTask', () => {
				const originalTask = new FuturableTask((resolve) => resolve(42));
				const memoizedTask = originalTask.memoize();
				expect(memoizedTask).not.toBe(originalTask);
				expect(memoizedTask).toBeInstanceOf(FuturableTask);
			});

			it('should clear memoized instance when it becomes aborted and create new one on next run', async () => {
				let counter = 0;
				const task = new FuturableTask((resolve) => {
					resolve(++counter);
				}).memoize();

				// First run - gets memoized
				const futurable1 = task.run();
				const result1 = await futurable1;
				expect(result1).toBe(1);

				// Cancel the futurable instance (not the task)
				futurable1.cancel();

				// Next run should detect the aborted instance and create a new one
				const result2 = await task.run();
				expect(result2).toBe(2); // New execution because previous was aborted
			});
		});

		describe('map', () => {
			it('should transform the result', async () => {
				const task = new FuturableTask<number>((resolve) => {
					resolve(5);
				}).map(x => x * 2);
				await expect(task.run()).resolves.toBe(10);
			});

			it('should support chaining', async () => {
				const task = new FuturableTask<number>((resolve) => {
					resolve(5);
				})
					.map(x => x * 2)
					.map(x => x + 3);
				await expect(task.run()).resolves.toBe(13);
			});

			it('should handle async mapper', async () => {
				const task = new FuturableTask<number>((resolve) => {
					resolve(5);
				}).map(async x => x * 2);
				await expect(task.run()).resolves.toBe(10);
			});

			it('should propagate errors from mapper', async () => {
				const task = new FuturableTask<number>((resolve) => {
					resolve(5);
				}).map(() => {
					throw new Error('mapper error');
				});
				await expect(task.run()).rejects.toThrow('mapper error');
			});

			it('should not execute if task is cancelled', async () => {
				const mapper = vi.fn((x: number) => x * 2);
				const task = new FuturableTask<number>((resolve) => {
					resolve(5);
				}).map(mapper);
				task.cancel();
				const futurable = task.run();
				await vi.advanceTimersByTimeAsync(10);
				expect(mapper).not.toHaveBeenCalled();
			});

			it('should pass signal to mapper', async () => {
				const task = new FuturableTask<number>((resolve) => {
					resolve(5);
				}).map((val, signal) => {
					expect(signal).toBeInstanceOf(AbortSignal);
					return val * 2;
				});
				await task.run();
			});
		});

		describe('flatMap', () => {
			it('should flatten nested tasks', async () => {
				const task = new FuturableTask<number>((resolve) => {
					resolve(5);
				}).flatMap(x => new FuturableTask<number>((resolve) => {
					resolve(x * 2);
				}));
				await expect(task.run()).resolves.toBe(10);
			});

			it('should support chaining', async () => {
				const task = new FuturableTask<number>((resolve) => {
					resolve(5);
				})
					.flatMap(x => FuturableTask.resolve(x * 2))
					.flatMap(x => FuturableTask.resolve(x + 3));
				await expect(task.run()).resolves.toBe(13);
			});

			it('should propagate errors from inner task', async () => {
				const task = new FuturableTask<number>((resolve) => {
					resolve(5);
				}).flatMap(() => FuturableTask.reject(new Error('inner error')));
				await expect(task.run()).rejects.toThrow('inner error');
			});
		});

		describe('andThen', () => {
			it('should sequence tasks', async () => {
				let order: number[] = [];
				const task1 = new FuturableTask((resolve) => {
					order.push(1);
					resolve('first');
				});
				const task2 = new FuturableTask((resolve) => {
					order.push(2);
					resolve('second');
				});
				const result = await task1.andThen(task2).run();
				expect(result).toBe('second');
				expect(order).toEqual([1, 2]);
			});

			it('should discard first result', async () => {
				const task1 = FuturableTask.resolve('ignored');
				const task2 = FuturableTask.resolve('returned');
				const result = await task1.andThen(task2).run();
				expect(result).toBe('returned');
			});
		});

		describe('tap', () => {
			it('should execute side effect on success', async () => {
				const sideEffect = vi.fn();
				const task = new FuturableTask((resolve) => {
					resolve(42);
				}).tap(sideEffect);
				await task.run();
				expect(sideEffect).toHaveBeenCalledWith(42);
			});

			it('should not change the result', async () => {
				const task = new FuturableTask((resolve) => {
					resolve(42);
				}).tap(() => 999);
				await expect(task.run()).resolves.toBe(42);
			});

			it('should not execute on error', async () => {
				const sideEffect = vi.fn();
				const task = new FuturableTask((_, reject) => {
					reject('error');
				}).tap(sideEffect);
				await expect(task.run()).rejects.toBe('error');
				expect(sideEffect).not.toHaveBeenCalled();
			});

			it('should handle async side effects', async () => {
				const sideEffect = vi.fn(async (x: number) => {
					await new Promise(resolve => setTimeout(resolve, 10));
					return x * 2;
				});
				const task = new FuturableTask<number>((resolve) => {
					resolve(42);
				}).tap(sideEffect);

				const promise = task.run();
				await vi.advanceTimersByTimeAsync(10);
				await promise;

				expect(sideEffect).toHaveBeenCalledWith(42);
			});
		});

		describe('tapError', () => {
			it('should execute side effect on error', async () => {
				const sideEffect = vi.fn();
				const task = new FuturableTask((_, reject) => {
					reject(new Error('test error'));
				}).tapError(sideEffect);
				await expect(task.run()).rejects.toThrow('test error');
				expect(sideEffect).toHaveBeenCalledWith(new Error('test error'));
			});

			it('should not execute on success', async () => {
				const sideEffect = vi.fn();
				const task = new FuturableTask((resolve) => {
					resolve(42);
				}).tapError(sideEffect);
				await task.run();
				expect(sideEffect).not.toHaveBeenCalled();
			});

			it('should propagate original error even if side effect throws', async () => {
				const originalError = new Error('original');
				const task = new FuturableTask((_, reject) => {
					reject(originalError);
				}).tapError(() => {
					throw new Error('side effect error');
				});
				await expect(task.run()).rejects.toThrow('original');
			});
		});

		describe('catchError', () => {
			it('should catch errors', async () => {
				const task = new FuturableTask((_, reject) => {
					reject(new Error('test error'));
				}).catchError((err) => FuturableTask.resolve(`caught: ${err.message}`));
				await expect(task.run()).resolves.toBe('caught: test error');
			});

			it('should not execute on success', async () => {
				const catchHandler = vi.fn();
				const task = new FuturableTask((resolve) => {
					resolve(42);
				}).catchError(catchHandler);
				await task.run();
				expect(catchHandler).not.toHaveBeenCalled();
			});
		});

		describe('orElse', () => {
			it('should provide alternative on error', async () => {
				const task = new FuturableTask<number>((_, reject) => {
					reject('error');
				}).orElse(() => FuturableTask.resolve(42));
				await expect(task.run()).resolves.toBe(42);
			});

			it('should not execute alternative on success', async () => {
				const alternative = vi.fn();
				const task = new FuturableTask((resolve) => {
					resolve(42);
				}).orElse(alternative);
				await task.run();
				expect(alternative).not.toHaveBeenCalled();
			});
		});

		describe('fallbackTo', () => {
			it('should provide default value on error', async () => {
				const task = new FuturableTask((_, reject) => {
					reject('error');
				}).fallbackTo(42);
				await expect(task.run()).resolves.toBe(42);
			});

			it('should not use fallback on success', async () => {
				const task = new FuturableTask((resolve) => {
					resolve(100);
				}).fallbackTo(42);
				await expect(task.run()).resolves.toBe(100);
			});
		});

		describe('ifElse', () => {
			it('should execute onTrue when condition is true', async () => {
				const task = FuturableTask.resolve(5).ifElse(
					x => x > 3,
					x => FuturableTask.resolve(`${x} is greater`),
					x => FuturableTask.resolve(`${x} is not greater`)
				);
				await expect(task.run()).resolves.toBe('5 is greater');
			});

			it('should execute onFalse when condition is false', async () => {
				const task = FuturableTask.resolve(2).ifElse(
					x => x > 3,
					x => FuturableTask.resolve(`${x} is greater`),
					x => FuturableTask.resolve(`${x} is not greater`)
				);
				await expect(task.run()).resolves.toBe('2 is not greater');
			});

			it('should support async condition', async () => {
				const task = FuturableTask.resolve(5).ifElse(
					async x => x > 3,
					x => FuturableTask.resolve('yes'),
					x => FuturableTask.resolve('no')
				);
				await expect(task.run()).resolves.toBe('yes');
			});
		});

		describe('fold', () => {
			it('should apply onSuccess on success', async () => {
				const task = FuturableTask.resolve(42).fold(
					err => FuturableTask.resolve(`error: ${err}`),
					val => FuturableTask.resolve(`success: ${val}`)
				);
				await expect(task.run()).resolves.toBe('success: 42');
			});

			it('should apply onFailure on error', async () => {
				const task = FuturableTask.reject('test error').fold(
					err => FuturableTask.resolve(`error: ${err}`),
					val => FuturableTask.resolve(`success: ${val}`)
				);
				await expect(task.run()).resolves.toBe('error: test error');
			});
		});

		describe('finally', () => {
			it('should execute callback on success', async () => {
				const callback = vi.fn();
				const task = new FuturableTask((resolve) => {
					resolve(42);
				}).finally(callback);
				await task.run();
				expect(callback).toHaveBeenCalled();
			});

			it('should execute callback on error', async () => {
				const callback = vi.fn();
				const task = new FuturableTask((_, reject) => {
					reject('error');
				}).finally(callback);
				await expect(task.run()).rejects.toBe('error');
				expect(callback).toHaveBeenCalled();
			});

			it('should not modify result', async () => {
				const task = new FuturableTask((resolve) => {
					resolve(42);
				}).finally(() => 999);
				await expect(task.run()).resolves.toBe(42);
			});
		});

		describe('timeout', () => {
			it('should timeout if execution takes too long', async () => {
				const task = new FuturableTask((resolve) => {
					setTimeout(() => resolve(42), 200);
				}).timeout(100);
				const promise = task.run();
				await vi.advanceTimersByTimeAsync(100);
				await expect(promise).rejects.toBe('TimeoutExceeded');
			});

			it('should resolve if completes in time', async () => {
				const task = new FuturableTask((resolve) => {
					setTimeout(() => resolve(42), 50);
				}).timeout(100);
				const promise = task.run();
				await vi.advanceTimersByTimeAsync(50);
				await expect(promise).resolves.toBe(42);
			});

			it('should use custom timeout reason', async () => {
				const task = new FuturableTask((resolve) => {
					setTimeout(() => resolve(42), 200);
				}).timeout(100, new Error('Custom timeout'));
				const promise = task.run();
				await vi.advanceTimersByTimeAsync(100);
				await expect(promise).rejects.toThrow('Custom timeout');
			});

			it('should clear timeout when task is cancelled', async () => {
				const task = new FuturableTask((resolve) => {
					setTimeout(() => resolve(42), 200);
				}).timeout(100);

				const promise = task.run();
				task.cancel(); // This should trigger utils.onCancel which clears the timeout
				await vi.advanceTimersByTimeAsync(100);
			});

			it('should clear timeout and reject when inner task rejects', async () => {
				const task = new FuturableTask((_, reject) => {
					setTimeout(() => reject(new Error('Task error')), 50);
				}).timeout(100);

				const promise = task.run();
				await vi.advanceTimersByTimeAsync(50);
				await expect(promise).rejects.toThrow('Task error');
			});
		});

		describe('delay', () => {
			it('should delay execution', async () => {
				const task = new FuturableTask((resolve) => {
					resolve(42);
				}).delay(100);
				const promise = task.run();
				await vi.advanceTimersByTimeAsync(100);
				await expect(promise).resolves.toBe(42);
			});

			it('should be cancellable', async () => {
				const task = new FuturableTask((resolve) => {
					resolve(42);
				}).delay(100);
				const promise = task.run();
				task.cancel();
				await vi.advanceTimersByTimeAsync(100);
			});
		});

		describe('retry', () => {
			it('should retry on failure', async () => {
				let attempts = 0;
				const task = new FuturableTask((resolve, reject) => {
					attempts++;
					if (attempts < 3) {
						reject('error');
					} else {
						resolve('success');
					}
				}).retry(3);
				await expect(task.run()).resolves.toBe('success');
				expect(attempts).toBe(3);
			});

			it('should fail after max retries', async () => {
				let attempts = 0;
				const task = new FuturableTask((_, reject) => {
					attempts++;
					reject(new Error('persistent error'));
				}).retry(2);
				await expect(task.run()).rejects.toThrow('persistent error');
				expect(attempts).toBe(3);
			});

			it('should not retry on success', async () => {
				let attempts = 0;
				const task = new FuturableTask((resolve) => {
					attempts++;
					resolve('success');
				}).retry(3);
				await expect(task.run()).resolves.toBe('success');
				expect(attempts).toBe(1);
			});

			it('should apply delay between retries', async () => {
				let attempts = 0;
				const task = new FuturableTask((resolve, reject) => {
					attempts++;
					if (attempts < 3) {
						reject('error');
					} else {
						resolve('success');
					}
				}).retry(3, 100);

				const promise = task.run();
				await vi.advanceTimersByTimeAsync(100);
				await vi.advanceTimersByTimeAsync(100);
				await expect(promise).resolves.toBe('success');
			});
		});

		describe('debounce', () => {
			it('should debounce executions', async () => {
				let counter = 0;
				const sourceTask = new FuturableTask((resolve) => {
					resolve(++counter);
				});
				const task = sourceTask.debounce(100);

				const run1 = task.run();
				await vi.advanceTimersByTimeAsync(50);
				const run2 = task.run();
				await vi.advanceTimersByTimeAsync(50);
				const run3 = task.run();
				await vi.advanceTimersByTimeAsync(100);

				expect(await run3).toBe(1);
			});

			it('should handle debounce on already debounced task', async () => {
				let counter = 0;
				const sourceTask = new FuturableTask((resolve) => {
					resolve(++counter);
				});
				const debounced1 = sourceTask.debounce(100);
				const debounced2 = debounced1.debounce(50);

				const run1 = debounced2.run();
				await vi.advanceTimersByTimeAsync(50);
				expect(await run1).toBe(1);
			});

			it('should clear timeout when cancelled during debounce wait', async () => {
				let counter = 0;
				const sourceTask = new FuturableTask((resolve) => {
					resolve(++counter);
				});
				const task = sourceTask.debounce(100);

				const run1 = task.run();
				await vi.advanceTimersByTimeAsync(50);

				// Cancel while still in debounce period
				task.cancel(); // This triggers utils.onCancel which clears timeoutId

				await vi.advanceTimersByTimeAsync(100);
				// The task should not execute because it was cancelled
				expect(counter).toBe(0);
			});
		});

		describe('throttle', () => {
			it('should throttle executions', async () => {
				let counter = 0;
				const task = new FuturableTask((resolve) => {
					resolve(++counter);
				}).throttle(100);

				const run1 = task.run();
				await vi.advanceTimersByTimeAsync(10);
				expect(await run1).toBe(1);

				const run2 = task.run();
				expect(await run2).toBe(1);
			});

			it('should allow new execution after cooldown', async () => {
				let counter = 0;
				const task = new FuturableTask((resolve) => {
					resolve(++counter);
				}).throttle(100);

				const run1 = task.run();
				await vi.advanceTimersByTimeAsync(100);
				expect(await run1).toBe(1);

				const run2 = task.run();
				await vi.advanceTimersByTimeAsync(10);
				expect(await run2).toBe(2);
			});
		});

		describe('zip', () => {
			it('should combine results into tuple', async () => {
				const task1 = FuturableTask.resolve(1);
				const task2 = FuturableTask.resolve('two');
				const result = await task1.zip(task2).run();
				expect(result).toEqual([1, 'two']);
			});

			it('should reject if any task fails', async () => {
				const task1 = FuturableTask.resolve(1);
				const task2 = FuturableTask.reject('error');
				await expect(task1.zip(task2).run()).rejects.toBe('error');
			});
		});

		describe('zipWith', () => {
			it('should combine results with function', async () => {
				const task1 = FuturableTask.resolve(5);
				const task2 = FuturableTask.resolve(3);
				const result = await task1.zipWith(task2, (a, b) => a + b).run();
				expect(result).toBe(8);
			});
		});

		describe('bimap', () => {
			it('should transform success value', async () => {
				const task = FuturableTask.resolve(42).bimap(
					x => x * 2,
					err => new Error(`Failed: ${err}`)
				);
				await expect(task.run()).resolves.toBe(84);
			});

			it('should transform error value', async () => {
				const task = FuturableTask.reject('original').bimap(
					x => x * 2,
					err => `Failed: ${err}`
				);
				await expect(task.run()).rejects.toBe('Failed: original');
			});
		});

		describe('repeat', () => {
			it('should repeat task n times', async () => {
				let counter = 0;
				const task = new FuturableTask((resolve) => {
					resolve(++counter);
				}).repeat(3);
				const result = await task.run();
				expect(result).toEqual([1, 2, 3]);
			});

			it('should handle zero repetitions', async () => {
				const task = FuturableTask.resolve(42).repeat(0);
				const result = await task.run();
				expect(result).toEqual([]);
			});
		});

		describe('pipe', () => {
			it('should compose transformations', async () => {
				const task = FuturableTask.resolve(5).pipe(
					t => t.map(x => x * 2),
					t => t.map(x => x + 3)
				);
				await expect(task.run()).resolves.toBe(13);
			});

			it('should support multiple transformations', async () => {
				const task = FuturableTask.resolve(5).pipe(
					t => t.map(x => x * 2),
					t => t.map(x => x + 3),
					t => t.map(x => x.toString())
				);
				await expect(task.run()).resolves.toBe('13');
			});
		});

		describe('fetch (instance method)', () => {
			it('should create fetch task from string url', async () => {
				global.fetch = vi.fn().mockResolvedValue({ ok: true });
				const task = FuturableTask.resolve('endpoint')
					.fetch(endpoint => `https://api.example.com/${endpoint}`);
				await task.run();
				expect(global.fetch).toHaveBeenCalledWith(
					'https://api.example.com/endpoint',
					expect.any(Object)
				);
			});

			it('should create fetch task from static url', async () => {
				global.fetch = vi.fn().mockResolvedValue({ ok: true });
				const task = FuturableTask.resolve('ignored')
					.fetch('https://api.example.com/data');
				await task.run();
				expect(global.fetch).toHaveBeenCalledWith(
					'https://api.example.com/data',
					expect.any(Object)
				);
			});

			it('should handle fetch options', async () => {
				global.fetch = vi.fn().mockResolvedValue({ ok: true });
				const task = FuturableTask.resolve('data')
					.fetch('https://api.example.com', { method: 'POST' });
				await task.run();
				expect(global.fetch).toHaveBeenCalledWith(
					'https://api.example.com',
					expect.objectContaining({ method: 'POST' })
				);
			});
		});

		describe('Static: of', () => {
			it('should create task from value', async () => {
				const task = FuturableTask.of(42);
				await expect(task.run()).resolves.toBe(42);
			});

			it('should create task from function', async () => {
				const task = FuturableTask.of(() => 42);
				await expect(task.run()).resolves.toBe(42);
			});

			it('should handle async function', async () => {
				const task = FuturableTask.of(async () => 42);
				await expect(task.run()).resolves.toBe(42);
			});

			it('should pass utils to function', async () => {
				const task = FuturableTask.of((utils) => {
					expect(utils.signal).toBeInstanceOf(AbortSignal);
					return 42;
				});
				await task.run();
			});
		});

		describe('Static: resolve', () => {
			it('should create resolved task', async () => {
				const task = FuturableTask.resolve(42);
				await expect(task.run()).resolves.toBe(42);
			});
		});

		describe('Static: reject', () => {
			it('should create rejected task', async () => {
				const task = FuturableTask.reject('error');
				await expect(task.run()).rejects.toBe('error');
			});
		});

		describe('Static: all', () => {
			it('should wait for all tasks', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.resolve(2),
					FuturableTask.resolve(3)
				];
				const result = await FuturableTask.all(tasks).run();
				expect(result).toEqual([1, 2, 3]);
			});

			it('should reject if any task rejects', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.reject('error'),
					FuturableTask.resolve(3)
				];
				await expect(FuturableTask.all(tasks).run()).rejects.toBe('error');
			});

			it('should handle empty array', async () => {
				const result = await FuturableTask.all([]).run();
				expect(result).toEqual([]);
			});
		});

		describe('Static: allSettled', () => {
			it('should wait for all tasks to settle', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.reject('error'),
					FuturableTask.resolve(3)
				];
				const results = await FuturableTask.allSettled(tasks).run();
				expect(results).toEqual([
					{ status: 'fulfilled', value: 1 },
					{ status: 'rejected', reason: 'error' },
					{ status: 'fulfilled', value: 3 }
				]);
			});

			it('should handle empty array', async () => {
				const result = await FuturableTask.allSettled([]).run();
				expect(result).toEqual([]);
			});
		});

		describe('Static: any', () => {
			it('should resolve with first successful task', async () => {
				const tasks = [
					new FuturableTask((resolve) => setTimeout(() => resolve(1), 100)),
					new FuturableTask((resolve) => setTimeout(() => resolve(2), 50)),
					new FuturableTask((resolve) => setTimeout(() => resolve(3), 75))
				];
				const promise = FuturableTask.any(tasks).run();
				await vi.advanceTimersByTimeAsync(50);
				await expect(promise).resolves.toBe(2);
			});

			it('should reject if all tasks reject', async () => {
				const tasks = [
					FuturableTask.reject('error1'),
					FuturableTask.reject('error2')
				];
				await expect(FuturableTask.any(tasks).run()).rejects.toThrow();
			});
		});

		describe('Static: race', () => {
			it('should resolve with first settled task', async () => {
				const tasks = [
					new FuturableTask((resolve) => setTimeout(() => resolve(1), 100)),
					new FuturableTask((resolve) => setTimeout(() => resolve(2), 50))
				];
				const promise = FuturableTask.race(tasks).run();
				await vi.advanceTimersByTimeAsync(50);
				await expect(promise).resolves.toBe(2);
			});

			it('should reject with first rejection', async () => {
				const tasks = [
					new FuturableTask((resolve) => setTimeout(() => resolve(1), 100)),
					new FuturableTask((_, reject) => setTimeout(() => reject('error'), 50))
				];
				const promise = FuturableTask.race(tasks).run();
				await vi.advanceTimersByTimeAsync(50);
				await expect(promise).rejects.toBe('error');
			});
		});

		describe('Static: delay', () => {
			it('should create delay task', async () => {
				const task = FuturableTask.delay(100);
				const promise = task.run();
				await vi.advanceTimersByTimeAsync(100);
				await expect(promise).resolves.toBeUndefined();
			});

			it('should be cancellable', async () => {
				const task = FuturableTask.delay(100);
				const promise = task.run();
				task.cancel();
				await vi.advanceTimersByTimeAsync(100);
			});
		});

		describe('Static: fromEvent', () => {
			it('should create task from event', async () => {
				const target = new EventTarget();
				const task = FuturableTask.fromEvent(target, 'test');
				const promise = task.run();

				const event = new Event('test');
				target.dispatchEvent(event);

				await expect(promise).resolves.toBe(event);
			});

			it('should remove listener on cancel', () => {
				const target = new EventTarget();
				const task = FuturableTask.fromEvent(target, 'test');
				task.run();
				task.cancel();
			});
		});

		describe('Static: sequence', () => {
			it('should execute tasks sequentially', async () => {
				const order: number[] = [];
				const tasks = [
					FuturableTask.of(() => { order.push(1); return 1; }),
					FuturableTask.of(() => { order.push(2); return 2; }),
					FuturableTask.of(() => { order.push(3); return 3; })
				];
				const result = await FuturableTask.sequence(tasks).run();
				expect(result).toEqual([1, 2, 3]);
				expect(order).toEqual([1, 2, 3]);
			});

			it('should stop on first error', async () => {
				const order: number[] = [];
				const tasks = [
					FuturableTask.of(() => { order.push(1); return 1; }),
					FuturableTask.of(() => { order.push(2); throw new Error('error'); }),
					FuturableTask.of(() => { order.push(3); return 3; })
				];
				await expect(FuturableTask.sequence(tasks).run()).rejects.toThrow('error');
				expect(order).toEqual([1, 2]);
			});
		});

		describe('Static: parallel', () => {
			it('should execute tasks in parallel with limit', async () => {
				let activeCount = 0;
				let maxActive = 0;

				const createTask = () => new FuturableTask((resolve) => {
					activeCount++;
					maxActive = Math.max(maxActive, activeCount);
					setTimeout(() => {
						activeCount--;
						resolve(true);
					}, 50);
				});

				const tasks = Array.from({ length: 10 }, () => createTask());
				const promise = FuturableTask.parallel(tasks, 3).run();

				await vi.advanceTimersByTimeAsync(50);
				await vi.advanceTimersByTimeAsync(50);
				await vi.advanceTimersByTimeAsync(50);
				await vi.advanceTimersByTimeAsync(50);

				await promise;
				expect(maxActive).toBeLessThanOrEqual(3);
			});

			it('should reject if any task rejects', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.reject('error'),
					FuturableTask.resolve(3)
				];
				await expect(FuturableTask.parallel(tasks, 2).run()).rejects.toBe('error');
			});

			it('should cancel all running tasks when one fails', async () => {
				const cancelCallback1 = vi.fn();
				const cancelCallback2 = vi.fn();

				const task1 = new FuturableTask((resolve) => {
					setTimeout(() => resolve(1), 100);
				}).onCancel(cancelCallback1);

				const task2 = new FuturableTask((_, reject) => {
					setTimeout(() => reject('error'), 50);
				});

				const task3 = new FuturableTask((resolve) => {
					setTimeout(() => resolve(3), 100);
				}).onCancel(cancelCallback2);

				const promise = FuturableTask.parallel([task1, task2, task3], 3).run();
				await vi.advanceTimersByTimeAsync(50);

				await expect(promise).rejects.toBe('error');
				// When one task fails, all running tasks should be cancelled
			});

			it('should handle cancellation of parallel tasks', async () => {
				const tasks = Array.from({ length: 5 }, (_, i) =>
					new FuturableTask((resolve) => {
						setTimeout(() => resolve(i), 100);
					})
				);

				const parallelTask = FuturableTask.parallel(tasks, 2);
				const promise = parallelTask.run();

				await vi.advanceTimersByTimeAsync(10);
				parallelTask.cancel(); // This sets failed = true and cancels running tasks

				await vi.advanceTimersByTimeAsync(200);
			});

			it('should prevent further task processing after failure', async () => {
				// This test ensures that when a task fails and sets failed=true,
				// other completing tasks that call next() will return immediately
				const task1 = new FuturableTask((resolve) => {
					setTimeout(() => resolve(1), 50);
				});
				const task2 = new FuturableTask((_, reject) => {
					setTimeout(() => reject('error'), 25); // Fails first
				});
				const task3 = new FuturableTask((resolve) => {
					setTimeout(() => resolve(3), 75); // Completes after failure
				});
				const task4 = new FuturableTask((resolve) => {
					setTimeout(() => resolve(4), 100);
				});

				const promise = FuturableTask.parallel([task1, task2, task3, task4], 3).run();

				// task2 fails at 25ms, setting failed=true
				await vi.advanceTimersByTimeAsync(25);

				// task1 completes at 50ms and calls next(), but should return immediately because failed=true
				await vi.advanceTimersByTimeAsync(25);

				// task3 completes at 75ms and calls next(), but should also return immediately
				await vi.advanceTimersByTimeAsync(25);

				await expect(promise).rejects.toBe('error');
			});
		});

		describe('Static: createLimiter', () => {
			it('should create a limiter with correct properties', () => {
				const limiter = FuturableTask.createLimiter(2);
				expect(typeof limiter).toBe('function');
				expect(limiter.concurrency).toBe(2);
				expect(limiter.activeCount).toBe(0);
				expect(limiter.pendingCount).toBe(0);
			});

			it('should limit concurrent executions', async () => {
				const limiter = FuturableTask.createLimiter(2);
				let activeCount = 0;
				let maxActive = 0;

				const createTask = () => new FuturableTask((resolve) => {
					activeCount++;
					maxActive = Math.max(maxActive, activeCount);
					setTimeout(() => {
						activeCount--;
						resolve(true);
					}, 100);
				});

				const tasks = [
					limiter(createTask()),
					limiter(createTask()),
					limiter(createTask()),
					limiter(createTask())
				];

				const promise = FuturableTask.all(tasks).run();
				await vi.advanceTimersByTimeAsync(100);
				await vi.advanceTimersByTimeAsync(100);
				await promise;

				expect(maxActive).toBe(2);
			});

			it('should track active and pending counts', async () => {
				const limiter = FuturableTask.createLimiter(1);
				const task1 = limiter(new FuturableTask((resolve) => {
					setTimeout(() => resolve(1), 100);
				}));
				const task2 = limiter(new FuturableTask((resolve) => {
					setTimeout(() => resolve(2), 100);
				}));

				task1.run();
				task2.run();

				await vi.advanceTimersByTimeAsync(10);
				expect(limiter.activeCount).toBe(1);
				expect(limiter.pendingCount).toBe(1);

				await vi.advanceTimersByTimeAsync(100);
				expect(limiter.activeCount).toBe(1);
				expect(limiter.pendingCount).toBe(0);

				await vi.advanceTimersByTimeAsync(100);
				expect(limiter.activeCount).toBe(0);
				expect(limiter.pendingCount).toBe(0);
			});

			it('should call event hooks', async () => {
				const events = {
					onActive: vi.fn(),
					onCompleted: vi.fn(),
					onError: vi.fn(),
					onIdle: vi.fn()
				};

				const limiter = FuturableTask.createLimiter(1, events);
				const task = limiter(FuturableTask.resolve(42));

				await task.run();
				await vi.advanceTimersByTimeAsync(10);

				expect(events.onActive).toHaveBeenCalled();
				expect(events.onCompleted).toHaveBeenCalledWith(42);
				expect(events.onIdle).toHaveBeenCalled();
				expect(events.onError).not.toHaveBeenCalled();
			});

			it('should call onError hook on failure', async () => {
				const events = {
					onError: vi.fn()
				};

				const limiter = FuturableTask.createLimiter(1, events);
				const task = limiter(FuturableTask.reject('error'));

				await expect(task.run()).rejects.toBe('error');
				await vi.advanceTimersByTimeAsync(10);

				expect(events.onError).toHaveBeenCalledWith('error');
			});

			it('should remove waiting task from queue when cancelled', async () => {
				const limiter = FuturableTask.createLimiter(1);

				// First task takes up the slot
				const task1 = limiter(new FuturableTask((resolve) => {
					setTimeout(() => resolve(1), 100);
				}));

				// Second task goes to queue
				const task2 = limiter(new FuturableTask((resolve) => {
					setTimeout(() => resolve(2), 100);
				}));

				// Third task also goes to queue
				const task3 = limiter(new FuturableTask((resolve) => {
					setTimeout(() => resolve(3), 100);
				}));

				task1.run();
				task2.run();
				const run3 = task3.run();

				await vi.advanceTimersByTimeAsync(10);

				expect(limiter.activeCount).toBe(1);
				expect(limiter.pendingCount).toBe(2);

				// Cancel task3 while it's waiting in queue
				task3.cancel(); // This should trigger the onCancel that removes from queue

				expect(limiter.pendingCount).toBe(1); // One less in queue

				await vi.advanceTimersByTimeAsync(200);
			});
		});

		describe('Static: compose', () => {
			it('should compose operators', async () => {
				const double = (t: FuturableTask<number>) => t.map(x => x * 2);
				const addThree = (t: FuturableTask<number>) => t.map(x => x + 3);

				const task = FuturableTask.compose(
					FuturableTask.resolve(5),
					double,
					addThree
				);

				await expect(task.run()).resolves.toBe(13);
			});
		});

		describe('Static: filter', () => {
			it('should filter tasks by predicate', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.resolve(2),
					FuturableTask.resolve(3),
					FuturableTask.resolve(4),
					FuturableTask.resolve(5)
				];

				const result = await FuturableTask.filter(tasks, x => x % 2 === 0).run();
				expect(result).toEqual([2, 4]);
			});

			it('should support async predicate', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.resolve(2),
					FuturableTask.resolve(3)
				];

				const result = await FuturableTask.filter(tasks, async x => x > 1).run();
				expect(result).toEqual([2, 3]);
			});

			it('should reject if a task fails', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.reject(new Error('Task failed')),
					FuturableTask.resolve(3)
				];

				await expect(
					FuturableTask.filter(tasks, x => x > 0).run()
				).rejects.toThrow('Task failed');
			});

			it('should reject if predicate throws', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.resolve(2),
					FuturableTask.resolve(3)
				];

				await expect(
					FuturableTask.filter(tasks, (x) => {
						if (x === 2) throw new Error('Predicate error');
						return true;
					}).run()
				).rejects.toThrow('Predicate error');
			});
		});

		describe('Static: reduce', () => {
			it('should reduce tasks sequentially', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.resolve(2),
					FuturableTask.resolve(3)
				];
				const result = await FuturableTask.reduce(
					tasks,
					(acc, val) => acc + val,
					0
				).run();
				expect(result).toBe(6);
			});

			it('should handle async reducer', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.resolve(2),
					FuturableTask.resolve(3)
				];
				const result = await FuturableTask.reduce(
					tasks,
					async (acc, val) => acc + val,
					0
				).run();
				expect(result).toBe(6);
			});

			it('should stop on first error', async () => {
				const tasks = [
					FuturableTask.resolve(1),
					FuturableTask.reject('error'),
					FuturableTask.resolve(3)
				];
				await expect(
					FuturableTask.reduce(tasks, (acc, val) => acc + val, 0).run()
				).rejects.toBe('error');
			});

			it('should pass index to reducer', async () => {
				const tasks = [
					FuturableTask.resolve(10),
					FuturableTask.resolve(20),
					FuturableTask.resolve(30)
				];
				const result = await FuturableTask.reduce(
					tasks,
					(acc, val, idx) => acc + val + idx,
					0
				).run();
				expect(result).toBe(63);
			});
		});

		describe('Static: whilst', () => {
			it('should repeat while condition is true', async () => {
				let counter = 0;
				const task = FuturableTask.of(() => ++counter);
				const result = await FuturableTask.whilst(
					() => counter < 5,
					task
				).run();
				expect(result).toEqual([1, 2, 3, 4, 5]);
			});

			it('should support async condition', async () => {
				let counter = 0;
				const task = FuturableTask.of(() => ++counter);
				const result = await FuturableTask.whilst(
					async () => counter < 3,
					task
				).run();
				expect(result).toEqual([1, 2, 3]);
			});

			it('should return empty array if condition is false initially', async () => {
				const task = FuturableTask.resolve(42);
				const result = await FuturableTask.whilst(() => false, task).run();
				expect(result).toEqual([]);
			});

			it('should stop on error', async () => {
				let counter = 0;
				const task = new FuturableTask((resolve, reject) => {
					counter++;
					if (counter === 3) {
						reject('error');
					} else {
						resolve(counter);
					}
				});
				await expect(
					FuturableTask.whilst(() => counter < 5, task).run()
				).rejects.toBe('error');
			});
		});

		describe('Static: until', () => {
			it('should repeat until condition is true', async () => {
				let counter = 0;
				const task = FuturableTask.of(() => ++counter);
				const result = await FuturableTask.until(
					() => counter >= 5,
					task
				).run();
				expect(result).toEqual([1, 2, 3, 4, 5]);
			});

			it('should support async condition', async () => {
				let counter = 0;
				const task = FuturableTask.of(() => ++counter);
				const result = await FuturableTask.until(
					async () => counter >= 3,
					task
				).run();
				expect(result).toEqual([1, 2, 3]);
			});
		});

		describe('Static: times', () => {
			it('should execute n times', async () => {
				const result = await FuturableTask.times(
					5,
					i => FuturableTask.resolve(i * 2)
				).run();
				expect(result).toEqual([0, 2, 4, 6, 8]);
			});

			it('should handle zero iterations', async () => {
				const result = await FuturableTask.times(
					0,
					i => FuturableTask.resolve(i)
				).run();
				expect(result).toEqual([]);
			});

			it('should stop on error', async () => {
				await expect(
					FuturableTask.times(
						5,
						i => i === 2 ? FuturableTask.reject('error') : FuturableTask.resolve(i)
					).run()
				).rejects.toBe('error');
			});
		});

		describe('Static: traverse', () => {
			it('should map and execute sequentially', async () => {
				const values = [1, 2, 3, 4, 5];
				const result = await FuturableTask.traverse(
					values,
					v => FuturableTask.resolve(v * 2)
				).run();
				expect(result).toEqual([2, 4, 6, 8, 10]);
			});

			it('should pass index to mapper', async () => {
				const values = ['a', 'b', 'c'];
				const result = await FuturableTask.traverse(
					values,
					(v, i) => FuturableTask.resolve(`${i}: ${v}`)
				).run();
				expect(result).toEqual(['0: a', '1: b', '2: c']);
			});

			it('should handle empty array', async () => {
				const result = await FuturableTask.traverse(
					[],
					v => FuturableTask.resolve(v)
				).run();
				expect(result).toEqual([]);
			});
		});

		describe('Static: fetch', () => {
			it('should create fetch task', async () => {
				global.fetch = vi.fn().mockResolvedValue({ ok: true, data: 'test' });
				const task = FuturableTask.fetch('https://api.example.com/data');
				const result = await task.run();
				expect(result).toEqual({ ok: true, data: 'test' });
				expect(global.fetch).toHaveBeenCalledWith(
					'https://api.example.com/data',
					expect.objectContaining({})
				);
			});

			it('should handle fetch error', async () => {
				const error = new Error('Network error');
				global.fetch = vi.fn().mockRejectedValue(error);
				const task = FuturableTask.fetch('https://api.example.com/data');
				await expect(task.run()).rejects.toThrow('Network error');
			});

			it('should pass options to fetch', async () => {
				global.fetch = vi.fn().mockResolvedValue({ ok: true });
				const opts = { method: 'POST', body: JSON.stringify({ test: 'data' }) };
				const task = FuturableTask.fetch('https://api.example.com/data', opts);
				await task.run();
				expect(global.fetch).toHaveBeenCalledWith(
					'https://api.example.com/data',
					expect.objectContaining(opts)
				);
			});
		});

		describe('Edge cases', () => {
			it('should handle cancellation during execution', async () => {
				let executed = false;
				const task = new FuturableTask((resolve, _, utils) => {
					utils.delay(() => {
						executed = true;
						resolve(42);
					}, 100);
				});
				const run = task.run();
				await vi.advanceTimersByTimeAsync(50);
				task.cancel();
				await vi.advanceTimersByTimeAsync(100);
				expect(executed).toBe(false);
			});

			it('should handle multiple cancellations', () => {
				const callback = vi.fn();
				const task = new FuturableTask((resolve) => {
					resolve(42);
				}).onCancel(callback);
				task.cancel();
				task.cancel();
				task.cancel();
				expect(callback).toHaveBeenCalledTimes(1);
			});

			it('should handle chained transformations', async () => {
				const task = FuturableTask.resolve(5)
					.map(x => x * 2)
					.flatMap(x => FuturableTask.resolve(x + 3))
					.map(x => x.toString())
					.tap(console.log);
				await expect(task.run()).resolves.toBe('13');
			});
		});

		describe('Type safety', () => {
			it('should maintain correct types through chain', async () => {
				const result: string = await FuturableTask.resolve(5)
					.map(val => val * 2)
					.map(val => val.toString())
					.run();
				expect(result).toBe('10');
			});

			it('should handle SafeResult discriminated union', async () => {
				const result = await FuturableTask.resolve(42).runSafe();
				if (result.success) {
					const value: number = result.data;
					expect(value).toBe(42);
				} else {
					const error: unknown = result.error;
					expect(error).toBeDefined();
				}
			});
		});
	});
});