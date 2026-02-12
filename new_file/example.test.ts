/**
 * ESEMPIO DI TEST
 * 
 * Questo file mostra la struttura base di un test con Node.js test runner nativo.
 * I test veri sono in tests/Futurable.test.ts e tests/FuturableTask.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

// NOTA IMPORTANTE: Anche se i file sorgente sono .ts, 
// gli import devono usare l'estensione .js per la risoluzione ES modules
import { Futurable } from '../src/Futurable.js';
import { FuturableTask } from '../src/FuturableTask.js';

describe('Esempio Test Structure', () => {
  describe('Setup e Teardown', () => {
    let resource: any;

    before(async () => {
      // Setup eseguito prima di tutti i test in questo describe
      resource = { initialized: true };
    });

    after(async () => {
      // Cleanup eseguito dopo tutti i test
      resource = null;
    });

    it('should demonstrate basic assertion', () => {
      assert.strictEqual(1 + 1, 2);
    });

    it('should demonstrate async test', async () => {
      const result = await Promise.resolve(42);
      assert.strictEqual(result, 42);
    });
  });

  describe('Testing Futurable', () => {
    it('should create and resolve a Futurable', async () => {
      const futurable = new Futurable<number>((resolve) => {
        resolve(42);
      });

      const result = await futurable;
      assert.strictEqual(result, 42);
    });

    it('should handle rejection', async () => {
      const futurable = new Futurable<number>((_, reject) => {
        reject(new Error('test error'));
      });

      await assert.rejects(futurable, /test error/);
    });

    it('should support cancellation', () => {
      const futurable = new Futurable<number>((resolve) => {
        setTimeout(() => resolve(1), 1000);
      });

      futurable.cancel();
      assert.ok(futurable.signal.aborted);
    });
  });

  describe('Testing FuturableTask', () => {
    it('should be lazy - not execute until run()', () => {
      let executed = false;
      
      const task = new FuturableTask<number>((resolve) => {
        executed = true;
        resolve(42);
      });

      // Il task non viene eseguito alla creazione
      assert.strictEqual(executed, false);
    });

    it('should execute when run() is called', async () => {
      let executed = false;
      
      const task = new FuturableTask<number>((resolve) => {
        executed = true;
        resolve(42);
      });

      const result = await task.run();
      
      assert.ok(executed);
      assert.strictEqual(result, 42);
    });

    it('should support transformations', async () => {
      const result = await FuturableTask.resolve(5)
        .map(x => x * 2)
        .map(x => x + 3)
        .run();

      assert.strictEqual(result, 13); // (5 * 2) + 3
    });
  });

  describe('Assertion Patterns', () => {
    it('should use strictEqual for primitive values', () => {
      assert.strictEqual(42, 42);
      assert.strictEqual('hello', 'hello');
      assert.strictEqual(true, true);
    });

    it('should use deepStrictEqual for objects/arrays', () => {
      assert.deepStrictEqual([1, 2, 3], [1, 2, 3]);
      assert.deepStrictEqual({ a: 1 }, { a: 1 });
    });

    it('should use assert.ok for truthy values', () => {
      assert.ok(true);
      assert.ok(1);
      assert.ok('non-empty');
      assert.ok([1, 2, 3].length > 0);
    });

    it('should use assert.rejects for async rejections', async () => {
      const promise = Promise.reject(new Error('failed'));
      await assert.rejects(promise, /failed/);
    });

    it('should use assert.throws for sync throws', () => {
      assert.throws(
        () => { throw new Error('sync error'); },
        /sync error/
      );
    });
  });

  describe('Testing Patterns', () => {
    it('should test happy path', async () => {
      const task = FuturableTask.resolve(42);
      const result = await task.run();
      assert.strictEqual(result, 42);
    });

    it('should test error path', async () => {
      const task = FuturableTask.reject('error');
      await assert.rejects(task.run(), /error/);
    });

    it('should test edge cases', async () => {
      // Valori nulli
      const nullTask = FuturableTask.resolve(null);
      assert.strictEqual(await nullTask.run(), null);

      // Array vuoti
      const emptyTask = FuturableTask.resolve([]);
      assert.deepStrictEqual(await emptyTask.run(), []);

      // Stringhe vuote
      const emptyStrTask = FuturableTask.resolve('');
      assert.strictEqual(await emptyStrTask.run(), '');
    });

    it('should test with timeouts', async () => {
      const start = Date.now();
      
      await FuturableTask.of(() => 
        new Promise(r => setTimeout(() => r(1), 100))
      ).run();
      
      const elapsed = Date.now() - start;
      assert.ok(elapsed >= 100);
    });

    it('should test cancellation behavior', async () => {
      let executed = false;
      
      const task = FuturableTask.of(() => {
        return new Promise(r => {
          setTimeout(() => {
            executed = true;
            r(1);
          }, 100);
        });
      });

      const run = task.run();
      task.cancel();

      await new Promise(r => setTimeout(r, 150));
      
      assert.ok(task.signal.aborted);
      assert.strictEqual(executed, false);
    });
  });
});
