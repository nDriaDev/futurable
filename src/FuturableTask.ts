import { Futurable, FuturableExecutor, FuturableUtils } from ".";

/**
 * Configuration options for memoization behavior.
 *
 * @template T - The type of value being memoized
 *
 * @property enabled - Whether memoization is active
 * @property catchErrors - If true, caches the result even when the execution rejects
 * @property instance - The cached Futurable instance (if memoization is active)
 */
export type MemoizeOptions<T> = {
	enabled: boolean;
	catchErrors?: boolean;
	instance?: Futurable<T>;
};

/**
 * Event hooks for monitoring task limiter lifecycle.
 * All hooks are optional and provide insight into task execution flow.
 *
 * @property onActive - Called when a task starts executing
 * @property onCompleted - Called when a task completes successfully with its result
 * @property onError - Called when a task fails with an error
 * @property onIdle - Called when all tasks have completed and the queue is empty
 *
 * @example
 * ```typescript
 * const events: LimiterEvents = {
 *   onActive: (task) => console.log('Task started:', task),
 *   onCompleted: (result) => console.log('Task completed:', result),
 *   onError: (error) => console.error('Task failed:', error),
 *   onIdle: () => console.log('All tasks finished')
 * };
 * ```
 */
export interface LimiterEvents {
	onActive?: (task: any) => void;
	onCompleted?: (result: any) => void;
	onError?: (error: any) => void;
	onIdle?: () => void;
}

/**
 * A higher-order function that wraps tasks with concurrency limiting.
 *
 * Acts as both a function and an object with readonly properties.
 * The function takes a task and returns a new task that respects the concurrency limit.
 *
 * @property activeCount - Number of tasks currently executing
 * @property pendingCount - Number of tasks waiting in the queue
 * @property concurrency - Maximum number of concurrent tasks allowed
 *
 * @example
 * ```typescript
 * const limiter = FuturableTask.createLimiter(2);
 *
 * console.log(limiter.concurrency); // 2
 * console.log(limiter.activeCount);  // 0
 * console.log(limiter.pendingCount); // 0
 *
 * const limitedTask = limiter(myTask);
 * ```
 */
export type FuturableTaskLimiter = (<T>(task: FuturableTask<T>) => FuturableTask<T>) & {
	readonly activeCount: number;
	readonly pendingCount: number;
	readonly concurrency: number;
};

/**
 * Lazy computation wrapper for deferred execution.
 *
 * Unlike Futurable (which extends Promise and is eager), FuturableTask is lazy:
 * - Creation doesn't trigger execution
 * - Can be composed without side effects
 * - Execution happens only when run() is called
 * - Can be run multiple times (each run is independent)
 * - Provides functional composition methods
 * - Supports cancellation at both task and execution level
 *
 * @template T - The type of value this task will eventually produce
 *
 * @example
 * ```typescript
 * // Creating a task doesn't execute it
 * const task = FuturableTask.of(() => {
 *   console.log('Executing!');
 *   return fetch('/api/data');
 * });
 * // Nothing logged yet
 *
 * const result1 = await task.run(); // Logs: "Executing!" and fetches
 * const result2 = await task.run(); // Logs: "Executing!" again (independent execution)
 * ```
 *
 * @example
 * ```typescript
 * // Functional composition without execution
 * const pipeline = FuturableTask
 *   .of(() => fetch('/users'))
 *   .map(res => res.json())
 *   .map(users => users.filter(u => u.active))
 *   .retry(3)
 *   .timeout(5000);
 *
 * // Only now does execution happen
 * const activeUsers = await pipeline.run();
 * ```
 *
 * @example
 * ```typescript
 * // Cancellation support
 * const task = FuturableTask.of(() => longOperation())
 *   .onCancel(() => console.log('Cleanup'));
 *
 * const run = task.run();
 * task.cancel(); // Logs: "Cleanup", cancels the operation
 * ```
 */
export class FuturableTask<T> {
	/**
	 * Internal AbortController that manages task cancellation.
	 * Created in the constructor and used to abort all executions of this task.
	 *
	 * @private
	 * @readonly
	 */
	private readonly controller: AbortController;

	/**
	 * Array of callbacks to execute when the task is cancelled.
	 * These callbacks are executed eagerly (even if the task was never run).
	 *
	 * @private
	 * @readonly
	 */
	private readonly cancelCallbacks: (() => void)[] = [];

	/**
	 * Configuration object for memoization behavior.
	 * When enabled, caches the first execution result and reuses it.
	 *
	 * @private
	 * @readonly
	 */
	private readonly memoizeOptions: MemoizeOptions<T> = {
		enabled: false,
		catchErrors: false
	};

	/**
	 * Reference to the source task (if this task is debounced).
	 * When calling debounce() on an already debounced task, this points to the original source.
	 *
	 * @private
	 */
	private sourceTask?: FuturableTask<T>;

	/**
	 * Creates a new FuturableTask.
	 *
	 * The executor function is NOT invoked until run() is called.
	 * If an external signal is provided, aborting it will also cancel this task.
	 *
	 * @param executor - The executor function that defines the computation.
	 *                   Receives resolve, reject, and utils (with signal, onCancel, delay, sleep, fetch, etc.)
	 * @param externalSignal - Optional AbortSignal that will cancel this task when aborted.
	 *                         Useful for coordinating cancellation with parent operations.
	 *
	 * @example
	 * ```typescript
	 * // Basic task
	 * const task = new FuturableTask((resolve, reject, utils) => {
	 *   setTimeout(() => resolve('done'), 1000);
	 * });
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With cancellation support
	 * const task = new FuturableTask((resolve, reject, utils) => {
	 *   const timeoutId = setTimeout(() => resolve('done'), 5000);
	 *
	 *   utils.onCancel(() => {
	 *     console.log('Cancelled!');
	 *     clearTimeout(timeoutId);
	 *   });
	 * });
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With external signal
	 * const controller = new AbortController();
	 * const task = new FuturableTask((res) => {
	 *   res('value');
	 * }, controller.signal);
	 *
	 * controller.abort(); // Cancels the task
	 * ```
	 */
	constructor(private readonly executor: FuturableExecutor<T>, externalSignal?: AbortSignal) {
		this.controller = new AbortController();

		// Register task-level cancellation callbacks
		this.controller.signal.addEventListener('abort', () => {
			this.cancelCallbacks.forEach(cb => cb());
		}, { once: true });

		// Link external signal if provided
		if (externalSignal) {
			if (externalSignal.aborted) {
				this.controller.abort();
			} else {
				externalSignal.addEventListener("abort", () => this.controller.abort(), { once: true });
			}
		}
	}

	/**
	 * Returns the internal AbortSignal for this task.
	 *
	 * This signal is aborted when cancel() is called on the task.
	 * All executions created by run() will listen to this signal.
	 *
	 * @returns The internal AbortSignal
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => fetch('/api/data'));
	 *
	 * console.log(task.signal.aborted); // false
	 * task.cancel();
	 * console.log(task.signal.aborted); // true
	 * ```
	 */
	get signal(): AbortSignal {
		return this.controller.signal;
	}

	/**
	 * Cancels all running and future executions of this task.
	 *
	 * This will:
	 * 1. Abort the internal signal
	 * 2. Execute all registered task-level onCancel callbacks
	 * 3. Cancel all Futurables created by run() that haven't completed yet
	 * 4. Prevent new executions from starting (they will be pending)
	 *
	 * Note: This is idempotent - calling it multiple times has no additional effect.
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => longRunningOperation());
	 * const run1 = task.run();
	 * const run2 = task.run();
	 *
	 * task.cancel(); // Cancels both run1 and run2
	 *
	 * const run3 = task.run(); // This will be pending (never resolves)
	 * ```
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => fetch('/api'))
	 *   .onCancel(() => console.log('Task cancelled'));
	 *
	 * task.cancel(); // Logs: "Task cancelled"
	 * task.cancel(); // Does nothing (already cancelled)
	 * ```
	 */
	cancel(): void {
		if (!this.controller.signal.aborted) {
			this.controller.abort();
		}
	}

	/**
	 * Registers a callback to be executed when the task is cancelled.
	 *
	 * IMPORTANT: This is an eager callback - it executes when task.cancel() is called,
	 * even if the task has never been run. This is different from registering callbacks
	 * inside the executor with utils.onCancel, which are only called if the task was
	 * actively running when cancelled.
	 *
	 * Multiple callbacks can be registered and will execute in order.
	 *
	 * @param cb - Callback to execute on cancellation
	 * @returns The same FuturableTask instance for chaining
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => fetch('/api/data'))
	 *   .onCancel(() => console.log('Task cancelled'))
	 *   .onCancel(() => console.log('Cleanup complete'));
	 *
	 * task.cancel();
	 * // Logs: "Task cancelled"
	 * // Logs: "Cleanup complete"
	 * // (even without calling run())
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Cleanup external resources
	 * const ws = new WebSocket('ws://...');
	 *
	 * const task = FuturableTask.of(() => fetchFromWebSocket(ws))
	 *   .onCancel(() => {
	 *     console.log('Closing WebSocket');
	 *     ws.close();
	 *   });
	 *
	 * task.cancel(); // Closes WebSocket even if never run
	 * ```
	 */
	onCancel(cb: () => void): this {
		this.cancelCallbacks.push(cb);
		return this;
	}

