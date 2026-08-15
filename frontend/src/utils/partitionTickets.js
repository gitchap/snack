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

  // Generous safety layout constants (in pixels) ensuring buttons never get clipped:
  // - .ticket card padding + border + margin: 56px
  // - .ticket-header: 76px
  // - .ticket-continuation-header: 56px
  // - .ticket-item base: 84px
  // - .options-list: ~52px per option group
  // - .ticket-continuation-footer: 52px
  // - Action button ("Food Ready" / "Complete Order") + margins: 68px
  // - Column bottom safety buffer: 65px
  const CARD_CHROME_HEIGHT = 56;
  const MAIN_HEADER_HEIGHT = 76;
  const CONT_HEADER_HEIGHT = 56;
  const ACTION_BTN_HEIGHT = 68;
  const CONT_FOOTER_HEIGHT = 52;
  const COLUMN_SAFETY_BUFFER = 65;

  const estimateItemHeight = (item) => {
    let itemHeight = 84; // base single item with title, bullet, and button
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
