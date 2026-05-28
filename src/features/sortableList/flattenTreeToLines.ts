import { TreeItem } from '@/types/types';

export function flattenTreeToLines(items: TreeItem[], depth = 0, maxLines = 10): string[] {
  const lines: string[] = [];
  for (const item of items) {
    if (lines.length >= maxLines) break;
    if (item.id === 'trash') continue;
    const indent = '  '.repeat(depth);
    const doneMarker = item.done ? '✓ ' : '';
    lines.push(`${indent}${doneMarker}${item.value}`);
    if (item.children && item.children.length > 0 && lines.length < maxLines) {
      const childLines = flattenTreeToLines(item.children, depth + 1, maxLines - lines.length);
      lines.push(...childLines);
    }
  }
  return lines.slice(0, maxLines);
}