	/**
	 * Executes the task and returns a Futurable.
	 *
	 * Each call to run() creates a new independent execution. The returned Futurable
	 * can be cancelled in two ways:
	 * 1. By calling task.cancel() - cancels all running executions
	 * 2. By calling futurable.cancel() - cancels only this specific execution
	 * 3. By aborting the overrideSignal - cancels only this specific execution
	 *
	 * The execution uses a composite signal that listens to:
	 * - The task's internal signal (from task.cancel())
	 * - The overrideSignal (if provided)
	 *
	 * If the task is already cancelled, the returned Futurable will be pending (never resolves).
	 *
	 * @param overrideSignal - Optional signal to override/supplement the task's default signal.
	 *                         Useful for adding execution-specific cancellation.
	 * @returns A Futurable representing this execution
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => fetch('/data'));
	 *
	 * const run1 = task.run(); // Can be cancelled by task.cancel() or run1.cancel()
	 * const run2 = task.run(); // Independent execution
	 *
	 * task.cancel(); // Cancels both run1 and run2
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With override signal
	 * const task = FuturableTask.of(() => fetch('/data'));
	 * const controller = new AbortController();
	 *
	 * const run = task.run(controller.signal);
	 *
	 * controller.abort(); // Cancels only this execution
	 * // task itself is NOT cancelled, can still run() again
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Cancelled task produces pending Futurables
	 * const task = FuturableTask.of(() => fetch('/data'));
	 * task.cancel();
	 *
	 * const run = task.run(); // Never resolves or rejects (pending)
	 * ```
	 */
	run(overrideSignal?: AbortSignal): Futurable<T> {
		if (this.memoizeOptions.enabled && this.memoizeOptions.instance) {
			if (this.memoizeOptions.instance.signal.aborted) {
				delete this.memoizeOptions.instance;
			} else {
				return this.memoizeOptions.instance;
			}
		}

		const runController = new AbortController();

		if (this.signal.aborted) {
			runController.abort();
		} else {
			this.signal.addEventListener("abort", () => runController.abort(), { once: true });
		}

		if (overrideSignal) {
			if (overrideSignal.aborted) {
				runController.abort();
			} else {
				overrideSignal.addEventListener("abort", () => runController.abort(), { once: true });
			}
		}

		const f = new Futurable<T>(this.executor, runController.signal);

		if (this.memoizeOptions.enabled) {
			this.memoizeOptions.instance = f;
			if (!this.memoizeOptions.catchErrors) {
				f.catch(() => {
					delete this.memoizeOptions.instance;
				});
			}
		}

		return f;
	}

	/**
	 * Caches the result of the first execution and reuses it for subsequent runs.
	 *
	 * All calls to run() after the first will return the same cached Futurable.
	 * This is useful for expensive computations that should only run once.
	 *
	 * IMPORTANT: The cached result is shared across all calls. If you need independent
	 * executions, don't use memoize() or create a new memoized task for each use case.
	 *
	 * Returns a NEW FuturableTask (does not mutate the original).
	 *
	 * @param catchErrors - If true, caches the result even when the execution rejects.
	 *                      If false (default), a rejection clears the cache and the next
	 *                      run() will retry the operation.
	 * @returns A new FuturableTask that caches its result
	 *
	 * @example
	 * ```typescript
	 * const expensiveTask = FuturableTask.of(() => {
	 *   console.log('Computing...');
	 *   return complexCalculation();
	 * }).memoize();
	 *
	 * await expensiveTask.run(); // Logs "Computing..." and calculates
	 * await expensiveTask.run(); // Returns cached result immediately (no log)
	 * await expensiveTask.run(); // Returns cached result immediately (no log)
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Without catchErrors (default) - retries on failure
	 * const task = FuturableTask.of(() => riskyOperation()).memoize();
	 *
	 * try {
	 *   await task.run(); // Fails
	 * } catch (err) {}
	 *
	 * await task.run(); // Retries (not cached because it failed)
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With catchErrors - caches failures too
	 * const task = FuturableTask.of(() => riskyOperation()).memoize(true);
	 *
	 * try {
	 *   await task.run(); // Fails
	 * } catch (err) {}
	 *
	 * try {
	 *   await task.run(); // Returns cached error (doesn't retry)
	 * } catch (err) {}
	 * ```
	 */
	memoize(catchErrors?: boolean): FuturableTask<T> {
		const newTask = new FuturableTask<T>(this.executor, this.signal);
		newTask.memoizeOptions.enabled = true;
		newTask.memoizeOptions.catchErrors = catchErrors;
		return newTask;
	}

	/**
	 * Transforms the task's result value using a mapping function.
	 *
	 * The transformation is lazy and won't execute until run() is called.
	 * The mapping function receives the resolved value and optionally the abort signal
	 * to check if the operation was cancelled.
	 *
	 * This is the basic building block for transforming task results.
	 *
	 * @template U - The type of the transformed value
	 * @param fn - Function to transform the value. Can be sync or async.
	 *             Receives the value and optionally the signal.
	 * @returns A new FuturableTask with the transformed value
	 *
	 * @example
	 * ```typescript
	 * const doubleTask = FuturableTask.resolve(5)
	 *   .map(x => x * 2);
	 *
	 * await doubleTask.run(); // 10
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Async transformation
	 * const task = FuturableTask.of(() => fetch('/users'))
	 *   .map(async res => await res.json())
	 *   .map(users => users.filter(u => u.active));
	 *
	 * const activeUsers = await task.run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Using the signal parameter
	 * const task = FuturableTask.of(() => fetchData())
	 *   .map((data, signal) => {
	 *     if (signal?.aborted) {
	 *       console.log('Mapping cancelled');
	 *       return null;
	 *     }
	 *     return expensiveTransformation(data);
	 *   });
	 * ```
	 */
	map<U>(fn: (data: T, signal?: AbortSignal) => U | Promise<U>): FuturableTask<U> {
		return new FuturableTask<U>((res, rej, utils) => {
			const f = this.run(utils.signal);
			f.then(val => res(fn(val, utils.signal))).catch(rej);
		}, this.signal);
	}

	/**
	 * Chains this task with another task, creating a sequential composition.
	 *
	 * Also known as "bind" or "chain" in functional programming.
	 * The function receives the resolved value and must return a new FuturableTask.
	 *
	 * This allows you to create dependent computations where the next task
	 * depends on the result of the previous one.
	 *
	 * @template U - The type of value the chained task produces
	 * @param fn - Function that receives the value and returns a new FuturableTask
	 * @returns A new FuturableTask representing the chained computation
	 *
	 * @example
	 * ```typescript
	 * const getUserTask = FuturableTask.of(() => fetch('/user/1').then(r => r.json()));
	 * const getPostsTask = (user) => FuturableTask.of(() =>
	 *   fetch(`/users/${user.id}/posts`).then(r => r.json())
	 * );
	 *
	 * const userPosts = getUserTask.flatMap(getPostsTask);
	 * const posts = await userPosts.run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Chaining multiple dependent operations
	 * const result = await FuturableTask.of(() => readConfig())
	 *   .flatMap(config => FuturableTask.of(() => connectToDb(config)))
	 *   .flatMap(db => FuturableTask.of(() => db.query('SELECT * FROM users')))
	 *   .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Error handling in chains
	 * const result = await FuturableTask.of(() => mayFail())
	 *   .flatMap(val => {
	 *     if (val < 0) {
	 *       return FuturableTask.reject(new Error('Negative value'));
	 *     }
	 *     return FuturableTask.resolve(val * 2);
	 *   })
	 *   .run();
	 * ```
	 */
	flatMap<U>(fn: (data: T) => FuturableTask<U>): FuturableTask<U> {
		return new FuturableTask<U>((res, rej, utils) => {
			this
				.run(utils.signal)
				.then(val => {
					fn(val)
						.run(utils.signal)
						.then(res)
						.catch(rej);
				})
				.catch(rej);
		}, this.signal);
	}

	/**
	 * Sequences this task with another task, discarding the first result.
	 *
	 * Executes the current task, waits for it to complete, then executes the next task.
	 * The result of the current task is ignored - only the next task's result is returned.
	 *
	 * Useful for sequencing side effects or setup operations before the main computation.
	 *
	 * @template U - The type of value the next task produces
	 * @param nextTask - The task to execute after this one
	 * @returns A new FuturableTask that produces the next task's result
	 *
	 * @example
	 * ```typescript
	 * const setupTask = FuturableTask.of(() => initializeApp());
	 * const mainTask = FuturableTask.of(() => fetchData());
	 *
	 * const result = await setupTask.andThen(mainTask).run();
	 * // setupTask runs first, then mainTask, result is from mainTask
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Chaining multiple sequential tasks
	 * await FuturableTask.of(() => clearCache())
	 *   .andThen(FuturableTask.of(() => warmupCache()))
	 *   .andThen(FuturableTask.of(() => startServer()))
	 *   .run();
	 * ```
	 */
	andThen<U>(nextTask: FuturableTask<U>): FuturableTask<U> {
		return this.flatMap(() => nextTask);
	}

	/**
	 * Executes a side-effect function with the task's value without modifying it.
	 *
	 * The value passes through unchanged. Useful for logging, debugging, or
	 * triggering actions based on the value without affecting the result.
	 *
	 * If the side-effect function throws or rejects, the error is propagated.
	 *
	 * @param fn - Side-effect function that receives the value. Can be sync or async.
	 * @returns A new FuturableTask that passes through the original value
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => fetchUser())
	 *   .tap(user => console.log('Fetched user:', user.id))
	 *   .map(user => user.name);
	 *
	 * const name = await task.run(); // Logs, then returns name
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Multiple taps for debugging
	 * const result = await FuturableTask.of(() => calculateResult())
	 *   .tap(val => console.log('Initial:', val))
	 *   .map(val => val * 2)
	 *   .tap(val => console.log('After doubling:', val))
	 *   .map(val => val + 10)
	 *   .tap(val => console.log('Final:', val))
	 *   .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Side effects with external systems
	 * await FuturableTask.of(() => processData())
	 *   .tap(async data => {
	 *     await logToAnalytics('data_processed', data);
	 *   })
	 *   .run();
	 * ```
	 */
	tap(fn: (data: T) => any): FuturableTask<T> {
		return this.map(async val => {
			await fn(val);
			return val;
		});
	}

	/**
	 * Executes a side effect only if this task fails.
	 *
	 * The error is still propagated after the side effect executes.
	 * Useful for error logging or monitoring without handling the error.
	 *
	 * If the side-effect function itself throws, that error is logged to console
	 * but the original error is still propagated.
	 *
	 * @param fn - Function to execute on error. Can be sync or async.
	 * @returns A new FuturableTask that passes through the original error
	 *
	 * @example
	 * ```typescript
	 * await apiTask
	 *   .tapError(error => logger.error('API failed', error))
	 *   .tapError(error => sendToSentry(error))
	 *   .catch(handleError);
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Log errors without stopping propagation
	 * try {
	 *   await FuturableTask.of(() => riskyOperation())
	 *     .tapError(err => console.error('Operation failed:', err))
	 *     .run();
	 * } catch (err) {
	 *   // err is the original error
	 *   console.log('Caught:', err);
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Chaining tapError with recovery
	 * const result = await FuturableTask.of(() => mayFail())
	 *   .tapError(err => analytics.trackError(err))
	 *   .orElse(err => FuturableTask.resolve(defaultValue))
	 *   .run();
	 * ```
	 */
	tapError(fn: (error: any) => any): FuturableTask<T> {
		return new FuturableTask<T>((res, rej, utils) => {
			const task = this.run(utils.signal);
			task
				.then(res)
				.catch(async error => {
					try {
						await fn(error);
					} catch (err) {
						console.error(`tapError callback failed: `, err);
					}
					rej(error); // Always propagate the original error
				})
		}, this.signal);
	}

