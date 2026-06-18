export function stockBatchQuantityUpdate(currentQuantity: number) {
  return {
    currentQuantity,
    ...(currentQuantity === 0 && { isClosed: true }),
  };
}
