import { useState, useCallback } from 'react';

export function useActionLock(timeoutMs = 400) {
  const [lockedIds, setLockedIds] = useState(new Set());

  const withLock = useCallback((id, actionFn) => {
    return (...args) => {
      const lockKey = args.length > 0 && (typeof args[0] === 'string' || typeof args[0] === 'number')
        ? `${id}-${args[0]}`
        : id;

      if (lockedIds.has(lockKey)) return;
      
      setLockedIds(prev => {
        const next = new Set(prev);
        next.add(lockKey);
        return next;
      });

      actionFn(...args);

      setTimeout(() => {
        setLockedIds(prev => {
          const next = new Set(prev);
          next.delete(lockKey);
          return next;
        });
      }, timeoutMs);
    };
  }, [lockedIds, timeoutMs]);

  const isLocked = useCallback((id, argId) => {
    const lockKey = argId ? `${id}-${argId}` : id;
    return lockedIds.has(lockKey);
  }, [lockedIds]);

  return { withLock, isLocked };
}