	/**
	 * Handles errors from the task execution by providing a fallback task.
	 *
	 * If the task succeeds, the result passes through unchanged.
	 * If the task fails, the fallback function is called with the error
	 * and must return a new FuturableTask to execute instead.
	 *
	 * The fallback task can return a different type, allowing for type transformations
	 * during error recovery.
	 *
	 * @template U - The type of the recovery value
	 * @param fallbackTask - Function that receives the error and returns a FuturableTask
	 * @returns A new FuturableTask with error handling
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => fetchFromPrimary())
	 *   .catchError(err => {
	 *     console.error('Primary failed:', err);
	 *     return FuturableTask.of(() => fetchFromBackup());
	 *   });
	 *
	 * const data = await task.run(); // Falls back to backup on error
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Retry with exponential backoff
	 * const task = FuturableTask.of(() => unstableOperation())
	 *   .catchError(err =>
	 *     FuturableTask.delay(1000)
	 *       .flatMap(() => FuturableTask.of(() => unstableOperation()))
	 *   );
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Type transformation on error
	 * const task: FuturableTask<User> = fetchUser()
	 *   .catchError((err): FuturableTask<User | null> => {
	 *     if (err.status === 404) {
	 *       return FuturableTask.resolve(null);
	 *     }
	 *     return FuturableTask.reject(err);
	 *   });
	 * ```
	 */
	catchError<U>(fallbackTask: (err: any) => FuturableTask<U>): FuturableTask<T | U> {
		return new FuturableTask<T | U>((res, rej, utils) => {
			this
				.run(utils.signal)
				.then(res)
				.catch(err => {
					fallbackTask(err)
						.run(utils.signal)
						.then(res)
						.catch(rej);
				});
		}, this.signal);
	}

	/**
	 * Provides an alternative FuturableTask to execute if the current one fails.
	 *
	 * Similar to catchError, but ensures the result type remains consistent (type T).
	 * This is used for fallback logic like using cache if API fails.
	 *
	 * If the task succeeds, the result passes through unchanged.
	 * If the task fails, the fallback function is called with the error.
	 *
	 * @param fallbackTask - A function that receives the error and returns a fallback FuturableTask
	 * @returns A new FuturableTask that will attempt the alternative on failure
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => readLocalConfig())
	 *   .orElse(err => {
	 *     console.warn('Local config not found, loading default...');
	 *     return FuturableTask.of(() => readDefaultConfig());
	 *   });
	 *
	 * const config = await task.run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Cache fallback
	 * const task = FuturableTask.of(() => fetch('/api/data'))
	 *   .orElse(() => FuturableTask.of(() => loadFromCache()));
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Multiple fallbacks
	 * const task = FuturableTask.of(() => fetchFromPrimary())
	 *   .orElse(() => FuturableTask.of(() => fetchFromSecondary()))
	 *   .orElse(() => FuturableTask.of(() => fetchFromTertiary()));
	 * ```
	 */
	orElse<U>(fallbackTask: (err: any) => FuturableTask<T | U>): FuturableTask<T | U> {
		return new FuturableTask<T | U>((res, rej, utils) => {
			this
				.run(utils.signal)
				.then(res)
				.catch(err => {
					fallbackTask(err)
						.run(utils.signal)
						.then(res)
						.catch(rej);
				});
		}, this.signal);
	}

	/**
	 * Provides a default value if the task fails.
	 *
	 * Simpler alternative to orElse when you just want to return a static value on failure.
	 * The fallback value is wrapped in a resolved task automatically.
	 *
	 * @param fallback - The default value to use if the task fails
	 * @returns A new FuturableTask that won't fail (returns fallback instead)
	 *
	 * @example
	 * ```typescript
	 * const data = await FuturableTask.of(() => fetchData())
	 *   .fallbackTo([])
	 *   .run();
	 * // Always succeeds, returns [] if fetch fails
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Configuration with defaults
	 * const config = await FuturableTask.of(() => loadUserConfig())
	 *   .fallbackTo(DEFAULT_CONFIG)
	 *   .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Nullish values
	 * const user = await FuturableTask.of(() => fetchUser(id))
	 *   .fallbackTo(null)
	 *   .run();
	 * // Returns null instead of throwing on error
	 * ```
	 */
	fallbackTo<U>(fallback: U): FuturableTask<T|U> {
		return this.orElse(() => FuturableTask.resolve(fallback));
	}

	/**
	 * Conditional branching based on the task's result.
	 *
	 * Evaluates a condition with the resolved value and executes one of two alternative
	 * tasks based on the result. Both branches must return tasks of the same type.
	 *
	 * The condition can be async, allowing for asynchronous decision-making.
	 *
	 * @template U - The type returned by both branches
	 * @param condition - Predicate function to evaluate (can be async)
	 * @param onTrue - Task to execute if condition is true
	 * @param onFalse - Task to execute if condition is false
	 * @returns A new FuturableTask with conditional execution
	 *
	 * @example
	 * ```typescript
	 * const result = await userTask.ifElse(
	 *   user => user.isPremium,
	 *   user => FuturableTask.of(() => loadPremiumContent(user)),
	 *   user => FuturableTask.of(() => loadBasicContent(user))
	 * ).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Async condition
	 * const task = FuturableTask.of(() => getUser())
	 *   .ifElse(
	 *     async user => await hasPermission(user, 'admin'),
	 *     user => FuturableTask.of(() => adminDashboard(user)),
	 *     user => FuturableTask.of(() => userDashboard(user))
	 *   );
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Validation with branching
	 * const processed = await FuturableTask.of(() => parseInput(data))
	 *   .ifElse(
	 *     parsed => parsed.isValid,
	 *     parsed => FuturableTask.of(() => processValidData(parsed)),
	 *     parsed => FuturableTask.reject(new Error('Invalid data'))
	 *   )
	 *   .run();
	 * ```
	 */
	ifElse<U>(condition: (value: T) => boolean | Promise<boolean>, onTrue: (value: T) => FuturableTask<U>, onFalse: (value: T) => FuturableTask<U>): FuturableTask<U> {
		return new FuturableTask<U>((res, rej, utils) => {
			this.run(utils.signal)
				.then(async val => {
					const shouldBranch = await condition(val);
					const selectedTask = shouldBranch ? onTrue(val) : onFalse(val);
					selectedTask.run(utils.signal)
						.then(res)
						.catch(rej);
				})
				.catch(rej);
		}, this.signal);
	}

	/**
	 * Folds the result of the task execution into a single value by applying
	 * the appropriate transformation function.
	 *
	 * This is a catamorphism - it handles both success and failure cases uniformly,
	 * mapping them both to the same result type. Both transformation functions must
	 * return tasks of the same type.
	 *
	 * Useful when you want to treat success and failure symmetrically.
	 *
	 * @template U - The return type produced by the fold transformation
	 * @param onFailure - Transformation function applied if the promise rejects
	 * @param onSuccess - Transformation function applied if the promise resolves
	 * @returns A new FuturableTask that resolves to the transformation result
	 *
	 * @example
	 * ```typescript
	 * const message = await FuturableTask.of(() => fetchData())
	 *   .fold(
	 *     error => FuturableTask.resolve(`Error: ${error.message}`),
	 *     data => FuturableTask.resolve(`Success: ${data.length} items`)
	 *   )
	 *   .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Result type for API responses
	 * type Result<T> = { success: true; data: T } | { success: false; error: string };
	 *
	 * const result: Result<User> = await fetchUser()
	 *   .fold(
	 *     error => FuturableTask.resolve({ success: false, error: error.message }),
	 *     user => FuturableTask.resolve({ success: true, data: user })
	 *   )
	 *   .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Logging both outcomes
	 * await task.fold(
	 *   err => FuturableTask.of(() => logError(err)).map(() => 0),
	 *   val => FuturableTask.of(() => logSuccess(val)).map(() => val)
	 * ).run();
	 * ```
	 */
	fold<U>(onFailure: (err: any) => FuturableTask<U>, onSuccess: (value: T) => FuturableTask<U>): FuturableTask<U> {
		return new FuturableTask<U>((res, rej, utils) => {
			this.run(utils.signal)
				.then(val => {
					onSuccess(val)
						.run(utils.signal)
						.then(res)
						.catch(rej)
				})
				.catch(err => {
					onFailure(err)
						.run(utils.signal)
						.then(res)
						.catch(rej)
				})
		}, this.signal);
	}

	/**
	 * Registers a callback that runs when the task completes (success or failure).
	 *
	 * Similar to Promise.finally(). The callback cannot modify the result or error,
	 * but is useful for cleanup operations like closing connections or hiding spinners.
	 *
	 * If the callback throws or rejects, that error is propagated.
	 *
	 * @param callback - Function to execute on completion (can be async)
	 * @returns A new FuturableTask with the finally handler
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => fetchData())
	 *   .finally(() => {
	 *     console.log('Fetch completed');
	 *     hideSpinner();
	 *   });
	 *
	 * await task.run(); // Always hides spinner, even on error
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Cleanup resources
	 * const result = await FuturableTask.of(() => {
	 *   const connection = openConnection();
	 *   return processData(connection);
	 * })
	 * .finally(() => connection.close())
	 * .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Multiple cleanup operations
	 * await task
	 *   .finally(() => releaseResource1())
	 *   .finally(() => releaseResource2())
	 *   .finally(() => console.log('All cleanup done'))
	 *   .run();
	 * ```
	 */
	finally(callback: () => any): FuturableTask<T> {
		return new FuturableTask((res, rej, utils) => {
			this
				.run(utils.signal)
				.then(async val => {
					await callback();
					res(val);
				})
				.catch(async err => {
					await callback();
					rej(err);
				});
		}, this.signal);
	}

