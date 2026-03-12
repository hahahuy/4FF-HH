App.EventBus = (() => {
  const _listeners = new Map();

  /**
   * Register a listener for an event.
   * @param {string}   event
   * @param {Function} fn  — return `true` to consume the event
   */
  function on(event, fn) {
    if (!_listeners.has(event)) _listeners.set(event, []);
    _listeners.get(event).push(fn);
  }

  /**
   * Remove a previously registered listener.
   * @param {string}   event
   * @param {Function} fn
   */
  function off(event, fn) {
    const list = _listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx !== -1) list.splice(idx, 1);
  }

  /**
   * Emit an event to all registered listeners.
   * @param {string} event
   * @param {*}      payload
   * @returns {boolean}  true if any listener consumed the event
   */
  function emit(event, payload) {
    for (const fn of _listeners.get(event) ?? []) {
      if (fn(payload) === true) return true;
    }
    return false;
  }

  return { on, off, emit };
})();
