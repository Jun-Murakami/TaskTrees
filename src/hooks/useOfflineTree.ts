import { useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';
import { useAppStateStore } from '@/store/appStateStore';
import { useDialogStore } from '@/store/dialogStore';
import { useTreeManagement } from '@/hooks/useTreeManagement';

export const useOfflineTree = () => {
  const setQuickMemoText = useAppStateStore((state) => state.setQuickMemoText);
  const showDialog = useDialogStore((state) => state.showDialog);

  const { handleLoadedContent } = useTreeManagement();

  const loadAndSyncOfflineTree = useCallback(async () => {
    // ローカルストレージからitems_offlineとtreeName_offline、quick_memo_offlineを読み込む
    const { value: itemsOffline } = await Preferences.get({ key: `items_offline` });
    const { value: treeNameOffline } = await Preferences.get({ key: `treeName_offline` });
    const { value: quickMemoOffline } = await Preferences.get({ key: `quick_memo_offline` });
    if (itemsOffline) {
      const items = JSON.parse(itemsOffline);
      const name = treeNameOffline ? treeNameOffline : 'オフラインツリー';
      const quickMemo = quickMemoOffline ? quickMemoOffline : '';
      const quickMemoText = useAppStateStore.getState().quickMemoText;
      const conbinedQuickMemoText = quickMemoText + '\n\n' + quickMemo;
      const result = await showDialog(
        'オフラインツリーが見つかりました。このツリーを読み込みますか？',
        'オフラインツリーの読み込み',
        true
      );
      if (result) {
        await handleLoadedContent(JSON.stringify({ name, items }));
        setQuickMemoText(conbinedQuickMemoText);
        await Preferences.remove({ key: `items_offline` });
        await Preferences.remove({ key: `treeName_offline` });
        await Preferences.remove({ key: `quick_memo_offline` });
      } else {
        const removeResult = await showDialog(
          'オフラインツリーを削除しますか？削除せず、次回ログイン時に読み込むこともできます。',
          'オフラインツリーの削除',
          true
        );
        if (removeResult) {
          await Preferences.remove({ key: `items_offline` });
          await Preferences.remove({ key: `treeName_offline` });
          await Preferences.remove({ key: `quick_memo_offline` });
        }
      }
    }
  }, [setQuickMemoText, showDialog, handleLoadedContent]);

  return {
    loadAndSyncOfflineTree
  }
}