	/**
	 * Adds a timeout to the task execution.
	 *
	 * If the task doesn't complete within the specified time, it's cancelled
	 * and the task rejects with the provided reason.
	 *
	 * The timeout only applies when the task is run, not when it's created.
	 *
	 * @param ms - Timeout duration in milliseconds
	 * @param reason - Rejection reason (default: "TimeoutExceeded")
	 * @returns A new FuturableTask with timeout enforcement
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => fetch('/slow-api'))
	 *   .timeout(5000, new Error('Request timed out after 5s'));
	 *
	 * try {
	 *   await task.run();
	 * } catch (err) {
	 *   console.error(err); // "Request timed out after 5s"
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Timeout with default reason
	 * await FuturableTask.of(() => longOperation())
	 *   .timeout(3000)
	 *   .run(); // Rejects with "TimeoutExceeded" after 3s
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Chaining with retry
	 * const result = await FuturableTask.of(() => fetchData())
	 *   .timeout(5000)
	 *   .retry(3)
	 *   .run();
	 * // Each attempt has a 5s timeout
	 * ```
	 */
	timeout(ms: number, reason: any = "TimeoutExceeded"): FuturableTask<T> {
		return new FuturableTask<T>((res, rej, utils) => {
			const timer = setTimeout(() => {
				f.cancel();
				rej(reason);
			}, ms);
			const f = this.run(utils.signal);
			utils.onCancel(() => {
				clearTimeout(timer);
			});
			f
				.then(val => {
					clearTimeout(timer);
					res(val);
				})
				.catch(err => {
					clearTimeout(timer);
					rej(err);
				});
		}, this.signal);
	}

	/**
	 * Delays the execution of the task by a specified duration.
	 *
	 * The timer starts when run() is called, not when delay() is called.
	 * The task waits for the specified duration before executing.
	 *
	 * Useful for rate limiting, debouncing, or implementing backoff strategies.
	 *
	 * @param ms - Delay duration in milliseconds
	 * @returns A new FuturableTask with the delay
	 *
	 * @example
	 * ```typescript
	 * const delayedTask = FuturableTask.of(() => sendEmail())
	 *   .delay(5000); // Wait 5 seconds before sending
	 *
	 * await delayedTask.run(); // Starts after 5s
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Progressive delays
	 * await FuturableTask.of(() => step1())
	 *   .andThen(FuturableTask.of(() => step2()).delay(1000))
	 *   .andThen(FuturableTask.of(() => step3()).delay(2000))
	 *   .run();
	 * // step1 immediately, step2 after 1s, step3 after 2s
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Cancellable delay
	 * const task = FuturableTask.of(() => operation()).delay(10000);
	 * const run = task.run();
	 * task.cancel(); // Cancels before the delay completes
	 * ```
	 */
	delay(ms: number): FuturableTask<T> {
		return new FuturableTask<T>(async (res, rej, utils) => {
			await utils.sleep(ms);
			this.run(utils.signal)
				.then(res)
				.catch(rej);
		}, this.signal);
	}

	/**
	 * Retries the task up to n times on failure.
	 *
	 * Each retry is an independent execution of the original task.
	 * If all attempts fail, the last error is propagated.
	 *
	 * An optional delay can be added between retries for exponential backoff patterns.
	 *
	 * @param retries - Maximum number of retry attempts (0 means 1 total attempt)
	 * @param delayMs - Optional delay between retries in milliseconds (default: 0)
	 * @returns A new FuturableTask with retry logic
	 *
	 * @example
	 * ```typescript
	 * const unreliableTask = FuturableTask.of(() => fetch('/flaky-api'))
	 *   .retry(3); // Will try up to 4 times total (initial + 3 retries)
	 *
	 * const data = await unreliableTask.run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With delay between retries
	 * await FuturableTask.of(() => connectToService())
	 *   .retry(5, 1000) // Retry 5 times with 1s between attempts
	 *   .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Exponential backoff (manual)
	 * let attempt = 0;
	 * const task = FuturableTask.of(() => fetch('/api'))
	 *   .tapError(() => attempt++)
	 *   .retry(3, Math.pow(2, attempt) * 1000);
	 * ```
	 */
	retry(retries: number, delayMs: number = 0): FuturableTask<T> {
		return new FuturableTask<T>(async (res, rej, utils) => {
			let lastError: any;
			for (let i = 0; i <= retries; i++) {
				if (utils.signal.aborted) return;
				try {
					return res(await this.run(utils.signal));
				} catch (error) {
					lastError = error;
					if (i < retries && !utils.signal.aborted) {
						delayMs > 0 && await utils.sleep(delayMs);
					}
				}
			}
			rej(lastError);
		}, this.signal);
	}

	/**
	 * Creates a new Task that delays the execution of the original task with debounce logic.
	 *
	 * This method implements "smart debounce":
	 * - If called on a regular Task, it wraps it with a delay
	 * - If called on an already debounced Task (e.g., `.debounce(200).debounce(300)`),
	 *   it overrides the previous delay instead of nesting, ensuring only the
	 *   latest delay is applied to the source task
	 *
	 * Multiple calls to run() within the debounce window will cancel previous
	 * pending executions and restart the timer.
	 *
	 * Perfect for scenarios like search-as-you-type where you want to wait for
	 * user input to stabilize before executing.
	 *
	 * @param ms - The debounce delay in milliseconds
	 * @returns A new Task instance that manages the debounced execution
	 *
	 * @example
	 * ```typescript
	 * const searchTask = FuturableTask.of(() => searchAPI(query))
	 *   .debounce(300);
	 *
	 * // Rapidly calling run() multiple times:
	 * searchTask.run(); // Cancelled
	 * searchTask.run(); // Cancelled
	 * searchTask.run(); // This one executes after 300ms
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Smart debounce - latest delay wins
	 * const task = FuturableTask.of(() => operation())
	 *   .debounce(200)
	 *   .debounce(500); // Uses 500ms, not 200ms + 500ms
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Cancelling a debounced task
	 * const task = FuturableTask.of(() => saveData()).debounce(1000);
	 * task.run();
	 * task.cancel(); // Cancels the pending execution
	 * ```
	 */
	debounce(ms: number): FuturableTask<T> {
		const source = this.sourceTask ?? this;
		let timeoutId: ReturnType<typeof setTimeout> | null = null;

		const newTask = new FuturableTask<T>((res, rej, utils) => {
			utils.onCancel(() => {
				timeoutId && clearTimeout(timeoutId);
				timeoutId = null;
			});
			timeoutId && clearTimeout(timeoutId);
			timeoutId = setTimeout(() => {
				source.run(utils.signal)
					.then(res)
					.catch(rej)
					.finally(() => {
						timeoutId = null;
					});
			}, ms);
		}, this.signal);

		newTask.sourceTask = source;

		return newTask;
	}

	/**
	 * Creates a new Task that limits the execution rate to once every 'ms' milliseconds.
	 *
	 * Unlike debounce, throttle ensures the task runs at a steady maximum rate.
	 * The first call executes immediately, and subsequent calls within the throttle
	 * window will return the result of the previous execution.
	 *
	 * Perfect for performance-heavy operations that need to run consistently
	 * during continuous events like scrolling, resizing, or mouse movement.
	 *
	 * @param ms - The throttle interval in milliseconds
	 * @returns A new Task instance with throttling logic
	 *
	 * @example
	 * ```typescript
	 * const scrollTask = FuturableTask.of(() => updateScrollPosition())
	 *   .throttle(100);
	 *
	 * window.addEventListener('scroll', () => {
	 *   scrollTask.run(); // Runs at most once per 100ms
	 * });
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // API rate limiting
	 * const apiTask = FuturableTask.of(() => fetch('/api/data'))
	 *   .throttle(1000);
	 *
	 * // Rapid clicks will reuse the same result within 1s window
	 * button.addEventListener('click', () => {
	 *   apiTask.run().then(data => updateUI(data));
	 * });
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Performance monitoring
	 * const monitor = FuturableTask.of(() => collectMetrics())
	 *   .throttle(5000);
	 *
	 * setInterval(() => monitor.run(), 100); // Collects every 5s despite 100ms interval
	 * ```
	 */
	throttle(ms: number): FuturableTask<T> {
		let lastRun = 0;
		let lastResult: Futurable<T>;
		return new FuturableTask<T>((res, rej, utils) => {
			const now = Date.now();
			if (now - lastRun >= ms || !lastResult) {
				lastRun = now;
				lastResult = this.run(utils.signal);
				lastResult
					.then(res)
					.catch(rej)
			} else {
				lastResult && lastResult
					.then(res)
					.catch(rej);
			}
		}, this.signal);
	}

	/**
	 * Combines this task with another task into a tuple of both results.
	 *
	 * Both tasks execute in parallel and the result is a tuple [T, U].
	 * If either task fails, the combined task fails.
	 *
	 * This is useful for combining independent operations that you need to perform together.
	 *
	 * @template U - The type of value the other task produces
	 * @param other - The task to combine with this one
	 * @returns A new FuturableTask that resolves with a tuple of both results
	 *
	 * @example
	 * ```typescript
	 * const userTask = FuturableTask.of(() => fetchUser());
	 * const postsTask = FuturableTask.of(() => fetchPosts());
	 *
	 * const [user, posts] = await userTask.zip(postsTask).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Combining multiple independent operations
	 * const combined = taskA
	 *   .zip(taskB)
	 *   .zip(taskC)
	 *   .run(); // [[A, B], C]
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Error handling - any failure cancels all
	 * try {
	 *   const [result1, result2] = await task1.zip(task2).run();
	 * } catch (err) {
	 *   // Either task1 or task2 failed
	 * }
	 * ```
	 */
	zip<U>(other: FuturableTask<U>): FuturableTask<[T, U]> {
		return new FuturableTask<[T, U]>((res, rej, utils) => {
			Futurable.all(
				[
					this.run(utils.signal),
					other.run(utils.signal)
				],
				utils.signal
			)
				.then(([a, b]) => res([a, b]))
				.catch(rej);
		}, this.signal);
	}

	/**
	 * Combines this task with another task and applies a combining function.
	 *
	 * Similar to zip, but instead of returning a tuple, it applies a function
	 * to both results to produce a single combined value.
	 *
	 * Both tasks execute in parallel.
	 *
	 * @template U - The type of value the other task produces
	 * @template R - The type of the combined result
	 * @param other - The task to combine with this one
	 * @param fn - Function to combine both results
	 * @returns A new FuturableTask with the combined result
	 *
	 * @example
	 * ```typescript
	 * const sum = await taskA.zipWith(taskB, (a, b) => a + b).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Combining user data
	 * const fullProfile = await basicInfoTask.zipWith(
	 *   preferencesTask,
	 *   (basic, prefs) => ({ ...basic, preferences: prefs })
	 * ).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Computing derived values
	 * const average = await minTask.zipWith(
	 *   maxTask,
	 *   (min, max) => (min + max) / 2
	 * ).run();
	 * ```
	 */
	zipWith<U, R>(other: FuturableTask<U>, fn: (a: T, b: U) => R): FuturableTask<R> {
		return this.zip(other).map(([a, b]) => fn(a, b));
	}

