export interface VirtualWindowInput {
  totalCount: number;
  scrollTop: number;
  viewportHeight: number;
  itemHeight: number;
  overscan?: number;
}

export interface VirtualWindowResult {
  startIndex: number;
  endIndex: number;
  topSpacerPx: number;
  bottomSpacerPx: number;
  totalHeightPx: number;
}

/**
 * Pure virtual list window calculation so tables with 10,000+ rows render only visible DOM nodes.
 */
export function computeVirtualWindow({
  totalCount,
  scrollTop,
  viewportHeight,
  itemHeight,
  overscan = 6,
}: VirtualWindowInput): VirtualWindowResult {
  if (totalCount <= 0 || itemHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: 0,
      topSpacerPx: 0,
      bottomSpacerPx: 0,
      totalHeightPx: 0,
    };
  }

  const safeViewport = Math.max(itemHeight, viewportHeight);
  const safeScrollTop = Math.max(0, scrollTop);
  const visibleCount = Math.ceil(safeViewport / itemHeight);

  const rawStart = Math.floor(safeScrollTop / itemHeight);
  const startIndex = Math.max(0, rawStart - overscan);
  const endIndex = Math.min(totalCount, rawStart + visibleCount + overscan);

  const topSpacerPx = startIndex * itemHeight;
  const bottomSpacerPx = Math.max(0, (totalCount - endIndex) * itemHeight);
  const totalHeightPx = totalCount * itemHeight;

  return {
    startIndex,
    endIndex,
    topSpacerPx,
    bottomSpacerPx,
    totalHeightPx,
  };
}
