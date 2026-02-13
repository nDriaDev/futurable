import { describe, it } from 'node:test';
import { FuturableTask } from './FuturableTask.js';
import assert from 'node:assert';

describe('FuturableTask', () => {
  describe('Constructor', () => {
    it('should create a task without executing', () => {
      let executed = false;
      const task = new FuturableTask<number>((resolve) => {
        executed = true;
        resolve(42);
      });

      assert.strictEqual(executed, false);
    });

    it('should expose signal property', () => {
      const task = new FuturableTask(resolve => resolve(1));
      assert.ok(task.signal);
      assert.strictEqual(task.signal.aborted, false);
    });

    it('should link external signal', () => {
      const controller = new AbortController();
      const task = new FuturableTask(
        resolve => resolve(1),
        controller.signal
      );

      controller.abort();
      assert.ok(task.signal.aborted);
    });

    it('should handle already aborted external signal', () => {
      const controller = new AbortController();
      controller.abort();

      const task = new FuturableTask(
        resolve => resolve(1),
        controller.signal
      );

      assert.ok(task.signal.aborted);
    });
  });

  describe('cancel() method', () => {
    it('should abort the signal', () => {
      const task = new FuturableTask(resolve => resolve(1));

      task.cancel();
      assert.ok(task.signal.aborted);
    });

    it('should be idempotent', () => {
      const task = new FuturableTask(resolve => resolve(1));

      task.cancel();
      task.cancel();
      task.cancel();

      assert.ok(task.signal.aborted);
    });

    it('should trigger onCancel callbacks', async () => {
      let callbackCalled = false;
      const task = new FuturableTask<number>(resolve => {
        resolve(1);
      }).onCancel(() => {
        callbackCalled = true;
      });

      task.cancel();
      await new Promise(r => setTimeout(r, 10));
      assert.ok(callbackCalled);
    });

    it('should execute multiple onCancel callbacks', async () => {
      let count = 0;
      const task = new FuturableTask<number>(resolve => resolve(1))
        .onCancel(() => count++)
        .onCancel(() => count++)
        .onCancel(() => count++);

      task.cancel();
      await new Promise(r => setTimeout(r, 10));
      assert.strictEqual(count, 3);
    });
  });

  describe('onCancel() method', () => {
    it('should register callback', () => {
      let called = false;
      const task = new FuturableTask(resolve => resolve(1))
        .onCancel(() => { called = true; });

      task.cancel();
      assert.ok(called);
    });

    it('should return same instance for chaining', () => {
      const task = new FuturableTask(resolve => resolve(1));
      const result = task.onCancel(() => {});

      assert.strictEqual(result, task);
    });

    it('should execute even if task never ran', () => {
      let called = false;
      const task = new FuturableTask(resolve => {
        setTimeout(() => resolve(1), 1000);
      }).onCancel(() => { called = true; });

      task.cancel();
      assert.ok(called);
    });
  });

  describe('run() method', () => {
    it('should execute the task', async () => {
      let executed = false;
      const task = new FuturableTask<number>(resolve => {
        executed = true;
        resolve(42);
      });

      const result = await task.run();

      assert.ok(executed);
      assert.strictEqual(result, 42);
    });

    it('should create independent executions', async () => {
      let count = 0;
      const task = new FuturableTask<number>(resolve => {
        count++;
        resolve(count);
      });

      const result1 = await task.run();
      const result2 = await task.run();

      assert.strictEqual(result1, 1);
      assert.strictEqual(result2, 2);
    });

    it('should respect task cancellation', async () => {
      const task = new FuturableTask<number>(resolve => {
        setTimeout(() => resolve(1), 100);
      });

      const run = task.run();
      task.cancel();

      assert.ok(run.signal.aborted);
    });

    it('should handle override signal', async () => {
      const task = new FuturableTask<number>(resolve => {
        setTimeout(() => resolve(1), 100);
      });

      const controller = new AbortController();
      const run = task.run(controller.signal);

      controller.abort();

      assert.ok(run.signal.aborted);
      assert.strictEqual(task.signal.aborted, false);
    });

    it('should create composite signal from task and override', async () => {
      const task = new FuturableTask<number>(resolve => {
        setTimeout(() => resolve(1), 100);
      });

      const controller = new AbortController();
      const run = task.run(controller.signal);

      task.cancel();

      assert.ok(run.signal.aborted);
    });

    it('should return pending futurable when cancelled', async () => {
      const task = new FuturableTask<number>(resolve => {
        setTimeout(() => resolve(1), 100);
      });

      task.cancel();
      const run = task.run();

      let settled = false;
      run.then(() => { settled = true; }).catch(() => { settled = true; });

      await new Promise(r => setTimeout(r, 150));
      assert.strictEqual(settled, false);
    });

    it('should handle already aborted override signal', async () => {
      const task = new FuturableTask<number>(resolve => resolve(1));
      const controller = new AbortController();
      controller.abort();

      const run = task.run(controller.signal);
      assert.ok(run.signal.aborted);
    });
  });

  describe('memoize() method', () => {
    it('should cache first execution result', async () => {
      let count = 0;
      const task = new FuturableTask<number>(resolve => {
        count++;
        resolve(count);
      }).memoize();

      const result1 = await task.run();
      const result2 = await task.run();
      const result3 = await task.run();

      assert.strictEqual(result1, 1);
      assert.strictEqual(result2, 1);
      assert.strictEqual(result3, 1);
      assert.strictEqual(count, 1);
    });

    it('should clear cache on error by default', async () => {
      let count = 0;
      const task = new FuturableTask<number>((resolve, reject) => {
        count++;
        if (count === 1) {
          reject('error');
        } else {
          resolve(count);
        }
      }).memoize();

      try {
        await task.run();
      } catch (e) {}

      const result = await task.run();
      assert.strictEqual(result, 2);
    });

    it('should cache errors when catchErrors is true', async () => {
      let count = 0;
      const task = new FuturableTask<number>((resolve, reject) => {
        count++;
        reject(`error${count}`);
      }).memoize(true);

      try {
        await task.run();
      } catch (e) {
        assert.strictEqual(e, 'error1');
      }

      try {
        await task.run();
      } catch (e) {
        assert.strictEqual(e, 'error1');
      }

      assert.strictEqual(count, 1);
    });

    it('should return new task instance', () => {
      const task = new FuturableTask(resolve => resolve(1));
      const memoized = task.memoize();

      assert.notStrictEqual(task, memoized);
    });

    it('should clear cache if cached futurable is cancelled', async () => {
      let count = 0;
      const task = new FuturableTask<number>(resolve => {
        setTimeout(() => {
          count++;
          resolve(count);
        }, 50);
      }).memoize();

      const run1 = task.run();
      run1.cancel();

      await new Promise(r => setTimeout(r, 100));

      const result = await task.run();
      assert.strictEqual(result, 2);
    });
  });

  describe('map() method', () => {
    it('should transform the value', async () => {
      const task = FuturableTask.resolve(5).map(x => x * 2);
      const result = await task.run();

      assert.strictEqual(result, 10);
    });

    it('should handle async transformation', async () => {
      const task = FuturableTask.resolve(5).map(async x => {
        await new Promise(r => setTimeout(r, 10));
        return x * 3;
      });

      const result = await task.run();
      assert.strictEqual(result, 15);
    });

    it('should pass signal to mapping function', async () => {
      let receivedSignal: AbortSignal | undefined;
      const task = FuturableTask.resolve(1).map((val, signal) => {
        receivedSignal = signal;
        return val;
      });

      await task.run();
      assert.ok(receivedSignal);
    });

    it('should propagate cancellation', async () => {
      const task = FuturableTask.resolve(1)
        .map(async x => {
          await new Promise(r => setTimeout(r, 100));
          return x * 2;
        });

      const run = task.run();
      task.cancel();

      assert.ok(run.signal.aborted);
    });

    it('should chain multiple maps', async () => {
      const result = await FuturableTask.resolve(2)
        .map(x => x + 3)
        .map(x => x * 2)
        .map(x => x - 1)
        .run();

      assert.strictEqual(result, 9); // ((2+3)*2)-1
    });
  });

  describe('flatMap() method', () => {
    it('should chain tasks', async () => {
      const task = FuturableTask.resolve(5)
        .flatMap(x => FuturableTask.resolve(x * 2));

      const result = await task.run();
      assert.strictEqual(result, 10);
    });

    it('should handle nested async operations', async () => {
      const getUserTask = FuturableTask.resolve({ id: 1, name: 'Alice' });
      const getPostsTask = (user: { id: number }) =>
        FuturableTask.resolve([`post1 by ${user.id}`, `post2 by ${user.id}`]);

      const posts = await getUserTask.flatMap(getPostsTask).run();

      assert.deepStrictEqual(posts, ['post1 by 1', 'post2 by 1']);
    });

    it('should propagate cancellation', async () => {
      const task = FuturableTask.resolve(1)
        .flatMap(() => FuturableTask.of(() => {
          return new Promise(r => setTimeout(() => r(2), 100));
        }));

      const run = task.run();
      task.cancel();

      await new Promise(r => setTimeout(r, 150));
      assert.ok(run.signal.aborted);
    });

    it('should propagate errors', async () => {
      const task = FuturableTask.resolve(1)
        .flatMap(() => FuturableTask.reject('error'));

      await assert.rejects(task.run(), /error/);
    });
  });

  describe('andThen() method', () => {
    it('should sequence tasks', async () => {
      let order: number[] = [];

      const task1 = FuturableTask.of(() => {
        order.push(1);
        return 'first';
      });

      const task2 = FuturableTask.of(() => {
        order.push(2);
        return 'second';
      });

      const result = await task1.andThen(task2).run();

      assert.deepStrictEqual(order, [1, 2]);
      assert.strictEqual(result, 'second');
    });

    it('should discard first result', async () => {
      const result = await FuturableTask.resolve('ignored')
        .andThen(FuturableTask.resolve('used'))
        .run();

      assert.strictEqual(result, 'used');
    });
  });

  describe('tap() method', () => {
    it('should execute side effect without changing value', async () => {
      let sideEffect = 0;

      const result = await FuturableTask.resolve(42)
        .tap(x => { sideEffect = x * 2; })
        .run();

      assert.strictEqual(result, 42);
      assert.strictEqual(sideEffect, 84);
    });

    it('should handle async side effects', async () => {
      let logged: number[] = [];

      const result = await FuturableTask.resolve(5)
        .tap(async x => {
          await new Promise(r => setTimeout(r, 10));
          logged.push(x);
        })
        .map(x => x * 2)
        .tap(async x => {
          await new Promise(r => setTimeout(r, 10));
          logged.push(x);
        })
        .run();

      assert.strictEqual(result, 10);
      assert.deepStrictEqual(logged, [5, 10]);
    });

    it('should propagate errors from side effects', async () => {
      await assert.rejects(
        FuturableTask.resolve(1)
          .tap(() => { throw new Error('tap error'); })
          .run(),
        /tap error/
      );
    });
  });

  describe('tapError() method', () => {
    it('should execute side effect on error', async () => {
      let errorLogged: any = null;

      try {
        await FuturableTask.reject('test error')
          .tapError(err => { errorLogged = err; })
          .run();
      } catch (e) {}

      assert.strictEqual(errorLogged, 'test error');
    });

    it('should not execute on success', async () => {
      let called = false;

      await FuturableTask.resolve(42)
        .tapError(() => { called = true; })
        .run();

      assert.strictEqual(called, false);
    });

    it('should propagate original error', async () => {
      await assert.rejects(
        FuturableTask.reject('original')
          .tapError(() => {})
          .run(),
        /original/
      );
    });

    it('should handle async side effects', async () => {
      let logged = '';

      try {
        await FuturableTask.reject('error')
          .tapError(async err => {
            await new Promise(r => setTimeout(r, 10));
            logged = err;
          })
          .run();
      } catch (e) {}

      assert.strictEqual(logged, 'error');
    });

    it('should log errors in tapError callback', async () => {
      const originalLog = console.error;
      let loggedMessage = '';
      console.error = (msg: string) => { loggedMessage = msg; };

      try {
        await FuturableTask.reject('original')
          .tapError(() => { throw new Error('callback error'); })
          .run();
      } catch (e) {}

      console.error = originalLog;
      assert.ok(loggedMessage.includes('tapError callback failed'));
    });
  });

  describe('catchError() method', () => {
    it('should recover from error', async () => {
      const result = await FuturableTask.reject('error')
        .catchError(() => FuturableTask.resolve('recovered'))
        .run();

      assert.strictEqual(result, 'recovered');
    });

    it('should not catch success', async () => {
      const result = await FuturableTask.resolve(42)
        .catchError(() => FuturableTask.resolve(0))
        .run();

      assert.strictEqual(result, 42);
    });

    it('should allow different return type', async () => {
      const result: number | null = await FuturableTask.reject('error')
        .catchError(() => FuturableTask.resolve(null))
        .run();

      assert.strictEqual(result, null);
    });
  });

  describe('orElse() method', () => {
    it('should provide fallback on error', async () => {
      const result = await FuturableTask.reject('error')
        .orElse(() => FuturableTask.resolve(100))
        .run();

      assert.strictEqual(result, 100);
    });

    it('should not use fallback on success', async () => {
      const result = await FuturableTask.resolve(42)
        .orElse(() => FuturableTask.resolve(100))
        .run();

      assert.strictEqual(result, 42);
    });

    it('should chain multiple fallbacks', async () => {
      const result = await FuturableTask.reject('error1')
        .orElse(() => FuturableTask.reject('error2'))
        .orElse(() => FuturableTask.resolve('final fallback'))
        .run();

      assert.strictEqual(result, 'final fallback');
    });
  });

  describe('fallbackTo() method', () => {
    it('should return fallback value on error', async () => {
      const result = await FuturableTask.reject('error')
        .fallbackTo(42)
        .run();

      assert.strictEqual(result, 42);
    });

    it('should return original value on success', async () => {
      const result = await FuturableTask.resolve(100)
        .fallbackTo(42)
        .run();

      assert.strictEqual(result, 100);
    });

    it('should work with null/undefined', async () => {
      const result = await FuturableTask.reject('error')
        .fallbackTo(null)
        .run();

      assert.strictEqual(result, null);
    });
  });

  describe('ifElse() method', () => {
    it('should branch based on condition', async () => {
      const result = await FuturableTask.resolve(10)
        .ifElse(
          x => x > 5,
          x => FuturableTask.resolve(`greater: ${x}`),
          x => FuturableTask.resolve(`lesser: ${x}`)
        )
        .run();

      assert.strictEqual(result, 'greater: 10');
    });

    it('should take false branch', async () => {
      const result = await FuturableTask.resolve(3)
        .ifElse(
          x => x > 5,
          x => FuturableTask.resolve(`greater: ${x}`),
          x => FuturableTask.resolve(`lesser: ${x}`)
        )
        .run();

      assert.strictEqual(result, 'lesser: 3');
    });

    it('should handle async condition', async () => {
      const result = await FuturableTask.resolve(7)
        .ifElse(
          async x => {
            await new Promise(r => setTimeout(r, 10));
            return x % 2 === 0;
          },
          x => FuturableTask.resolve('even'),
          x => FuturableTask.resolve('odd')
        )
        .run();

      assert.strictEqual(result, 'odd');
    });
  });

  describe('fold() method', () => {
    it('should apply onSuccess transformation', async () => {
      const result = await FuturableTask.resolve(42)
        .fold(
          err => FuturableTask.resolve(`error: ${err}`),
          val => FuturableTask.resolve(`success: ${val}`)
        )
        .run();

      assert.strictEqual(result, 'success: 42');
    });

    it('should apply onFailure transformation', async () => {
      const result = await FuturableTask.reject('failed')
        .fold(
          err => FuturableTask.resolve(`error: ${err}`),
          val => FuturableTask.resolve(`success: ${val}`)
        )
        .run();

      assert.strictEqual(result, 'error: failed');
    });
  });

  describe('finally() method', () => {
    it('should execute cleanup on success', async () => {
      let cleaned = false;

      const result = await FuturableTask.resolve(42)
        .finally(() => { cleaned = true; })
        .run();

      assert.strictEqual(result, 42);
      assert.ok(cleaned);
    });

    it('should execute cleanup on error', async () => {
      let cleaned = false;

      try {
        await FuturableTask.reject('error')
          .finally(() => { cleaned = true; })
          .run();
      } catch (e) {}

      assert.ok(cleaned);
    });

    it('should propagate errors from cleanup', async () => {
      await assert.rejects(
        FuturableTask.resolve(1)
          .finally(() => { throw new Error('cleanup error'); })
          .run(),
        /cleanup error/
      );
    });
  });

  describe('timeout() method', () => {
    it('should reject on timeout', async () => {
      await assert.rejects(
        FuturableTask.of(() => new Promise(r => setTimeout(() => r(1), 200)))
          .timeout(100, new Error('Timeout!'))
          .run(),
        /Timeout!/
      );
    });

    it('should complete before timeout', async () => {
      const result = await FuturableTask.of(() =>
        new Promise(r => setTimeout(() => r(42), 50))
      )
        .timeout(200)
        .run();

      assert.strictEqual(result, 42);
    });

    it('should use default reason', async () => {
      await assert.rejects(
        FuturableTask.of(() => new Promise(r => setTimeout(() => r(1), 200)))
          .timeout(100)
          .run(),
        /TimeoutExceeded/
      );
    });

    it('should cancel task on timeout', async () => {
      const task = FuturableTask.of(() =>
        new Promise(r => setTimeout(() => r(1), 200))
      ).timeout(100);

      try {
        await task.run();
      } catch (e) {}

      // Timer should be cleared
    });
  });

  describe('delay() method', () => {
    it('should delay task execution', async () => {
      const start = Date.now();
      const result = await FuturableTask.resolve(42)
        .delay(100)
        .run();
      const elapsed = Date.now() - start;

      assert.strictEqual(result, 42);
      assert.ok(elapsed >= 100);
    });

    it('should be cancellable', async () => {
      const task = FuturableTask.resolve(1).delay(200);

      const run = task.run();
      setTimeout(() => task.cancel(), 50);

      await new Promise(r => setTimeout(r, 250));
      assert.ok(run.signal.aborted);
    });
  });

  describe('retry() method', () => {
    it('should retry on failure', async () => {
      let attempts = 0;
      const task = FuturableTask.of(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('fail');
        }
        return attempts;
      }).retry(3);

      const result = await task.run();
      assert.strictEqual(result, 3);
      assert.strictEqual(attempts, 3);
    });

    it('should not retry on success', async () => {
      let attempts = 0;
      const task = FuturableTask.of(() => {
        attempts++;
        return 42;
      }).retry(5);

      await task.run();
      assert.strictEqual(attempts, 1);
    });

    it('should fail after max retries', async () => {
      let attempts = 0;
      const task = FuturableTask.of(() => {
        attempts++;
        throw new Error(`attempt ${attempts}`);
      }).retry(2);

      await assert.rejects(task.run(), /attempt 3/);
      assert.strictEqual(attempts, 3); // initial + 2 retries
    });

    it('should delay between retries', async () => {
      let attempts = 0;
      const start = Date.now();

      const task = FuturableTask.of(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('fail');
        }
        return 'ok';
      }).retry(2, 100);

      await task.run();
      const elapsed = Date.now() - start;

      assert.ok(elapsed >= 200); // 2 delays of 100ms
    });

    it('should respect cancellation', async () => {
      let attempts = 0;
      const task = FuturableTask.of(() => {
        attempts++;
        throw new Error('fail');
      }).retry(10, 100);

      const run = task.run();
      setTimeout(() => task.cancel(), 150);

      try {
        await run;
      } catch (e) {}

      assert.ok(attempts < 10);
    });
  });
});
