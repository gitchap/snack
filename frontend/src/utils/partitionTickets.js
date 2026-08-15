/**
 * Partitions order items into multi-part tickets strictly based on the available vertical container height.
 * 
 * @param {Object} order - The full order object
 * @param {number} availableHeight - The measured pixel height of the grid container
 * @param {Function} [filterItemsFn] - Optional filter for cooking items
 * @returns {Array} Array of partitioned ticket part objects
 */
export function partitionOrderItems(order, availableHeight, filterItemsFn) {
  const allItems = order.orderItems || [];
  const items = filterItemsFn ? filterItemsFn(allItems) : allItems;
  if (!items || items.length === 0) return [];

  // Robust cross-platform layout constants (in pixels) for Firefox Linux, Edge, Chrome, Safari:
  // - .ticket card padding (1.5rem x 2) + border: 60px
  // - .ticket-header (title, queue badge, subtext, status): 78px
  // - .ticket-continuation-header: 58px
  // - .ticket-item base (44px touch-min button + 28px padding + 2px border + 8px margin + line-height buffer): 88px
  // - .options-list (title, chips, spacing): ~52px per option group
  // - .ticket-continuation-footer ("⬇ Continues in next column ➔"): 54px
  // - Action button ("Food Ready" / "Complete Order") + margin: 64px
  // - Column bottom safety buffer: 55px
  const CARD_CHROME_HEIGHT = 60;
  const MAIN_HEADER_HEIGHT = 78;
  const CONT_HEADER_HEIGHT = 58;
  const ACTION_BTN_HEIGHT = 64;
  const CONT_FOOTER_HEIGHT = 54;
  const COLUMN_SAFETY_BUFFER = 55;

  const estimateItemHeight = (item) => {
    let itemHeight = 88; // base single item with title, bullet, and button
    try {
      const snap = typeof item.optionsSnapshot === 'string' ? JSON.parse(item.optionsSnapshot) : item.optionsSnapshot;
      if (snap && typeof snap === 'object') {
        const optionGroups = Object.entries(snap).filter(([_, val]) => Array.isArray(val) && val.length > 0);
        itemHeight += optionGroups.length * 52;
      }
    } catch (_) {}
    return itemHeight;
  };

  const itemHeights = items.map(estimateItemHeight);
  const totalItemsHeight = itemHeights.reduce((a, b) => a + b, 0);
  const totalSingleCardHeight = CARD_CHROME_HEIGHT + MAIN_HEADER_HEIGHT + totalItemsHeight + ACTION_BTN_HEIGHT;

  const rawHeight = availableHeight || (typeof window !== 'undefined' ? window.innerHeight - 100 : 750);
  const effHeight = Math.max(rawHeight - COLUMN_SAFETY_BUFFER, 300);

  // If the whole card fits in the available column height, DO NOT split
  if (totalSingleCardHeight <= effHeight || items.length <= 1) {
    return [{
      ...order,
      cardPartKey: `${order.id}-part-1`,
      partIndex: 1,
      totalParts: 1,
      partitionedItems: items,
      hasContinuationAfter: false,
      isContinuation: false
    }];
  }

  // If total height exceeds column height, dynamically partition across parts
  const parts = [];
  let currentPartItems = [];
  let currentPartHeight = 0;
  let isFirstPart = true;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const h = itemHeights[i];
    const headerH = isFirstPart ? MAIN_HEADER_HEIGHT : CONT_HEADER_HEIGHT;
    // Check budget with continuation banner
    const maxBudget = effHeight - CARD_CHROME_HEIGHT - headerH - CONT_FOOTER_HEIGHT;

    if (currentPartItems.length > 0 && (currentPartHeight + h > maxBudget)) {
      parts.push({
        partIndex: parts.length + 1,
        partitionedItems: currentPartItems,
        isFirstPart
      });
      currentPartItems = [item];
      currentPartHeight = h;
      isFirstPart = false;
    } else {
      currentPartItems.push(item);
      currentPartHeight += h;
    }
  }

  if (currentPartItems.length > 0) {
    parts.push({
      partIndex: parts.length + 1,
      partitionedItems: currentPartItems,
      isFirstPart
    });
  }

  const totalParts = parts.length;

  return parts.map((p, idx) => ({
    ...order,
    cardPartKey: `${order.id}-part-${p.partIndex}`,
    partIndex: p.partIndex,
    totalParts,
    partitionedItems: p.partitionedItems,
    hasContinuationAfter: idx < totalParts - 1,
    isContinuation: idx > 0
  }));
}