	/**
	 * Maps both success and error outcomes to new values.
	 *
	 * Applies different transformation functions depending on whether the task
	 * succeeds or fails. Unlike fold, the transformations are synchronous and
	 * don't return tasks.
	 *
	 * Useful for normalizing success and error cases into a consistent format.
	 *
	 * @template U - The type of the transformed success value
	 * @template V - The type of the transformed error value
	 * @param onSuccess - Function to transform the success value
	 * @param onError - Function to transform the error
	 * @returns A new FuturableTask with transformed success/error
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.of(() => riskyOperation())
	 *   .bimap(
	 *     result => `Success: ${result}`,
	 *     error => new CustomError(error.message)
	 *   );
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Normalizing API responses
	 * const normalized = await fetchData()
	 *   .bimap(
	 *     data => ({ status: 'ok', data }),
	 *     err => ({ status: 'error', message: err.message })
	 *   )
	 *   .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Adding context to errors
	 * await task.bimap(
	 *   val => val,
	 *   err => new Error(`Operation failed: ${err.message}`)
	 * ).run();
	 * ```
	 */
	bimap<U, V>(onSuccess: (value: T) => U, onError: (error: any) => V): FuturableTask<U> {
		return new FuturableTask<U>((res, rej, utils) => {
			this.run(utils.signal)
				.then(val => res(onSuccess(val)))
				.catch(err => rej(onError(err)));
		}, this.signal);
	}

	/**
	 * Repeats this task n times, collecting all results.
	 *
	 * Each execution is independent. If any execution fails, the entire
	 * repeat operation fails.
	 *
	 * Executes sequentially, not in parallel.
	 *
	 * @param n - Number of times to repeat (must be >= 0)
	 * @returns A new FuturableTask that resolves with an array of all results
	 *
	 * @example
	 * ```typescript
	 * const results = await task.repeat(3).run(); // [result1, result2, result3]
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Collecting multiple samples
	 * const measurements = await FuturableTask.of(() => takeMeasurement())
	 *   .repeat(10)
	 *   .map(samples => average(samples))
	 *   .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Batch operations
	 * const created = await FuturableTask.of(() => createRecord())
	 *   .repeat(5)
	 *   .run();
	 * ```
	 */
	repeat(n: number): FuturableTask<T[]> {
		return FuturableTask.times(n, () => this);
	}

	/**
	 * Composes multiple transformation functions in sequence.
	 *
	 * Applies transformations from left to right, passing the result of each
	 * transformation to the next. Type-safe for up to 9 transformations.
	 *
	 * This is a powerful way to build complex task pipelines in a readable way.
	 *
	 * @param fns - Transformation functions to apply in order
	 * @returns The result of applying all transformations
	 *
	 * @example
	 * ```typescript
	 * const addRetry = (task) => task.retry(3);
	 * const addTimeout = (task) => task.timeout(5000);
	 * const addLogging = (task) => task.tap(x => console.log(x));
	 *
	 * const enhanced = baseTask.pipe(addRetry, addTimeout, addLogging);
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Building a processing pipeline
	 * const processData = (task: FuturableTask<string>) => task
	 *   .pipe(
	 *     t => t.map(s => s.trim()),
	 *     t => t.map(s => s.toLowerCase()),
	 *     t => t.map(s => s.split(',')),
	 *     t => t.map(arr => arr.map(s => s.trim()))
	 *   );
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Reusable middleware
	 * const withErrorHandling = (task) => task.tapError(logError);
	 * const withRetry = (task) => task.retry(3, 1000);
	 * const withTimeout = (task) => task.timeout(10000);
	 *
	 * const robustTask = apiTask.pipe(
	 *   withErrorHandling,
	 *   withRetry,
	 *   withTimeout
	 * );
	 * ```
	 */
	pipe<A>(f1: (t: FuturableTask<T>) => A): A;
	pipe<A, B>(
		f1: (t: FuturableTask<T>) => A,
		f2: (a: A) => B
	): B;
	pipe<A, B, C>(
		f1: (t: FuturableTask<T>) => A,
		f2: (a: A) => B,
		f3: (b: B) => C
	): C;
	pipe<A, B, C, D>(
		f1: (t: FuturableTask<T>) => A,
		f2: (a: A) => B,
		f3: (b: B) => C,
		f4: (c: C) => D
	): D;
	pipe<A, B, C, D, E>(
		f1: (t: FuturableTask<T>) => A,
		f2: (a: A) => B,
		f3: (b: B) => C,
		f4: (c: C) => D,
		f5: (d: D) => E
	): E;
	pipe<A, B, C, D, E, F>(
		f1: (t: FuturableTask<T>) => A,
		f2: (a: A) => B,
		f3: (b: B) => C,
		f4: (c: C) => D,
		f5: (d: D) => E,
		f6: (e: E) => F
	): F;
	pipe<A, B, C, D, E, F, G>(
		f1: (t: FuturableTask<T>) => A,
		f2: (a: A) => B,
		f3: (b: B) => C,
		f4: (c: C) => D,
		f5: (d: D) => E,
		f6: (e: E) => F,
		f7: (f: F) => G
	): G;
	pipe<A, B, C, D, E, F, G, H>(
		f1: (t: FuturableTask<T>) => A,
		f2: (a: A) => B,
		f3: (b: B) => C,
		f4: (c: C) => D,
		f5: (d: D) => E,
		f6: (e: E) => F,
		f7: (f: F) => G,
		f8: (g: G) => H
	): H;
	pipe<A, B, C, D, E, F, G, H, I>(
		f1: (t: FuturableTask<T>) => A,
		f2: (a: A) => B,
		f3: (b: B) => C,
		f4: (c: C) => D,
		f5: (d: D) => E,
		f6: (e: E) => F,
		f7: (f: F) => G,
		f8: (g: G) => H,
		f9: (h: H) => I
	): I;
	pipe(...fns: Array<(arg: any) => any>): any {
		return fns.reduce((prev, fn) => fn(prev), this);
	}

	/**
	 * Creates a new FuturableTask that performs an HTTP fetch when executed.
	 *
	 * @param url - URL to fetch, or a function receiving the task's value
	 * @param opts - Fetch options, or a function receiving the task's value
	 * @returns A new FuturableTask that resolves with the Response
	 *
	 * @example
	 * ```typescript
	 * const fetchTask = FuturableTask.resolve('users')
	 *   .fetch(endpoint => `https://api.example.com/${endpoint}`);
	 *
	 * const response = await fetchTask.run();
	 * const data = await response.json();
	 * ```
	 */
	fetch(url: string | ((val: T) => string), opts?: RequestInit | ((val: T) => RequestInit)): FuturableTask<Response> {
		return new FuturableTask<Response>((res, rej, utils) => {
			this.run(utils.signal)
				.then(val => {
					const urlFetch = typeof url === "function" ? url(val) : url;
					const optsFetch = {
						...(typeof opts === "function" ? opts(val) : opts),
						signal: utils.signal
					};

					utils.fetch(urlFetch, optsFetch)
						.then(res)
						.catch(rej);
				})
				.catch(rej);
		}, this.signal);
	}

	/**
	 * Creates a FuturableTask from various input types.
	 *
	 * Accepts:
	 * - Plain values: Wraps in a task that resolves immediately
	 * - Functions: Creates a task that executes the function
	 *
	 * Functions receive FuturableUtils with signal, onCancel, delay, sleep, fetch, etc.
	 *
	 * @template U - Type of the value
	 * @param input - A value or a function that returns a value/Promise
	 * @param signal - Optional AbortSignal for the task
	 * @returns A new FuturableTask
	 *
	 * @example
	 * ```typescript
	 * // From a value
	 * const task1 = FuturableTask.of(42);
	 * await task1.run(); // 42
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // From a function
	 * const task2 = FuturableTask.of(() => fetch('/api').then(r => r.json()));
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With utils
	 * const task3 = FuturableTask.of(async (utils) => {
	 *   const response = await utils.fetch('/api/data');
	 *   return response.json();
	 * });
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With external signal
	 * const controller = new AbortController();
	 * const task = FuturableTask.of(() => operation(), controller.signal);
	 * ```
	 */
	static of<U>(input: U | ((utils?: FuturableUtils<U>) => Promise<U>), signal?: AbortSignal): FuturableTask<U> {
		if (typeof input === "function") {
			return new FuturableTask<U>(async (res, rej, utils) => {
				try {
					res(await (input as Function)(utils));
				} catch (error) {
					rej(error);
				}
			}, signal);
		}

		return new FuturableTask<U>(res => res(input), signal);
	}

	/**
	 * Creates a FuturableTask that immediately resolves with the given value.
	 *
	 * Alias for FuturableTask.of() when passing a plain value.
	 * Useful for lifting values into the Task context.
	 *
	 * @template U - Type of the value
	 * @param v - The value to resolve with
	 * @param signal - Optional AbortSignal for the task
	 * @returns A FuturableTask that resolves to the value
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.resolve(42)
	 *   .map(x => x * 2);
	 *
	 * await task.run(); // 84
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Creating task chains
	 * const pipeline = FuturableTask.resolve(data)
	 *   .map(d => transform(d))
	 *   .flatMap(t => FuturableTask.of(() => save(t)));
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Default values
	 * const task = condition
	 *   ? FuturableTask.of(() => fetchData())
	 *   : FuturableTask.resolve(defaultData);
	 * ```
	 */
	static resolve<U = any>(v: U, signal?: AbortSignal): FuturableTask<U> {
		return FuturableTask.of(v, signal);
	}

	/**
	 * Creates a FuturableTask that immediately rejects with the given reason.
	 *
	 * Useful for creating tasks that represent known failures,
	 * or for testing error handling logic.
	 *
	 * @param reason - The rejection reason (typically an Error)
	 * @param signal - Optional AbortSignal for the task
	 * @returns A FuturableTask that rejects with the reason
	 *
	 * @example
	 * ```typescript
	 * const task = FuturableTask.reject(new Error('Not implemented'))
	 *   .orElse(() => FuturableTask.of(() => fallbackImplementation()));
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Conditional errors
	 * const task = value < 0
	 *   ? FuturableTask.reject(new Error('Value must be positive'))
	 *   : FuturableTask.of(() => process(value));
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Testing error handlers
	 * const testTask = FuturableTask.reject(new Error('Test error'))
	 *   .tapError(err => assert(err.message === 'Test error'));
	 * ```
	 */
	static reject<U = never>(reason: any, signal?: AbortSignal): FuturableTask<U> {
		return new FuturableTask((_, rej) => rej(reason), signal);
	}

