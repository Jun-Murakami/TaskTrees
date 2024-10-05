import { AppState, TreeItem } from '@/types/types';

export function isValidAppState(appState: AppState): boolean {
  const hasTrash = appState.items.some((item: TreeItem) => item.id === 'trash');
  const hasHideDoneItems = typeof appState.hideDoneItems === 'boolean';
  const hasDarkMode = typeof appState.darkMode === 'boolean';
  return hasTrash && hasHideDoneItems && hasDarkMode;
}

export function isValidAppSettingsState(appState: AppState): boolean {
  const hasHideDoneItems = typeof appState.hideDoneItems === 'boolean';
  const hasDarkMode = typeof appState.darkMode === 'boolean';
  return hasHideDoneItems && hasDarkMode;
}
