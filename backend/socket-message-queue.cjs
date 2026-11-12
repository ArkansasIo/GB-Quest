'use strict';

/**
 * Serialize asynchronous WebSocket message handlers per connection.
 * ws emits message events synchronously, but handlers that await database
 * operations can otherwise overlap and reorder state transitions.
 */
function createSocketMessageQueue(handler, { onError = () => {} } = {}) {
  if (typeof handler !== 'function') throw new TypeError('handler must be a function');
  let tail = Promise.resolve();
  let pending = 0;
  return {
    enqueue(message) {
      pending += 1;
      const current = tail.then(() => handler(message));
      tail = current.catch(error => {
        try { onError(error); } catch {}
      }).finally(() => { pending -= 1; });
      return pending;
    },
    get pending() { return pending; }
  };
}

module.exports = { createSocketMessageQueue };