	/**
	 * Executes all tasks in parallel and resolves when all complete.
	 *
	 * All tasks run concurrently. If any task fails, the combined task
	 * fails immediately and all running tasks are cancelled.
	 *
	 * Returns an array of results in the same order as the input tasks.
	 *
	 * @template T - Type of values the tasks produce
	 * @param tasks - Array of FuturableTasks to execute in parallel
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with an array of all results
	 *
	 * @example
	 * ```typescript
	 * const tasks = [
	 *   FuturableTask.of(() => fetch('/api/users')),
	 *   FuturableTask.of(() => fetch('/api/posts')),
	 *   FuturableTask.of(() => fetch('/api/comments'))
	 * ];
	 *
	 * const [users, posts, comments] = await FuturableTask.all(tasks).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With error handling
	 * try {
	 *   const results = await FuturableTask.all([task1, task2, task3]).run();
	 * } catch (err) {
	 *   // One of the tasks failed, others were cancelled
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Dynamic task lists
	 * const userIds = [1, 2, 3, 4, 5];
	 * const tasks = userIds.map(id =>
	 *   FuturableTask.of(() => fetchUser(id))
	 * );
	 * const users = await FuturableTask.all(tasks).run();
	 * ```
	 */
	static all<T>(tasks: FuturableTask<T>[], signal?: AbortSignal): FuturableTask<T[]> {
		return new FuturableTask<T[]>((res, rej, utils) => {
			Futurable
				.all(tasks.map(t => t.run(utils.signal)), utils.signal)
				.then(res)
				.catch(rej);
		}, signal);
	}

	/**
	 * Executes all tasks in parallel and waits for all to settle (resolve or reject).
	 *
	 * Never rejects. Returns an array of result objects indicating the outcome
	 * of each task. Each result has a status ('fulfilled' or 'rejected') and
	 * either a value or reason.
	 *
	 * Useful when you want to attempt multiple operations and handle failures individually.
	 *
	 * @template T - Type of values the tasks produce
	 * @param tasks - Array of FuturableTasks to execute
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with an array of PromiseSettledResult objects
	 *
	 * @example
	 * ```typescript
	 * const results = await FuturableTask.allSettled([
	 *   FuturableTask.resolve(1),
	 *   FuturableTask.reject('error'),
	 *   FuturableTask.resolve(3)
	 * ]).run();
	 *
	 * results.forEach(result => {
	 *   if (result.status === 'fulfilled') {
	 *     console.log('Success:', result.value);
	 *   } else {
	 *     console.log('Failed:', result.reason);
	 *   }
	 * });
	 * // Success: 1
	 * // Failed: error
	 * // Success: 3
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Batch operations with individual error handling
	 * const results = await FuturableTask.allSettled(
	 *   userIds.map(id => FuturableTask.of(() => deleteUser(id)))
	 * ).run();
	 *
	 * const succeeded = results.filter(r => r.status === 'fulfilled').length;
	 * const failed = results.filter(r => r.status === 'rejected').length;
	 * console.log(`Deleted ${succeeded}, failed ${failed}`);
	 * ```
	 */
	static allSettled<T>(tasks: FuturableTask<T>[], signal?: AbortSignal): FuturableTask<PromiseSettledResult<T>[]> {
		return new FuturableTask((res, rej, utils) => {
			Futurable
				.allSettled(tasks.map(t => t.run(utils.signal)), utils.signal)
				.then(res)
				.catch(rej);
		}, signal);
	}

	/**
	 * Executes all tasks in parallel and resolves/rejects with the first to settle.
	 *
	 * Once one task settles (successfully or with error), all other tasks are cancelled.
	 * The result matches the first settled task - success or failure.
	 *
	 * Useful for timeout patterns or racing multiple data sources.
	 *
	 * @template T - Type of values the tasks produce
	 * @param tasks - Array of FuturableTasks to race
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that settles with the first task's result
	 *
	 * @example
	 * ```typescript
	 * const fastest = await FuturableTask.race([
	 *   FuturableTask.of(() => fetchFromCDN1()),
	 *   FuturableTask.of(() => fetchFromCDN2()),
	 *   FuturableTask.of(() => fetchFromCDN3())
	 * ]).run();
	 *
	 * console.log('Fastest CDN responded with:', fastest);
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Timeout pattern
	 * const result = await FuturableTask.race([
	 *   FuturableTask.of(() => slowOperation()),
	 *   FuturableTask.delay(5000).flatMap(() =>
	 *     FuturableTask.reject(new Error('Timeout'))
	 *   )
	 * ]).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // First successful response wins
	 * const data = await FuturableTask.race([
	 *   cacheTask,
	 *   apiTask
	 * ]).run(); // Uses cache if available, API otherwise
	 * ```
	 */
	static race<T>(tasks: FuturableTask<T>[], signal?: AbortSignal): FuturableTask<T> {
		return new FuturableTask((res, rej, utils) => {
			Futurable
				.race(tasks.map(t => t.run(utils.signal)), utils.signal)
				.then(res)
				.catch(rej);
		}, signal);
	}

	/**
	 * Executes all tasks in parallel and resolves with the first successful result.
	 *
	 * Ignores failures and only resolves when at least one task succeeds.
	 * Only rejects if ALL tasks fail (with an AggregateError containing all errors).
	 *
	 * Perfect for fallback scenarios with multiple alternatives.
	 *
	 * @template T - Type of values the tasks produce
	 * @param tasks - Array of FuturableTasks to execute
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with the first success
	 *
	 * @example
	 * ```typescript
	 * const data = await FuturableTask.any([
	 *   FuturableTask.of(() => fetchFromPrimaryServer()),
	 *   FuturableTask.of(() => fetchFromBackupServer1()),
	 *   FuturableTask.of(() => fetchFromBackupServer2())
	 * ]).run();
	 *
	 * // Returns data from whichever server responds successfully first
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Multiple fallback sources
	 * const config = await FuturableTask.any([
	 *   FuturableTask.of(() => loadFromEnv()),
	 *   FuturableTask.of(() => loadFromFile()),
	 *   FuturableTask.of(() => loadDefaults())
	 * ]).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // All fail case
	 * try {
	 *   await FuturableTask.any([
	 *     FuturableTask.reject('error1'),
	 *     FuturableTask.reject('error2')
	 *   ]).run();
	 * } catch (err) {
	 *   console.log(err.errors); // ['error1', 'error2']
	 * }
	 * ```
	 */
	static any<T>(tasks: FuturableTask<T>[], signal?: AbortSignal): FuturableTask<T> {
		return new FuturableTask((res, rej, utils) => {
			Futurable
				.any(tasks.map(t => t.run(utils.signal)), utils.signal)
				.then(res)
				.catch(rej);
		}, signal);
	}

	/**
	 * Creates a FuturableTask that resolves after a specified delay.
	 *
	 * The delay is lazy - it only starts when run() is called.
	 * The task resolves with void (no value).
	 *
	 * Useful for adding delays in task chains or implementing backoff strategies.
	 *
	 * @param ms - Delay duration in milliseconds
	 * @param signal - Optional AbortSignal for the task
	 * @returns A FuturableTask that resolves after the delay
	 *
	 * @example
	 * ```typescript
	 * await FuturableTask.delay(2000).run(); // Waits 2 seconds
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Chaining with delays
	 * await FuturableTask.resolve('Starting...')
	 *   .tap(console.log)
	 *   .andThen(FuturableTask.delay(1000))
	 *   .andThen(FuturableTask.resolve('Done!'))
	 *   .tap(console.log)
	 *   .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Cancellable delay
	 * const delayTask = FuturableTask.delay(5000);
	 * delayTask.run();
	 * delayTask.cancel(); // Cancels the delay
	 * ```
	 */
	static delay(ms: number, signal?: AbortSignal): FuturableTask<void> {
		return new FuturableTask<void>((res, rej, utils) => {
			utils
				.sleep(ms)
				.then(res)
				.catch(rej);
		}, signal);
	}

	/**
	 * Creates a FuturableTask from an event listener on a given target.
	 *
	 * The listener is only attached when run() is called, and automatically
	 * unsubscribes after the first occurrence to maintain single-value semantics.
	 *
	 * If the task is cancelled before the event fires, the listener is properly
	 * removed to prevent memory leaks.
	 *
	 * @template E - The type of the Event object
	 * @param target - The DOM element, Window, or event target
	 * @param name - The name of the event to listen for (e.g., 'click', 'message')
	 * @param opts - Standard listener options like capture, passive, or once
	 * @param signal - Optional AbortSignal for the task
	 * @returns A new FuturableTask that resolves with the Event object
	 *
	 * @example
	 * ```typescript
	 * // Listen for a one-time click
	 * const clickTask = FuturableTask.fromEvent(
	 *   document.getElementById('myBtn'),
	 *   'click',
	 *   { passive: true }
	 * );
	 *
	 * const event = await clickTask.run();
	 * console.log('Button clicked at:', event.timeStamp);
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With timeout
	 * try {
	 *   const event = await FuturableTask
	 *     .fromEvent(button, 'click')
	 *     .timeout(5000, new Error('No click within 5 seconds'))
	 *     .run();
	 * } catch (err) {
	 *   console.log('Timed out waiting for click');
	 * }
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Cancellable event listener
	 * const task = FuturableTask.fromEvent(window, 'resize');
	 * task.run();
	 * // ... later
	 * task.cancel(); // Removes the listener
	 * ```
	 */
	static fromEvent<E extends Event>(target: EventTarget, name: string, opts?: AddEventListenerOptions, signal?: AbortSignal): FuturableTask<E> {
		return new FuturableTask<E>((res, rej, utils) => {
			utils.onCancel(() => target.removeEventListener(name, handler));
			const handler = (e: Event) => {
				!opts?.once && target.removeEventListener(name, handler);
				res(e as E);
			}
			target.addEventListener(name, handler, opts);
		}, signal);
	}

