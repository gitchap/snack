import { useState, useLayoutEffect, useEffect, useRef } from 'react';

/**
 * Custom hook that partitions tickets across columns based on REAL rendered DOM measurements.
 * Includes smooth resize debouncing, global item height caching, and zero-disappearing safeguards.
 * 
 * @param {Array} orders - Active orders array
 * @param {React.RefObject} gridRef - Ref to the .kitchen-grid / .service-grid container
 * @param {Function} [filterItemsFn] - Optional item filter (e.g. requiresCooking !== false)
 * @returns {Array} Array of ticket part objects ready to render
 */
export function useMeasuredTicketPartition(orders, gridRef, filterItemsFn) {
  const [partitions, setPartitions] = useState({});
  const rafRef = useRef(null);
  // Cache measured item heights across renders to avoid missing heights when cards are split
  const itemHeightCache = useRef({});

  const measureAndPartition = () => {
    if (!gridRef.current) return;
    const container = gridRef.current;
    const containerHeight = container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight - 100 : 750);
    
    // Safety clamp: Never let availableHeight drop below 280px so cards never crash/disappear
    const availableHeight = Math.max(containerHeight - 24, 280);

    // 1. Collect all real rendered item heights from the entire container DOM
    const allRenderedItems = container.querySelectorAll('[data-item-id]');
    allRenderedItems.forEach(el => {
      const itemId = el.getAttribute('data-item-id');
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) {
        itemHeightCache.current[itemId] = rect.height + 8; // real height + gap
      }
    });

    const newPartitions = {};

    orders.forEach((order) => {
      const allItems = order.orderItems || [];
      const items = filterItemsFn ? filterItemsFn(allItems) : allItems;
      if (!items || items.length === 0) {
        return;
      }

      // If only 1 item, it always fits in 1 card
      if (items.length <= 1) {
        newPartitions[order.id] = [items];
        return;
      }

      // Calculate total real height of all items in this order
      let totalItemsHeight = 0;
      items.forEach(item => {
        const h = itemHeightCache.current[item.id] || 78;
        totalItemsHeight += h;
      });

      const cardChrome = 48;
      const headerHeight = 68;
      const actionBtnHeight = 56;
      const contFooterHeight = 48;

      const totalSingleCardHeight = cardChrome + headerHeight + totalItemsHeight + actionBtnHeight;

      // If the entire card fits inside the measured container height, keep as 1 whole card
      if (totalSingleCardHeight <= availableHeight) {
        newPartitions[order.id] = [items];
        return;
      }

      // Otherwise, partition dynamically into parts based on real measured item heights
      const chunks = [];
      let currentChunk = [];
      let currentHeight = 0;
      let isFirst = true;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const h = itemHeightCache.current[item.id] || 78;
        const currentHeaderH = isFirst ? headerHeight : 52;
        const maxBudget = Math.max(availableHeight - cardChrome - currentHeaderH - contFooterHeight, 140);

        if (currentChunk.length > 0 && (currentHeight + h > maxBudget)) {
          chunks.push(currentChunk);
          currentChunk = [item];
          currentHeight = h;
          isFirst = false;
        } else {
          currentChunk.push(item);
          currentHeight += h;
        }
      }

      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }

      newPartitions[order.id] = chunks.length > 0 ? chunks : [items];
    });

    setPartitions(prev => {
      const orderIds = Object.keys(newPartitions);
      const isDifferent = orderIds.length !== Object.keys(prev).length || orderIds.some(id => {
        const oldChunks = prev[id];
        const nextChunks = newPartitions[id];
        if (!oldChunks || oldChunks.length !== nextChunks.length) return true;
        return oldChunks.some((c, idx) => c.length !== (nextChunks[idx] ? nextChunks[idx].length : 0));
      });
      return isDifferent ? newPartitions : prev;
    });
  };

  useLayoutEffect(() => {
    measureAndPartition();
  }, [orders]);

  useEffect(() => {
    if (!gridRef.current) return;
    const container = gridRef.current;

    const handleResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        measureAndPartition();
      });
    };

    window.addEventListener('resize', handleResize);
    let observer;
    if (window.ResizeObserver) {
      observer = new ResizeObserver(handleResize);
      observer.observe(container);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, [orders, gridRef.current]);

  // Build flattened parts array with fresh item references from latest order state
  const flatParts = [];
  orders.forEach((order, queueIndex) => {
    const allItems = order.orderItems || [];
    const items = filterItemsFn ? filterItemsFn(allItems) : allItems;
    if (!items || items.length === 0) return;

    const itemMap = new Map(items.map(i => [i.id, i]));
    const rawChunks = partitions[order.id];

    let chunkItemIds = [];
    if (Array.isArray(rawChunks) && rawChunks.length > 0) {
      chunkItemIds = rawChunks.map(chunk => chunk.map(i => (typeof i === 'object' ? i.id : i)));
    } else {
      chunkItemIds = [items.map(i => i.id)];
    }

    const totalParts = chunkItemIds.length;

    chunkItemIds.forEach((ids, partIdx) => {
      // Re-hydrate chunk with the latest live item objects from the active order
      const liveItems = ids.map(id => itemMap.get(id)).filter(Boolean);
      if (liveItems.length === 0) return;

      flatParts.push({
        ...order,
        cardPartKey: `${order.id}-part-${partIdx + 1}`,
        partIndex: partIdx + 1,
        totalParts,
        partitionedItems: liveItems,
        hasContinuationAfter: partIdx < totalParts - 1,
        isContinuation: partIdx > 0,
        queueIndex
      });
    });
  });

  return flatParts;
}
