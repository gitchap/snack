import { useState, useCallback } from 'react';

export function useActionLock(timeoutMs = 500) {
  const [lockedIds, setLockedIds] = useState(new Set());

  const withLock = useCallback((id, actionFn) => {
    return (...args) => {
      if (lockedIds.has(id)) return;
      
      setLockedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      actionFn(...args);

      setTimeout(() => {
        setLockedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, timeoutMs);
    };
  }, [lockedIds, timeoutMs]);

  const isLocked = useCallback((id) => lockedIds.has(id), [lockedIds]);

  return { withLock, isLocked };
}