	/**
	 * Executes an array of tasks sequentially, one after another.
	 *
	 * Each task waits for the previous one to complete before starting.
	 * If any task fails, the sequence stops and the error is propagated.
	 *
	 * Returns an array of all results in order.
	 *
	 * @template T - Type of values the tasks produce
	 * @param tasks - Array of FuturableTasks to execute in sequence
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with an array of all results
	 *
	 * @example
	 * ```typescript
	 * const tasks = [
	 *   FuturableTask.of(() => step1()),
	 *   FuturableTask.of(() => step2()),
	 *   FuturableTask.of(() => step3())
	 * ];
	 *
	 * const results = await FuturableTask.sequence(tasks).run();
	 * // step1 completes, then step2, then step3
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Database migrations in order
	 * const migrations = [
	 *   FuturableTask.of(() => createUsersTable()),
	 *   FuturableTask.of(() => createPostsTable()),
	 *   FuturableTask.of(() => addForeignKeys())
	 * ];
	 * await FuturableTask.sequence(migrations).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With delays between steps
	 * const steps = [
	 *   FuturableTask.of(() => init()),
	 *   FuturableTask.delay(1000).andThen(FuturableTask.of(() => warmup())),
	 *   FuturableTask.delay(2000).andThen(FuturableTask.of(() => start()))
	 * ];
	 * await FuturableTask.sequence(steps).run();
	 * ```
	 */
	static sequence<T>(tasks: FuturableTask<T>[], signal?: AbortSignal): FuturableTask<T[]> {
		return new FuturableTask<T[]>(async (res, rej, utils) => {
			const results: T[] = [];
			try {
				for (const t of tasks) {
					if (utils.signal.aborted) return;
					results.push(await t.run(utils.signal));
				}
				res(results);
			} catch (error) {
				rej(error);
			}
		}, signal);
	}

	/**
	 * Executes tasks in parallel with a concurrency limit.
	 *
	 * Limits the number of tasks running simultaneously. When a task completes,
	 * the next queued task starts. If any task fails, all running tasks are
	 * cancelled and the error is propagated.
	 *
	 * Returns results in the same order as input tasks.
	 *
	 * @template T - Type of value the tasks produce
	 * @param tasks - Array of FuturableTasks
	 * @param limit - Maximum number of concurrent executions (default: 5)
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with an array of all results
	 *
	 * @example
	 * ```typescript
	 * // Process 100 items with max 5 concurrent operations
	 * const tasks = items.map(item =>
	 *   FuturableTask.of(() => processItem(item))
	 * );
	 *
	 * const results = await FuturableTask.parallel(tasks, 5).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // API rate limiting - max 3 concurrent requests
	 * const userTasks = userIds.map(id =>
	 *   FuturableTask.of(() => fetch(`/api/users/${id}`))
	 * );
	 *
	 * const users = await FuturableTask.parallel(userTasks, 3).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With error handling
	 * try {
	 *   const results = await FuturableTask.parallel(tasks, 10).run();
	 * } catch (err) {
	 *   // One task failed, all running tasks were cancelled
	 * }
	 * ```
	 */
	static parallel<T>(tasks: FuturableTask<T>[], limit = 5, signal?: AbortSignal): FuturableTask<T[]> {
		return new FuturableTask<T[]>(async (res, rej, utils) => {
			const results: T[] = new Array(tasks.length);
			const runningTasks: Futurable<T>[] = [];
			let running = 0,
				completed = 0,
				index = 0,
				failed = false;
			utils.onCancel(() => {
				failed = true;
				runningTasks.forEach(t => t.cancel());
			});
			const next = (resolve: Function, reject: Function) => {
				if (failed) {
					return;
				}
				if (completed === tasks.length) {
					return resolve(results);
				}
				while (running < limit && index < tasks.length) {
					const i = index++;
					running++;
					const futurable = tasks[i].run(utils.signal);
					runningTasks.push(futurable);
					futurable
						.then((v: T) => {
							results[i] = v;
							running--;
							completed++;
							const idx = runningTasks.indexOf(futurable);
							idx !== -1 && runningTasks.splice(idx, 1);
							next(resolve, reject);
						})
						.catch((e: any) => {
							failed = true;
							runningTasks.forEach(t => t.cancel());
							reject(e);
						});
				}
			};
			next(res, rej);
		}, signal);
	}

	/**
	 * Creates a higher-order function (limiter) to control the maximum number
	 * of concurrent executions for a set of Tasks.
	 *
	 * Tasks do not enter the queue or increment the running counter until
	 * their .run() method is explicitly called. Tasks are processed FIFO.
	 *
	 * Optional event hooks allow tracking active tasks, completions, errors, and idle states.
	 *
	 * The returned limiter function wraps tasks and includes readonly properties
	 * for monitoring (activeCount, pendingCount, concurrency).
	 *
	 * @param concurrency - Maximum number of tasks allowed to run simultaneously (must be >= 1)
	 * @param events - Optional lifecycle hooks for monitoring
	 * @param signal - Optional AbortSignal for the limiter
	 * @returns A decorator function that limits task concurrency
	 *
	 * @example
	 * ```typescript
	 * const limiter = FuturableTask.createLimiter(2, {
	 *   onActive: (task) => console.log('Task started'),
	 *   onCompleted: (result) => console.log('Task completed:', result),
	 *   onIdle: () => console.log('All tasks finished!')
	 * });
	 *
	 * // Wrap your original tasks
	 * const tasks = [1,2,3,4,5].map(i => limiter(
	 *   FuturableTask.of(async () => {
	 *     await delay(1000);
	 *     return i;
	 *   })
	 * ));
	 *
	 * // Execution starts here, respects limit of 2
	 * const results = await FuturableTask.all(tasks).run();
	 * console.log(results); // [1, 2, 3, 4, 5]
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Monitoring limiter state
	 * const limiter = FuturableTask.createLimiter(3);
	 *
	 * console.log(limiter.concurrency);  // 3
	 * console.log(limiter.activeCount);  // 0
	 * console.log(limiter.pendingCount); // 0
	 *
	 * const task = limiter(FuturableTask.of(() => operation()));
	 * task.run();
	 *
	 * console.log(limiter.activeCount);  // 1
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // API rate limiting
	 * const apiLimiter = FuturableTask.createLimiter(5, {
	 *   onError: (err) => logger.error('API call failed', err)
	 * });
	 *
	 * const fetchUser = (id) => apiLimiter(
	 *   FuturableTask.of(() => fetch(`/api/users/${id}`))
	 * );
	 *
	 * const users = await FuturableTask.all(
	 *   userIds.map(fetchUser)
	 * ).run();
	 * ```
	 */
	static createLimiter(concurrency: number, events: LimiterEvents = {}, signal?: AbortSignal): FuturableTaskLimiter {
		let running = 0;
		const queue: (() => void)[] = [];
		const next = () => {
			while (running < concurrency && queue.length > 0) {
				const nextTask = queue.shift();
				nextTask && nextTask();
			}
			if (running === 0 && queue.length === 0) {
				events.onIdle?.();
			}
		}
		const limiter = <T>(task: FuturableTask<T>) => new FuturableTask<T>((res, rej, utils) => {
			let isWaiting = false;
			const execute = () => {
				isWaiting = false;
				running++;
				events.onActive?.(task);
				task
					.run(utils.signal)
					.then(result => {
						events.onCompleted?.(result);
						res(result);
					})
					.catch(err => {
						events.onError?.(err);
						rej(err);
					})
					.finally(() => {
						running--;
						next();
					})
			}
			utils.onCancel(() => {
				if (isWaiting) {
					const idx = queue.indexOf(execute);
					if (idx !== -1) {
						queue.splice(idx, 1);
					}
					next();
				}
			});
			if (running < concurrency) {
				execute();
			} else {
				isWaiting = true;
				queue.push(execute);
			}
		}, signal);

		Object.defineProperties(
			limiter,
			{
				activeCount: { get: () => running },
				pendingCount: { get: () => queue.length },
				concurrency: { get: () => concurrency }
			}
		);
		return limiter as FuturableTaskLimiter;
	}

	/**
	 * Composes a FuturableTask through a sequence of transformation operators.
	 *
	 * Applies operators from left to right, similar to pipe but starting with
	 * an initial task. Type-safe composition ensures each operator's output
	 * matches the next operator's input.
	 *
	 * Useful for building reusable task pipelines.
	 *
	 * @template T - The type of the value produced by the initial task
	 * @template R - The type of the value produced by the final task
	 * @param initial - The starting FuturableTask to transform
	 * @param operators - Variadic list of transformation functions
	 * @returns A new FuturableTask representing the composed operations
	 *
	 * @example
	 * ```typescript
	 * // Linear composition
	 * const finalTask = FuturableTask.compose(
	 *   FuturableTask.of(() => fetchUser(1)),
	 *   (t) => t.retry(3),
	 *   (t) => t.timeout(5000),
	 *   (t) => t.map(user => user.name)
	 * );
	 *
	 * const name = await finalTask.run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Building reusable pipelines
	 * const robustAPI = <T>(task: FuturableTask<T>) =>
	 *   FuturableTask.compose(
	 *     task,
	 *     t => t.retry(3, 1000),
	 *     t => t.timeout(10000),
	 *     t => t.tapError(err => logger.error(err))
	 *   );
	 *
	 * const userData = await robustAPI(
	 *   FuturableTask.of(() => fetch('/api/user'))
	 * ).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Data processing pipeline
	 * const processData = FuturableTask.compose(
	 *   FuturableTask.of(() => loadRawData()),
	 *   t => t.map(data => validate(data)),
	 *   t => t.map(data => transform(data)),
	 *   t => t.flatMap(data => FuturableTask.of(() => save(data)))
	 * );
	 * ```
	 */
	static compose<T, R>(initial: FuturableTask<T>, ...operators: Array<(t: FuturableTask<any>) => FuturableTask<any>>): FuturableTask<R> {
		return operators.reduce((acc, op) => op(acc), initial) as unknown as FuturableTask<R>;
	}

