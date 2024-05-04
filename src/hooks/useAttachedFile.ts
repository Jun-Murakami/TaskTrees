import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { TreeItem } from '../types/types';
import { useDialogStore } from '../store/dialogStore';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';
import { UniqueIdentifier } from '@dnd-kit/core';
import { useDatabase } from './useDatabase';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const useAttachedFile = () => {
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const showDialog = useDialogStore((state) => state.showDialog);
  const items = useTreeStateStore((state) => state.items);
  const setItems = useTreeStateStore((state) => state.setItems);
  const currentTree = useTreeStateStore((state) => state.currentTree);

  const { saveItemsDb } = useDatabase();

  // ファイルをFirebaseStorageにアップロードする処理 ------------------------------------------------
  const uploadFile = async (file: File, targetTree: UniqueIdentifier): Promise<string | undefined> => {
    setIsLoading(true);
    // ファイルサイズを取得
    const fileSize = file.size / 1024 / 1024;
    if (fileSize > 25) {
      setIsLoading(false);
      await showDialog('添付できるファイルサイズは25MBまでです', 'Information');
      return;
    }
    const storage = getStorage();
    let fileName = file.name;
    const fileExtension = fileName.slice(fileName.lastIndexOf('.'));
    const baseFileName = fileName.slice(0, fileName.lastIndexOf('.'));
    let fileExists = true;
    let counter = 0;

    while (fileExists) {
      try {
        const fileRef = ref(storage, `trees/${targetTree}/${fileName}`);
        await getDownloadURL(fileRef);
        // ファイルが存在する場合、ファイル名を変更
        counter++;
        fileName = `${baseFileName}(${counter})${fileExtension}`;
      } catch (error) {
        // ファイルが存在しない場合、ループを抜ける
        fileExists = false;
      }
    }

    // 新しいファイル名でアップロード
    try {
      const newFileRef = ref(storage, `trees/${targetTree}/${fileName}`);
      await uploadBytes(newFileRef, file);
      setIsLoading(false);
      return fileName;
    } catch (error) {
      setIsLoading(false);
      await showDialog('ファイルのアップロードに失敗しました\n\n' + error, 'Error');
      return undefined;
    }
  };

  // ファイルをダウンロードする関数 ------------------------------------------------
  const downloadFile = async (fileName: string, targetTree: UniqueIdentifier): Promise<void> => {
    try {
      setIsLoading(true);
      const storage = getStorage();
      const fileRef = ref(storage, `trees/${targetTree}/${fileName}`);
      const url = await getDownloadURL(fileRef);
      if (Capacitor.isNativePlatform()) {
        const result = await Filesystem.downloadFile({
          url: url,
          path: fileName,
          directory: Directory.Documents,
        });
        if (result.path) {
          await Share.share({
            title: 'TaskTrees File title',
            text: 'TaskTrees File text',
            url: result.path,
            dialogTitle: 'TaskTrees File dialog title',
          });
          await Filesystem.deleteFile({
            path: result.path,
            directory: Directory.Documents,
          });
        }
      } else {
        // Blobを使用してファイルをダウンロード
        const response = await fetch(url);
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link); // DOMに追加
        link.click();
        window.URL.revokeObjectURL(downloadUrl); // 使用後はURLを解放
        link.remove(); // DOMから削除
      }
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      if (error instanceof Error && !error.message.includes('Share')) {
        const result = await showDialog(
          'ファイルのダウンロードに失敗しました。ファイルが削除されている可能性があります。データベースからこのファイルの添付を削除しますか？\n\n' +
          error,
          'Error',
          true
        );
        if (result) {
          const newItems: TreeItem[] = JSON.parse(JSON.stringify(items));
          const updatedItems = await deleteAttachedFile(newItems, fileName);
          setItems(updatedItems);
          await saveItemsDb(updatedItems, currentTree!);
        }
      }
    }
  };

  // ファイルを削除する関数 ------------------------------------------------
  const deleteAttachedFile = async (items: TreeItem[], fileName: string): Promise<TreeItem[]> => {
    items.forEach(async (item) => {
      if (item.attachedFile === fileName) {
        delete item.attachedFile;
      }
      if (item.children.length > 0) {
        deleteAttachedFile(item.children, fileName);
      }
    });
    return items;
  };
  // 本編 ------------------------------------------------
  const deleteFile = async (fileName: string, targetTree: UniqueIdentifier, isSilent: boolean = false) => {
    if (!isSilent) {
      const result = await showDialog(`添付ファイル「${fileName}」を削除しますか？`, 'Delete File', true);
      if (!result) return;
    }
    try {
      setIsLoading(true);
      const storage = getStorage();
      const fileRef = ref(storage, `trees/${targetTree}/${fileName}`);
      await deleteObject(fileRef);
      // ファイル削除後、itemsを更新。children[]の中のattachedFileも再帰的に削除する
      const newItems: TreeItem[] = JSON.parse(JSON.stringify(items));
      const updatedItems = await deleteAttachedFile(newItems, fileName);
      if (!isSilent) {
        setItems(updatedItems);
        await saveItemsDb(updatedItems, currentTree!);
      }
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      const result = await showDialog(
        '添付ファイルの削除に失敗しました。既にファイルが削除されている可能性があります。データベースからファイルの参照を削除しますか？\n\n' +
        error,
        'Error',
        true
      );
      if (result) {
        const newItems: TreeItem[] = JSON.parse(JSON.stringify(items));
        const updatedItems = await deleteAttachedFile(newItems, fileName);
        setItems(updatedItems);
        await saveItemsDb(updatedItems, currentTree!);
      }
    }
  };

  return { uploadFile, downloadFile, deleteFile };
};
