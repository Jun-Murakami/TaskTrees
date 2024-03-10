import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import type { TreeItem } from '../types/types';
import { useDialogStore } from '../store/dialogStore';
import { useAppStateStore } from '../store/appStateStore';
import { useTreeStateStore } from '../store/treeStateStore';

export const useAttachedFile = () => {
  const setIsLoading = useAppStateStore((state) => state.setIsLoading);
  const showDialog = useDialogStore((state) => state.showDialog);
  const items = useTreeStateStore((state) => state.items);
  const setItems = useTreeStateStore((state) => state.setItems);
  const currentTree = useTreeStateStore((state) => state.currentTree);


  // ファイルをFirebaseStorageにアップロードする処理 ------------------------------------------------
  const uploadFile = async (file: File) => {
    setIsLoading(true);
    const storage = getStorage();
    let fileName = file.name;
    const fileExtension = fileName.slice(fileName.lastIndexOf('.'));
    const baseFileName = fileName.slice(0, fileName.lastIndexOf('.'));
    let fileExists = true;
    let counter = 0;

    while (fileExists) {
      try {
        const fileRef = ref(storage, `trees/${currentTree}/${fileName}`);
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
      const newFileRef = ref(storage, `trees/${currentTree}/${fileName}`);
      await uploadBytes(newFileRef, file);
      setIsLoading(false);
      return fileName;
    } catch (error) {
      setIsLoading(false);
      await showDialog('ファイルのアップロードに失敗しました:' + error, 'Error');
      return undefined;
    }
  }

  // ファイルをダウンロードする関数 ------------------------------------------------
  const downloadFile = async (fileName: string) => {
    try {
      setIsLoading(true);
      const storage = getStorage();
      const fileRef = ref(storage, `trees/${currentTree}/${fileName}`);
      const url = await getDownloadURL(fileRef);
      // Blobを使用してファイルをダウンロード
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a); // DOMに追加
      a.click();
      window.URL.revokeObjectURL(downloadUrl); // 使用後はURLを解放
      a.remove(); // DOMから削除
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      const result = await showDialog('ファイルのダウンロードに失敗しました。ファイルが削除されている可能性があります。データベースからこのファイルの添付を削除しますか？:' + error, 'Error', true);
      if (result) {
        const newItems: TreeItem[] = JSON.parse(JSON.stringify(items));
        const updatedItems = await deleteAttachedFile(newItems, fileName);
        setItems(updatedItems);
      }
    }
  }

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
  }
  // 本編 ------------------------------------------------
  const deleteFile = async (fileName: string, isSilent: boolean = false) => {
    if (!isSilent) {
      const result = await showDialog(`ファイル「${fileName}」を削除しますか？`, 'Delete File', true);
      if (!result) return;
    }
    try {
      setIsLoading(true);
      const storage = getStorage();
      const fileRef = ref(storage, `trees/${currentTree}/${fileName}`);
      await deleteObject(fileRef);
      // ファイル削除後、itemsを更新。children[]の中のattachedFileも再帰的に削除する
      const newItems: TreeItem[] = JSON.parse(JSON.stringify(items));
      const updatedItems = await deleteAttachedFile(newItems, fileName);
      setItems(updatedItems);
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      const result = await showDialog('ファイルの削除に失敗しました。既にファイルが削除されている可能性があります。データベースからこのファイルの参照を削除しますか？::' + error, 'Error', true);
      if (result) {
        const newItems: TreeItem[] = JSON.parse(JSON.stringify(items));
        const updatedItems = await deleteAttachedFile(newItems, fileName);
        setItems(updatedItems);
      }
    }
  }

  return { uploadFile, downloadFile, deleteFile };
}