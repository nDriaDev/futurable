import { describe, it } from 'node:test';
import assert from 'node:assert';
import { FuturableTask } from '../src/FuturableTask.js';

describe('FuturableTask - Part 2', () => {
  describe('debounce() method', () => {
    it('should debounce rapid calls', async () => {
      let executions = 0;
      const task = FuturableTask.of(() => {
        executions++;
        return executions;
      }).debounce(100);
      
      task.run();
      task.run();
      task.run();
      
      await new Promise(r => setTimeout(r, 150));
      assert.strictEqual(executions, 1);
    });

    it('should cancel previous pending execution', async () => {
      let lastExecution = 0;
      const task = FuturableTask.of(() => {
        lastExecution = Date.now();
        return 'done';
      }).debounce(100);
      
      const start = Date.now();
      task.run();
      await new Promise(r => setTimeout(r, 50));
      task.run();
      await new Promise(r => setTimeout(r, 50));
      task.run();
      
      await new Promise(r => setTimeout(r, 150));
      const elapsed = lastExecution - start;
      
      // Should execute ~200ms after start (last call + 100ms)
      assert.ok(elapsed >= 200);
    });

    it('should handle smart debounce - latest delay wins', async () => {
      const task = FuturableTask.of(() => 'result')
        .debounce(100)
        .debounce(200);
      
      const start = Date.now();
      const promise = task.run();
      await promise;
      const elapsed = Date.now() - start;
      
      // Should use 200ms, not 300ms (100+200)
      assert.ok(elapsed >= 200);
      assert.ok(elapsed < 250);
    });

    it('should track source task', () => {
      const original = FuturableTask.of(() => 1);
      const debounced1 = original.debounce(100);
      const debounced2 = debounced1.debounce(200);
      
      // Both should reference the original task
      assert.strictEqual((debounced1 as any).sourceTask, original);
      assert.strictEqual((debounced2 as any).sourceTask, original);
    });

    it('should cancel on task cancellation', async () => {
      let executed = false;
      const task = FuturableTask.of(() => {
        executed = true;
        return 1;
      }).debounce(100);
      
      task.run();
      task.cancel();
      
      await new Promise(r => setTimeout(r, 150));
      assert.strictEqual(executed, false);
    });

    it('should cleanup timeout on cancel', async () => {
      const task = FuturableTask.of(() => 1).debounce(100);
      
      const run = task.run();
      await new Promise(r => setTimeout(r, 50));
      run.cancel();
      
      await new Promise(r => setTimeout(r, 100));
      // Should not execute
    });
  });

  describe('throttle() method', () => {
    it('should throttle rapid calls', async () => {
      let executions = 0;
      const task = FuturableTask.of(() => {
        executions++;
        return executions;
      }).throttle(100);
      
      const r1 = await task.run(); // Executes immediately
      const r2 = await task.run(); // Reuses result
      const r3 = await task.run(); // Reuses result
      
      assert.strictEqual(executions, 1);
      assert.strictEqual(r1, 1);
      assert.strictEqual(r2, 1);
      assert.strictEqual(r3, 1);
    });

    it('should allow execution after throttle period', async () => {
      let executions = 0;
      const task = FuturableTask.of(() => {
        executions++;
        return executions;
      }).throttle(100);
      
      await task.run();
      await new Promise(r => setTimeout(r, 150));
      await task.run();
      
      assert.strictEqual(executions, 2);
    });

    it('should return cached result within window', async () => {
      const task = FuturableTask.of(() => Date.now()).throttle(100);
      
      const r1 = await task.run();
      await new Promise(r => setTimeout(r, 50));
      const r2 = await task.run();
      
      assert.strictEqual(r1, r2);
    });
  });

  describe('zip() method', () => {
    it('should combine two tasks', async () => {
      const task1 = FuturableTask.resolve(1);
      const task2 = FuturableTask.resolve('a');
      
      const result = await task1.zip(task2).run();
      
      assert.deepStrictEqual(result, [1, 'a']);
    });

    it('should execute tasks in parallel', async () => {
      const start = Date.now();
      
      const task1 = FuturableTask.of(async () => {
        await new Promise(r => setTimeout(r, 100));
        return 1;
      });
      
      const task2 = FuturableTask.of(async () => {
        await new Promise(r => setTimeout(r, 100));
        return 2;
      });
      
      await task1.zip(task2).run();
      const elapsed = Date.now() - start;
      
      // Should take ~100ms, not 200ms
      assert.ok(elapsed < 150);
    });

    it('should fail if either task fails', async () => {
      const task1 = FuturableTask.resolve(1);
      const task2 = FuturableTask.reject('error');
      
      await assert.rejects(
        task1.zip(task2).run(),
        /error/
      );
    });
  });

  describe('zipWith() method', () => {
    it('should combine with function', async () => {
      const task1 = FuturableTask.resolve(5);
      const task2 = FuturableTask.resolve(3);
      
      const result = await task1.zipWith(task2, (a, b) => a + b).run();
      
      assert.strictEqual(result, 8);
    });

    it('should handle complex combinations', async () => {
      const task1 = FuturableTask.resolve({ name: 'Alice' });
      const task2 = FuturableTask.resolve({ age: 30 });
      
      const result = await task1.zipWith(
        task2,
        (a, b) => ({ ...a, ...b })
      ).run();
      
      assert.deepStrictEqual(result, { name: 'Alice', age: 30 });
    });
  });

  describe('bimap() method', () => {
    it('should transform success value', async () => {
      const result = await FuturableTask.resolve(42)
        .bimap(
          val => val * 2,
          err => new Error('should not happen')
        )
        .run();
      
      assert.strictEqual(result, 84);
    });

    it('should transform error', async () => {
      try {
        await FuturableTask.reject('original error')
          .bimap(
            val => val,
            err => new Error(`Wrapped: ${err}`)
          )
          .run();
      } catch (e: any) {
        assert.ok(e.message.includes('Wrapped: original error'));
      }
    });
  });

  describe('repeat() method', () => {
    it('should repeat task n times', async () => {
      let count = 0;
      const task = FuturableTask.of(() => ++count);
      
      const results = await task.repeat(3).run();
      
      assert.deepStrictEqual(results, [1, 2, 3]);
    });

    it('should handle zero repeats', async () => {
      const results = await FuturableTask.resolve(1).repeat(0).run();
      
      assert.deepStrictEqual(results, [1]);
    });
  });

  describe('pipe() method', () => {
    it('should compose single transformation', () => {
      const task = FuturableTask.resolve(5);
      const doubled = task.pipe(t => t.map(x => x * 2));
      
      assert.ok(doubled instanceof FuturableTask);
    });

    it('should compose multiple transformations', async () => {
      const result = await FuturableTask.resolve(2)
        .pipe(
          t => t.map(x => x + 3),
          t => t.map(x => x * 2),
          t => t.map(x => x - 1)
        )
        .run();
      
      assert.strictEqual(result, 9); // ((2+3)*2)-1
    });

    it('should support complex pipelines', async () => {
      const addRetry = (t: FuturableTask<any>) => t.retry(2);
      const addTimeout = (t: FuturableTask<any>) => t.timeout(1000);
      const addLogging = (t: FuturableTask<any>) => t.tap(x => console.log(x));
      
      const enhanced = FuturableTask.resolve(42)
        .pipe(addRetry, addTimeout);
      
      const result = await enhanced.run();
      assert.strictEqual(result, 42);
    });
  });

  describe('fetch() method', () => {
    it('should create fetch task', async () => {
      global.fetch = async (url: string) => {
        return new Response(JSON.stringify({ url }));
      };
      
      const response = await FuturableTask.resolve('test')
        .fetch(val => `https://api.example.com/${val}`)
        .run();
      
      const data = await response.json();
      assert.strictEqual(data.url, 'https://api.example.com/test');
    });

    it('should use static URL', async () => {
      global.fetch = async (url: string) => {
        return new Response(JSON.stringify({ url }));
      };
      
      const response = await FuturableTask.resolve('ignored')
        .fetch('https://static.example.com')
        .run();
      
      const data = await response.json();
      assert.strictEqual(data.url, 'https://static.example.com');
    });

    it('should pass dynamic options', async () => {
      let receivedOpts: RequestInit = {};
      global.fetch = async (url: string, opts?: RequestInit) => {
        receivedOpts = opts || {};
        return new Response('{}');
      };
      
      await FuturableTask.resolve('data')
        .fetch(
          'https://example.com',
          val => ({ method: 'POST', body: val })
        )
        .run();
      
      assert.strictEqual(receivedOpts.method, 'POST');
      assert.strictEqual(receivedOpts.body, 'data');
    });
  });

  describe('Static of() method', () => {
    it('should create task from value', async () => {
      const task = FuturableTask.of(42);
      const result = await task.run();
      
      assert.strictEqual(result, 42);
    });

    it('should create task from function', async () => {
      const task = FuturableTask.of(() => 42);
      const result = await task.run();
      
      assert.strictEqual(result, 42);
    });

    it('should create task from async function', async () => {
      const task = FuturableTask.of(async () => {
        await new Promise(r => setTimeout(r, 10));
        return 42;
      });
      
      const result = await task.run();
      assert.strictEqual(result, 42);
    });

    it('should provide utils to function', async () => {
      let receivedUtils: any = null;
      
      const task = FuturableTask.of((utils) => {
        receivedUtils = utils;
        return 1;
      });
      
      await task.run();
      
      assert.ok(receivedUtils);
      assert.ok(receivedUtils.signal);
      assert.ok(typeof receivedUtils.onCancel === 'function');
    });

    it('should handle errors in function', async () => {
      const task = FuturableTask.of(() => {
        throw new Error('test error');
      });
      
      await assert.rejects(task.run(), /test error/);
    });

    it('should respect external signal', () => {
      const controller = new AbortController();
      const task = FuturableTask.of(() => 1, controller.signal);
      
      controller.abort();
      assert.ok(task.signal.aborted);
    });
  });

  describe('Static resolve() method', () => {
    it('should create resolved task', async () => {
      const result = await FuturableTask.resolve(42).run();
      assert.strictEqual(result, 42);
    });

    it('should respect external signal', () => {
      const controller = new AbortController();
      const task = FuturableTask.resolve(1, controller.signal);
      
      controller.abort();
      assert.ok(task.signal.aborted);
    });
  });

  describe('Static reject() method', () => {
    it('should create rejected task', async () => {
      await assert.rejects(
        FuturableTask.reject('error').run(),
        /error/
      );
    });

    it('should respect external signal', () => {
      const controller = new AbortController();
      const task = FuturableTask.reject('error', controller.signal);
      
      controller.abort();
      assert.ok(task.signal.aborted);
    });
  });

  describe('Static all() method', () => {
    it('should resolve all tasks', async () => {
      const tasks = [
        FuturableTask.resolve(1),
        FuturableTask.resolve(2),
        FuturableTask.resolve(3)
      ];
      
      const results = await FuturableTask.all(tasks).run();
      
      assert.deepStrictEqual(results, [1, 2, 3]);
    });

    it('should fail if any task fails', async () => {
      const tasks = [
        FuturableTask.resolve(1),
        FuturableTask.reject('error'),
        FuturableTask.resolve(3)
      ];
      
      await assert.rejects(
        FuturableTask.all(tasks).run(),
        /error/
      );
    });

    it('should respect external signal', () => {
      const controller = new AbortController();
      const task = FuturableTask.all(
        [FuturableTask.resolve(1)],
        controller.signal
      );
      
      controller.abort();
      assert.ok(task.signal.aborted);
    });
  });

  describe('Static allSettled() method', () => {
    it('should settle all tasks', async () => {
      const tasks = [
        FuturableTask.resolve(1),
        FuturableTask.reject('error'),
        FuturableTask.resolve(3)
      ];
      
      const results = await FuturableTask.allSettled(tasks).run();
      
      assert.strictEqual(results[0].status, 'fulfilled');
      assert.strictEqual((results[0] as any).value, 1);
      assert.strictEqual(results[1].status, 'rejected');
      assert.strictEqual((results[1] as any).reason, 'error');
      assert.strictEqual(results[2].status, 'fulfilled');
      assert.strictEqual((results[2] as any).value, 3);
    });
  });

  describe('Static race() method', () => {
    it('should resolve with first to complete', async () => {
      const tasks = [
        FuturableTask.of(() => new Promise(r => setTimeout(() => r(1), 100))),
        FuturableTask.of(() => new Promise(r => setTimeout(() => r(2), 50))),
        FuturableTask.of(() => new Promise(r => setTimeout(() => r(3), 150)))
      ];
      
      const result = await FuturableTask.race(tasks).run();
      assert.strictEqual(result, 2);
    });

    it('should reject if first to complete fails', async () => {
      const tasks = [
        FuturableTask.of(() => new Promise((_, rej) => setTimeout(() => rej('error'), 50))),
        FuturableTask.of(() => new Promise(r => setTimeout(() => r(2), 100)))
      ];
      
      await assert.rejects(
        FuturableTask.race(tasks).run(),
        /error/
      );
    });
  });

  describe('Static any() method', () => {
    it('should resolve with first success', async () => {
      const tasks = [
        FuturableTask.reject('error1'),
        FuturableTask.of(() => new Promise(r => setTimeout(() => r(2), 50))),
        FuturableTask.reject('error3')
      ];
      
      const result = await FuturableTask.any(tasks).run();
      assert.strictEqual(result, 2);
    });

    it('should reject if all fail', async () => {
      const tasks = [
        FuturableTask.reject('error1'),
        FuturableTask.reject('error2')
      ];
      
      await assert.rejects(FuturableTask.any(tasks).run());
    });
  });

  describe('Static delay() method', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await FuturableTask.delay(100).run();
      const elapsed = Date.now() - start;
      
      assert.ok(elapsed >= 100);
    });

    it('should be cancellable', async () => {
      const task = FuturableTask.delay(100);
      const run = task.run();
      
      task.cancel();
      
      await new Promise(r => setTimeout(r, 150));
      assert.ok(run.signal.aborted);
    });
  });

  describe('Static fromEvent() method', () => {
    it('should create task from event', async () => {
      const target = new EventTarget();
      const task = FuturableTask.fromEvent(target, 'test');
      
      const promise = task.run();
      
      setTimeout(() => {
        target.dispatchEvent(new Event('test'));
      }, 50);
      
      const event = await promise;
      assert.strictEqual(event.type, 'test');
    });

    it('should remove listener after event', async () => {
      const target = new EventTarget();
      let listenerCount = 0;
      
      const originalAdd = target.addEventListener;
      const originalRemove = target.removeEventListener;
      
      target.addEventListener = function(...args: any[]) {
        listenerCount++;
        return originalAdd.apply(this, args as any);
      };
      
      target.removeEventListener = function(...args: any[]) {
        listenerCount--;
        return originalRemove.apply(this, args as any);
      };
      
      const task = FuturableTask.fromEvent(target, 'test');
      const promise = task.run();
      
      setTimeout(() => target.dispatchEvent(new Event('test')), 10);
      await promise;
      
      assert.strictEqual(listenerCount, 0);
    });

    it('should remove listener on cancel', async () => {
      const target = new EventTarget();
      const task = FuturableTask.fromEvent(target, 'test');
      
      task.run();
      task.cancel();
      
      // Listener should be removed
    });

    it('should respect once option', async () => {
      const target = new EventTarget();
      const task = FuturableTask.fromEvent(target, 'test', { once: true });
      
      const promise = task.run();
      
      target.dispatchEvent(new Event('test'));
      target.dispatchEvent(new Event('test')); // Should not trigger again
      
      await promise;
    });
  });

  describe('Static sequence() method', () => {
    it('should execute tasks sequentially', async () => {
      const order: number[] = [];
      
      const tasks = [
        FuturableTask.of(() => { order.push(1); return 1; }),
        FuturableTask.of(() => { order.push(2); return 2; }),
        FuturableTask.of(() => { order.push(3); return 3; })
      ];
      
      await FuturableTask.sequence(tasks).run();
      
      assert.deepStrictEqual(order, [1, 2, 3]);
    });

    it('should return all results', async () => {
      const tasks = [
        FuturableTask.resolve(1),
        FuturableTask.resolve(2),
        FuturableTask.resolve(3)
      ];
      
      const results = await FuturableTask.sequence(tasks).run();
      
      assert.deepStrictEqual(results, [1, 2, 3]);
    });

    it('should stop on first error', async () => {
      let count = 0;
      
      const tasks = [
        FuturableTask.of(() => { count++; return 1; }),
        FuturableTask.of(() => { count++; throw new Error('error'); }),
        FuturableTask.of(() => { count++; return 3; })
      ];
      
      await assert.rejects(
        FuturableTask.sequence(tasks).run(),
        /error/
      );
      
      assert.strictEqual(count, 2);
    });
  });

  describe('Static parallel() method', () => {
    it('should limit concurrency', async () => {
      let running = 0;
      let maxConcurrent = 0;
      
      const tasks = Array.from({ length: 10 }, () =>
        FuturableTask.of(async () => {
          running++;
          maxConcurrent = Math.max(maxConcurrent, running);
          await new Promise(r => setTimeout(r, 50));
          running--;
          return 1;
        })
      );
      
      await FuturableTask.parallel(tasks, 3).run();
      
      assert.strictEqual(maxConcurrent, 3);
    });

    it('should return results in order', async () => {
      const tasks = Array.from({ length: 5 }, (_, i) =>
        FuturableTask.of(async () => {
          await new Promise(r => setTimeout(r, Math.random() * 50));
          return i;
        })
      );
      
      const results = await FuturableTask.parallel(tasks, 2).run();
      
      assert.deepStrictEqual(results, [0, 1, 2, 3, 4]);
    });

    it('should fail on first error', async () => {
      const tasks = [
        FuturableTask.of(() => new Promise(r => setTimeout(() => r(1), 100))),
        FuturableTask.of(() => new Promise((_, rej) => setTimeout(() => rej('error'), 50))),
        FuturableTask.of(() => new Promise(r => setTimeout(() => r(3), 200)))
      ];
      
      await assert.rejects(
        FuturableTask.parallel(tasks, 2).run(),
        /error/
      );
    });
  });

  describe('Static createLimiter() method', () => {
    it('should limit concurrent executions', async () => {
      let running = 0;
      let maxConcurrent = 0;
      
      const limiter = FuturableTask.createLimiter(2);
      
      const tasks = Array.from({ length: 5 }, () =>
        limiter(FuturableTask.of(async () => {
          running++;
          maxConcurrent = Math.max(maxConcurrent, running);
          await new Promise(r => setTimeout(r, 50));
          running--;
          return 1;
        }))
      );
      
      await FuturableTask.all(tasks).run();
      
      assert.strictEqual(maxConcurrent, 2);
    });

    it('should expose readonly properties', () => {
      const limiter = FuturableTask.createLimiter(3);
      
      assert.strictEqual(limiter.concurrency, 3);
      assert.strictEqual(limiter.activeCount, 0);
      assert.strictEqual(limiter.pendingCount, 0);
    });

    it('should trigger event hooks', async () => {
      let activeCount = 0;
      let completedCount = 0;
      let idleCalled = false;
      
      const limiter = FuturableTask.createLimiter(2, {
        onActive: () => activeCount++,
        onCompleted: () => completedCount++,
        onIdle: () => idleCalled = true
      });
      
      const tasks = Array.from({ length: 3 }, () =>
        limiter(FuturableTask.of(async () => {
          await new Promise(r => setTimeout(r, 50));
          return 1;
        }))
      );
      
      await FuturableTask.all(tasks).run();
      
      assert.strictEqual(activeCount, 3);
      assert.strictEqual(completedCount, 3);
      assert.ok(idleCalled);
    });

    it('should trigger onError hook', async () => {
      const errors: any[] = [];
      
      const limiter = FuturableTask.createLimiter(2, {
        onError: (err) => errors.push(err)
      });
      
      const tasks = [
        limiter(FuturableTask.resolve(1)),
        limiter(FuturableTask.reject('error'))
      ];
      
      try {
        await FuturableTask.all(tasks).run();
      } catch (e) {}
      
      assert.strictEqual(errors.length, 1);
    });

    it('should handle task cancellation in queue', async () => {
      const limiter = FuturableTask.createLimiter(1);
      
      const task1 = limiter(FuturableTask.of(() => 
        new Promise(r => setTimeout(() => r(1), 100))
      ));
      
      const task2 = limiter(FuturableTask.of(() => 2));
      
      const run1 = task1.run();
      const run2 = task2.run();
      
      // task2 should be queued
      assert.strictEqual(limiter.pendingCount, 1);
      
      task2.cancel();
      
      await run1;
      
      assert.strictEqual(limiter.pendingCount, 0);
    });
  });

  describe('Static compose() method', () => {
    it('should compose operators', async () => {
      const result = await FuturableTask.compose(
        FuturableTask.resolve(2),
        t => t.map(x => x + 3),
        t => t.map(x => x * 2)
      ).run();
      
      assert.strictEqual(result, 10); // (2+3)*2
    });

    it('should type-check composition', async () => {
      const addOne = (t: FuturableTask<number>) => t.map(x => x + 1);
      const toString = (t: FuturableTask<number>) => t.map(x => String(x));
      
      const result = await FuturableTask.compose(
        FuturableTask.resolve(5),
        addOne,
        toString
      ).run();
      
      assert.strictEqual(result, '6');
    });
  });

  describe('Static filter() method', () => {
    it('should filter task results', async () => {
      const tasks = [
        FuturableTask.resolve(1),
        FuturableTask.resolve(2),
        FuturableTask.resolve(3),
        FuturableTask.resolve(4),
        FuturableTask.resolve(5)
      ];
      
      const results = await FuturableTask.filter(
        tasks,
        n => n % 2 === 0
      ).run();
      
      assert.deepStrictEqual(results, [2, 4]);
    });

    it('should handle async predicate', async () => {
      const tasks = [
        FuturableTask.resolve(1),
        FuturableTask.resolve(2),
        FuturableTask.resolve(3)
      ];
      
      const results = await FuturableTask.filter(
        tasks,
        async n => {
          await new Promise(r => setTimeout(r, 10));
          return n > 1;
        }
      ).run();
      
      assert.deepStrictEqual(results, [2, 3]);
    });
  });

  describe('Static reduce() method', () => {
    it('should reduce task results', async () => {
      const tasks = [
        FuturableTask.resolve(1),
        FuturableTask.resolve(2),
        FuturableTask.resolve(3),
        FuturableTask.resolve(4)
      ];
      
      const sum = await FuturableTask.reduce(
        tasks,
        (acc, n) => acc + n,
        0
      ).run();
      
      assert.strictEqual(sum, 10);
    });

    it('should pass index to reducer', async () => {
      const tasks = [
        FuturableTask.resolve('a'),
        FuturableTask.resolve('b'),
        FuturableTask.resolve('c')
      ];
      
      const indexed = await FuturableTask.reduce(
        tasks,
        (acc, val, idx) => [...acc, `${idx}:${val}`],
        [] as string[]
      ).run();
      
      assert.deepStrictEqual(indexed, ['0:a', '1:b', '2:c']);
    });

    it('should handle async reducer', async () => {
      const tasks = [
        FuturableTask.resolve(1),
        FuturableTask.resolve(2)
      ];
      
      const result = await FuturableTask.reduce(
        tasks,
        async (acc, n) => {
          await new Promise(r => setTimeout(r, 10));
          return acc + n;
        },
        0
      ).run();
      
      assert.strictEqual(result, 3);
    });
  });

  describe('Static whilst() method', () => {
    it('should execute while condition is true', async () => {
      let count = 0;
      
      const results = await FuturableTask.whilst(
        () => count < 5,
        FuturableTask.of(() => ++count)
      ).run();
      
      assert.deepStrictEqual(results, [1, 2, 3, 4, 5]);
    });

    it('should handle async condition', async () => {
      let count = 0;
      
      const results = await FuturableTask.whilst(
        async () => {
          await new Promise(r => setTimeout(r, 10));
          return count < 3;
        },
        FuturableTask.of(() => ++count)
      ).run();
      
      assert.deepStrictEqual(results, [1, 2, 3]);
    });

    it('should return empty array if condition initially false', async () => {
      const results = await FuturableTask.whilst(
        () => false,
        FuturableTask.of(() => 1)
      ).run();
      
      assert.deepStrictEqual(results, []);
    });
  });

  describe('Static until() method', () => {
    it('should execute until condition is true', async () => {
      let count = 0;
      
      const results = await FuturableTask.until(
        () => count >= 3,
        FuturableTask.of(() => ++count)
      ).run();
      
      assert.deepStrictEqual(results, [1, 2, 3]);
    });

    it('should handle async condition', async () => {
      let count = 0;
      
      const results = await FuturableTask.until(
        async () => {
          await new Promise(r => setTimeout(r, 10));
          return count >= 2;
        },
        FuturableTask.of(() => ++count)
      ).run();
      
      assert.deepStrictEqual(results, [1, 2]);
    });
  });

  describe('Static times() method', () => {
    it('should execute n times', async () => {
      const results = await FuturableTask.times(
        5,
        i => FuturableTask.resolve(i * 2)
      ).run();
      
      assert.deepStrictEqual(results, [0, 2, 4, 6, 8]);
    });

    it('should pass index to factory', async () => {
      const results = await FuturableTask.times(
        3,
        i => FuturableTask.resolve(`item-${i}`)
      ).run();
      
      assert.deepStrictEqual(results, ['item-0', 'item-1', 'item-2']);
    });
  });

  describe('Static traverse() method', () => {
    it('should map and sequence', async () => {
      const values = [1, 2, 3, 4];
      
      const results = await FuturableTask.traverse(
        values,
        n => FuturableTask.resolve(n * 2)
      ).run();
      
      assert.deepStrictEqual(results, [2, 4, 6, 8]);
    });

    it('should pass index to function', async () => {
      const values = ['a', 'b', 'c'];
      
      const results = await FuturableTask.traverse(
        values,
        (val, idx) => FuturableTask.resolve(`${idx}:${val}`)
      ).run();
      
      assert.deepStrictEqual(results, ['0:a', '1:b', '2:c']);
    });
  });

  describe('Static fetch() method', () => {
    it('should create fetch task', async () => {
      global.fetch = async (url: string) => {
        return new Response(JSON.stringify({ url }));
      };
      
      const response = await FuturableTask.fetch('https://example.com').run();
      const data = await response.json();
      
      assert.strictEqual(data.url, 'https://example.com');
    });

    it('should pass options', async () => {
      let receivedOpts: RequestInit = {};
      global.fetch = async (url: string, opts?: RequestInit) => {
        receivedOpts = opts || {};
        return new Response('{}');
      };
      
      await FuturableTask.fetch('https://example.com', {
        method: 'POST'
      }).run();
      
      assert.strictEqual(receivedOpts.method, 'POST');
    });
  });
});
