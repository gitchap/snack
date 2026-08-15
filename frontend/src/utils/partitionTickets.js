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

  // Estimated layout constants (in pixels)
  const CARD_CHROME_HEIGHT = 48; // padding (1.5rem x 2) + border
  const MAIN_HEADER_HEIGHT = 56; // queue badge + name + code + status badge
  const CONT_HEADER_HEIGHT = 50; // continuation top header
  const ACTION_BTN_HEIGHT = 54;  // "Food Ready" or "Complete Order" button
  const CONT_FOOTER_HEIGHT = 46; // "⬇ Continued in next column ➔" banner
  const ITEM_GAP = 8;

  const estimateItemHeight = (item) => {
    let baseHeight = 56; // quantity badge, name, fulfill/prep button
    try {
      const snap = typeof item.optionsSnapshot === 'string' ? JSON.parse(item.optionsSnapshot) : item.optionsSnapshot;
      if (snap && typeof snap === 'object') {
        const optionGroups = Object.entries(snap).filter(([_, val]) => Array.isArray(val) && val.length > 0);
        baseHeight += optionGroups.length * 36;
      }
    } catch (_) {}
    return baseHeight + ITEM_GAP;
  };

  const itemHeights = items.map(estimateItemHeight);
  const totalItemsHeight = itemHeights.reduce((a, b) => a + b, 0);
  const totalSingleCardHeight = CARD_CHROME_HEIGHT + MAIN_HEADER_HEIGHT + totalItemsHeight + ACTION_BTN_HEIGHT;

  const effHeight = Math.max(availableHeight || 600, 300);

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
