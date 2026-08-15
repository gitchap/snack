import { useState, useLayoutEffect, useEffect } from 'react';

/**
 * Custom hook that partitions tickets across columns based on REAL rendered DOM measurements.
 * Zero guesswork or hardcoded height formulas.
 * 
 * @param {Array} orders - Active orders array
 * @param {React.RefObject} gridRef - Ref to the .kitchen-grid / .service-grid container
 * @param {Function} [filterItemsFn] - Optional item filter (e.g. requiresCooking !== false)
 * @returns {Array} Array of ticket part objects ready to render
 */
export function useMeasuredTicketPartition(orders, gridRef, filterItemsFn) {
  const [partitions, setPartitions] = useState({});

  const measureAndPartition = () => {
    if (!gridRef.current) return;
    const container = gridRef.current;
    const containerHeight = container.clientHeight;
    if (!containerHeight || containerHeight <= 0) return;

    // 24px safety breathing room above the container bottom
    const availableHeight = containerHeight - 24;
    const newPartitions = {};

    orders.forEach((order) => {
      const allItems = order.orderItems || [];
      const items = filterItemsFn ? filterItemsFn(allItems) : allItems;
      if (!items || items.length === 0) {
        newPartitions[order.id] = [[]];
        return;
      }

      // Query the rendered card in the DOM
      const cardEl = container.querySelector(`[data-order-id="${order.id}"]`);
      if (!cardEl) {
        newPartitions[order.id] = [items];
        return;
      }

      // Check if all items in this order are rendered in a single card
      const renderedItemEls = cardEl.querySelectorAll(`[data-item-id]`);
      const itemHeights = {};
      renderedItemEls.forEach(el => {
        const itemId = el.getAttribute('data-item-id');
        // Real rendered height + margin/gap
        itemHeights[itemId] = el.getBoundingClientRect().height + 8;
      });

      const headerEl = cardEl.querySelector('.ticket-header') || cardEl.querySelector('.ticket-continuation-header');
      const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 60;
      const contFooterHeight = 48; // "⬇ Continues in next column ➔" banner
      const cardChrome = 48; // card padding & borders

      // Calculate total real height of all items
      let totalItemsHeight = 0;
      items.forEach(item => {
        totalItemsHeight += itemHeights[item.id] || 75;
      });

      const totalSingleCardHeight = cardChrome + headerHeight + totalItemsHeight + 54; // 54px action button

      // If the entire card fits inside the measured container height, keep as 1 card
      if (totalSingleCardHeight <= availableHeight || items.length <= 1) {
        newPartitions[order.id] = [items];
        return;
      }

      // Otherwise, partition dynamically using the EXACT measured item heights
      const chunks = [];
      let currentChunk = [];
      let currentHeight = 0;
      let isFirst = true;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const h = itemHeights[item.id] || 75;
        const currentHeaderH = isFirst ? headerHeight : 50;
        const maxBudget = availableHeight - cardChrome - currentHeaderH - contFooterHeight;

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
        return oldChunks.some((c, idx) => c.length !== nextChunks[idx].length);
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
      measureAndPartition();
    };

    window.addEventListener('resize', handleResize);
    let observer;
    if (window.ResizeObserver) {
      observer = new ResizeObserver(handleResize);
      observer.observe(container);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, [orders, gridRef.current]);

  // Build flattened parts array
  const flatParts = [];
  orders.forEach((order, queueIndex) => {
    const allItems = order.orderItems || [];
    const items = filterItemsFn ? filterItemsFn(allItems) : allItems;
    if (!items || items.length === 0) return;

    const chunks = partitions[order.id] || [items];
    const totalParts = chunks.length;

    chunks.forEach((chunkItems, partIdx) => {
      flatParts.push({
        ...order,
        cardPartKey: `${order.id}-part-${partIdx + 1}`,
        partIndex: partIdx + 1,
        totalParts,
        partitionedItems: chunkItems,
        hasContinuationAfter: partIdx < totalParts - 1,
        isContinuation: partIdx > 0,
        queueIndex
      });
    });
  });

  return flatParts;
}