	/**
	 * Filters an array of tasks based on a predicate.
	 *
	 * Executes all tasks sequentially, then applies the predicate to each result.
	 * Only values that pass the predicate are included in the final array.
	 *
	 * The predicate can be async, allowing for asynchronous filtering logic.
	 *
	 * @template T - Type of values the tasks produce
	 * @param tasks - Array of tasks to filter
	 * @param predicate - Function to test each value (can be async)
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with filtered values
	 *
	 * @example
	 * ```typescript
	 * const tasks = [
	 *   FuturableTask.resolve(1),
	 *   FuturableTask.resolve(2),
	 *   FuturableTask.resolve(3),
	 *   FuturableTask.resolve(4)
	 * ];
	 *
	 * const evenNumbers = await FuturableTask
	 *   .filter(tasks, n => n % 2 === 0)
	 *   .run(); // [2, 4]
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Async filtering
	 * const userTasks = ids.map(id => FuturableTask.of(() => fetchUser(id)));
	 *
	 * const activeUsers = await FuturableTask.filter(
	 *   userTasks,
	 *   async user => await isActive(user.id)
	 * ).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Filtering with validation
	 * const results = await FuturableTask.filter(
	 *   dataTasks,
	 *   data => data.isValid && data.score > 0.5
	 * ).run();
	 * ```
	 */
	static filter<T>(tasks: FuturableTask<T>[], predicate: (value: T) => boolean | Promise<boolean>, signal?: AbortSignal): FuturableTask<T[]> {
		return new FuturableTask<T[]>(async (res, rej, utils) => {
			const results: T[] = [];
			try {
				for (const task of tasks) {
					if (utils.signal.aborted) return;
					const value = await task.run(utils.signal);
					if (await predicate(value)) {
						results.push(value);
					}
				}
				res(results);
			} catch (error) {
				rej(error);
			}
		}, signal);
	}

	/**
	 * Reduces an array of tasks to a single value.
	 *
	 * Executes tasks sequentially, accumulating a result by applying the reducer
	 * function to each task's value. The reducer receives the accumulator, current
	 * value, and index.
	 *
	 * The reducer can be async.
	 *
	 * @template T - Type of values the tasks produce
	 * @template U - Type of the accumulated result
	 * @param tasks - Array of tasks to reduce
	 * @param reducer - Function to accumulate results (can be async)
	 * @param initialValue - Initial value for the accumulator
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with the final accumulated value
	 *
	 * @example
	 * ```typescript
	 * const tasks = [
	 *   FuturableTask.resolve(1),
	 *   FuturableTask.resolve(2),
	 *   FuturableTask.resolve(3)
	 * ];
	 *
	 * const sum = await FuturableTask
	 *   .reduce(tasks, (acc, n) => acc + n, 0)
	 *   .run(); // 6
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Building an object from tasks
	 * const userTasks = ids.map(id => FuturableTask.of(() => fetchUser(id)));
	 *
	 * const userMap = await FuturableTask.reduce(
	 *   userTasks,
	 *   (map, user) => ({ ...map, [user.id]: user }),
	 *   {}
	 * ).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Async reducer
	 * const total = await FuturableTask.reduce(
	 *   tasks,
	 *   async (acc, value) => {
	 *     const processed = await processValue(value);
	 *     return acc + processed;
	 *   },
	 *   0
	 * ).run();
	 * ```
	 */
	static reduce<T, U>(tasks: FuturableTask<T>[], reducer: (acc: U, value: T, index: number) => U | Promise<U>, initialValue: U, signal?: AbortSignal): FuturableTask<U> {
		return new FuturableTask<U>(async (res, rej, utils) => {
			let acc = initialValue;
			try {
				for (let i = 0; i < tasks.length; i++) {
					if (utils.signal.aborted) return;
					const value = await tasks[i].run(utils.signal);
					acc = await reducer(acc, value, i);
				}
				res(acc);
			} catch (error) {
				rej(error);
			}
		}, signal);
	}

	/**
	 * Repeatedly executes a task while a condition is true.
	 *
	 * Evaluates the condition before each execution. Stops when the condition
	 * returns false or the task fails. Returns an array of all results.
	 *
	 * The condition can be async.
	 *
	 * @template T - Type of value the task produces
	 * @param condition - Predicate evaluated before each execution (can be async)
	 * @param task - The task to execute repeatedly
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with an array of all results
	 *
	 * @example
	 * ```typescript
	 * let counter = 0;
	 * const incrementTask = FuturableTask.of(() => ++counter);
	 *
	 * const results = await FuturableTask
	 *   .whilst(() => counter < 5, incrementTask)
	 *   .run(); // [1, 2, 3, 4, 5]
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Async condition
	 * const results = await FuturableTask.whilst(
	 *   async () => await hasMoreData(),
	 *   FuturableTask.of(() => fetchNextBatch())
	 * ).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Paginated fetching
	 * let page = 1;
	 * let hasMore = true;
	 *
	 * const allData = await FuturableTask.whilst(
	 *   () => hasMore,
	 *   FuturableTask.of(async () => {
	 *     const response = await fetchPage(page++);
	 *     hasMore = response.hasMore;
	 *     return response.data;
	 *   })
	 * ).run();
	 * ```
	 */
	static whilst<T>(condition: () => boolean | Promise<boolean>, task: FuturableTask<T>, signal?: AbortSignal): FuturableTask<T[]> {
		return new FuturableTask<T[]>(async (res, rej, utils) => {
			const results: T[] = [];
			try {
				while (await condition()) {
					if (utils.signal.aborted) return;
					results.push(await task.run(utils.signal));
				}
				res(results);
			} catch (error) {
				rej(error);
			}
		}, signal);
	}

	/**
	 * Repeatedly executes a task until a condition becomes true.
	 *
	 * Opposite of whilst - executes while the condition is false.
	 * Evaluates the condition before each execution.
	 *
	 * The condition can be async.
	 *
	 * @template T - Type of value the task produces
	 * @param condition - Predicate that stops execution when true (can be async)
	 * @param task - The task to execute repeatedly
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with an array of all results
	 *
	 * @example
	 * ```typescript
	 * let counter = 0;
	 * const incrementTask = FuturableTask.of(() => ++counter);
	 *
	 * const results = await FuturableTask
	 *   .until(() => counter >= 5, incrementTask)
	 *   .run(); // [1, 2, 3, 4, 5]
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Polling until success
	 * const results = await FuturableTask.until(
	 *   async () => await isReady(),
	 *   FuturableTask.of(() => checkStatus()).delay(1000)
	 * ).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Retry until success or limit reached
	 * let attempts = 0;
	 * const MAX_ATTEMPTS = 10;
	 *
	 * await FuturableTask.until(
	 *   () => attempts >= MAX_ATTEMPTS,
	 *   FuturableTask.of(async () => {
	 *     attempts++;
	 *     return await tryOperation();
	 *   }).orElse(() => FuturableTask.resolve(null))
	 * ).run();
	 * ```
	 */
	static until<T>(condition: () => boolean | Promise<boolean>, task: FuturableTask<T>, signal?: AbortSignal): FuturableTask<T[]> {
		return FuturableTask.whilst(
			async () => !(await condition()),
			task,
			signal
		);
	}

	/**
	 * Executes a task factory n times, collecting all results.
	 *
	 * The factory receives the current index (0 to n-1) and returns a task.
	 * Executes sequentially. If any execution fails, the entire operation fails.
	 *
	 * @template T - Type of value the tasks produce
	 * @param n - Number of times to execute (must be >= 0)
	 * @param taskFactory - Function that creates a task for each iteration
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with an array of all results
	 *
	 * @example
	 * ```typescript
	 * const results = await FuturableTask
	 *   .times(5, i => FuturableTask.resolve(i * 2))
	 *   .run(); // [0, 2, 4, 6, 8]
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Fetch multiple pages
	 * const pages = await FuturableTask.times(
	 *   10,
	 *   i => FuturableTask.of(() => fetch(`/api/data?page=${i}`))
	 * ).run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Create test data
	 * const users = await FuturableTask.times(
	 *   100,
	 *   i => FuturableTask.of(() => createUser({
	 *     name: `User ${i}`,
	 *     email: `user${i}@example.com`
	 *   }))
	 * ).run();
	 * ```
	 */
	static times<T>(n: number, taskFactory: (index: number) => FuturableTask<T>, signal?: AbortSignal): FuturableTask<T[]> {
		return new FuturableTask<T[]>(async (res, rej, utils) => {
			const results: T[] = [];
			try {
				for (let i = 0; i < n; i++) {
					if (utils.signal.aborted) return;
					results.push(await taskFactory(i).run(utils.signal));
				}
				res(results);
			} catch (error) {
				rej(error);
			}
		}, signal);
	}

	/**
	 * Maps an array of values to tasks and executes them in sequence.
	 *
	 * Combines map and sequence - applies a function to each value to create a task,
	 * then executes all tasks sequentially.
	 *
	 * The mapping function receives both the value and its index.
	 *
	 * @template T - Type of input values
	 * @template U - Type of values the tasks produce
	 * @param values - Array of values to map
	 * @param fn - Function that maps each value to a task
	 * @param signal - Optional AbortSignal for the combined task
	 * @returns A FuturableTask that resolves with an array of all results
	 *
	 * @example
	 * ```typescript
	 * const userIds = [1, 2, 3, 4, 5];
	 * const users = await FuturableTask
	 *   .traverse(userIds, id => FuturableTask.of(() => fetchUser(id)))
	 *   .run();
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // With index
	 * const results = await FuturableTask.traverse(
	 *   ['a', 'b', 'c'],
	 *   (letter, index) => FuturableTask.of(() => `${index}: ${letter}`)
	 * ).run(); // ['0: a', '1: b', '2: c']
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // Processing files sequentially
	 * const processed = await FuturableTask.traverse(
	 *   filePaths,
	 *   path => FuturableTask.of(() => processFile(path))
	 * ).run();
	 * ```
	 */
	static traverse<T, U>(values: T[], fn: (value: T, index: number) => FuturableTask<U>, signal?: AbortSignal): FuturableTask<U[]> {
		return FuturableTask.sequence(
			values.map((v, i) => fn(v, i)),
			signal
		);
	}

	/**
 * Static method to create a fetch task directly.
 *
 * @param url - The URL to fetch
 * @param opts - Optional Fetch API options
 * @param signal - Optional AbortSignal for the task
 * @returns A FuturableTask that resolves with the Response
 *
 * @example
 * ```typescript
 * const task = FuturableTask.fetch('https://api.example.com/data')
 *   .map(res => res.json())
 *   .retry(3);
 *
 * const data = await task.run();
 * ```
 */
	static fetch(url: string, opts?: RequestInit, signal?: AbortSignal): FuturableTask<Response> {
		return new FuturableTask<Response>((res, rej, utils) => {
			const fetchOpts: RequestInit = {
				...opts,
				signal: utils.signal
			};
			utils.fetch(url, fetchOpts)
				.then(res)
				.catch(rej);
		}, signal);
	}
}