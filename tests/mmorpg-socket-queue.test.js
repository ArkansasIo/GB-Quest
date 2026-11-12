import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSocketMessageQueue } = require('../backend/socket-message-queue.cjs');

test('WebSocket messages execute sequentially even when handlers await', async () => {
  const order = [];
  const queue = createSocketMessageQueue(async value => {
    order.push('start:' + value);
    await new Promise(resolve => setTimeout(resolve, value === 1 ? 20 : 1));
    order.push('end:' + value);
  });
  queue.enqueue(1);
  queue.enqueue(2);
  queue.enqueue(3);
  assert.equal(queue.pending, 3);
  while (queue.pending) await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(order, ['start:1', 'end:1', 'start:2', 'end:2', 'start:3', 'end:3']);
  assert.equal(queue.pending, 0);
});

test('a failed message does not poison the remaining queue', async () => {
  const handled = [], errors = [];
  const queue = createSocketMessageQueue(async value => {
    handled.push(value);
    if (value === 'bad') throw new Error('expected failure');
  }, { onError: error => errors.push(error.message) });
  queue.enqueue('bad');
  queue.enqueue('good');
  while (queue.pending) await new Promise(resolve => setTimeout(resolve, 1));
  assert.deepEqual(handled, ['bad', 'good']);
  assert.deepEqual(errors, ['expected failure']);
});
