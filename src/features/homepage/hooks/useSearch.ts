import { useState, useEffect } from 'react';
import type { TreeItem } from '@/types/types';
import { indexedDb as idb } from '@/indexedDb';
import { useAppStateStore } from '@/store/appStateStore';
import { useTreeStateStore } from '@/store/treeStateStore';

// 再帰的にアイテムを検索する関数
function containsSearchKey(item: TreeItem, searchKey: string): boolean {
  if (item.value.toLowerCase().includes(searchKey.toLowerCase())) {
    return true;
  }
  return item.children.some(child => containsSearchKey(child, searchKey));
}

export const useSearch = () => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const searchKey = useAppStateStore((state) => state.searchKey);
  const setSearchResults = useTreeStateStore((state) => state.setSearchResults);
  const treesList = useTreeStateStore((state) => state.treesList);

  useEffect(() => {
    if (searchKey || searchKey !== '') {
      const asyncFunc = async () => {
        const result = await idb.treestate
          .filter(tree => tree.items.some(item => containsSearchKey(item, searchKey)))
          .toArray();
        if (result) {
          const ensuredResult = result.map(tree => ({ id: tree.id!, name: tree.name!, isArchived: tree.isArchived }));
          setSearchResults(ensuredResult);
        }
      }
      asyncFunc();
    } else {
      setSearchResults(treesList);
    }
  }, [searchKey, setSearchResults, treesList]);


  const searchDocument = () => {
    const matchingNodes: { node: Node; matchIndexes: number[] }[] = [];
    const walker = document.createTreeWalker(document.getElementById('tree-container')!, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        if (!node.nodeValue) return NodeFilter.FILTER_SKIP;
        const matchIndexes: number[] = [];
        const lowerCaseText = node.nodeValue.toLowerCase();
        let startIndex = 0;

        while ((startIndex = lowerCaseText.indexOf(searchKey.toLowerCase(), startIndex)) !== -1) {
          matchIndexes.push(startIndex);
          startIndex += searchKey.length;
        }

        return matchIndexes.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue) continue;
      const matchIndexes: number[] = [];
      const lowerCaseText = node.nodeValue.toLowerCase();
      let startIndex = 0;

      while ((startIndex = lowerCaseText.indexOf(searchKey.toLowerCase(), startIndex)) !== -1) {
        matchIndexes.push(startIndex);
        startIndex += searchKey.length;
      }

      if (matchIndexes.length > 0) {
        matchingNodes.push({
          node: node,
          matchIndexes: matchIndexes,
        });
      }
    }

    return matchingNodes;
  };

  const selectText = (node: Node, searchKey: string, matchIndex: number) => {
    let element = node;
    // nodeがテキストノードの場合、その親要素を取得
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentNode) {
        element = node.parentNode;
      }
    }
    const elementTagName = element && 'tagName' in element ? element.tagName : '';
    // textareaまたはinputの場合の処理
    if (elementTagName === 'TEXTAREA' || elementTagName === 'INPUT') {
      console.log('elementTagName:', elementTagName);
      const htmlInputElement = element as HTMLInputElement | HTMLTextAreaElement;
      if (matchIndex !== -1) {
        htmlInputElement.focus();
        htmlInputElement.setSelectionRange(matchIndex, matchIndex + searchKey.length);
        console.log('htmlInputElement:', htmlInputElement);
      }
    } else {
      // それ以外の要素（div、spanなど）での選択処理
      if (node.nodeType === Node.TEXT_NODE && searchKey.length > 0) {
        const selection = window.getSelection();
        const range = document.createRange();
        if (matchIndex !== -1) {
          range.setStart(node, matchIndex);
          range.setEnd(node, matchIndex + searchKey.length);
          selection!.removeAllRanges();
          selection!.addRange(range);
        }
      }
    }
  };

  // Prev ボタンクリック時の処理 ----------------------------------------------
  const handlePrevButtonClick = () => {
    const matches = searchDocument();
    if (matches.length === 0) return;

    let newIndex = currentIndex;
    let newMatchIndex = currentMatchIndex - 1;
    if (newMatchIndex < 0) {
      // 前のノードに移動
      newIndex = (currentIndex - 1 + matches.length) % matches.length;
      // 新しいノードの最後のマッチへ
      newMatchIndex = matches[newIndex].matchIndexes.length - 1;
    }

    setCurrentIndex(newIndex);
    setCurrentMatchIndex(newMatchIndex);
    selectText(matches[newIndex].node, searchKey, matches[newIndex].matchIndexes[newMatchIndex]);
  };

  // Next ボタンクリック時の処理 ----------------------------------------------
  const handleNextButtonClick = () => {
    const matches = searchDocument();
    if (matches.length === 0) return;

    let newIndex = currentIndex;
    let newMatchIndex = currentMatchIndex + 1;
    if (newMatchIndex >= matches[currentIndex].matchIndexes.length) {
      // 次のノードに移動
      newIndex = (currentIndex + 1) % matches.length;
      // 新しいノードの最初のマッチへ
      newMatchIndex = 0;
    }

    setCurrentIndex(newIndex);
    setCurrentMatchIndex(newMatchIndex);
    selectText(matches[newIndex].node, searchKey, matches[newIndex].matchIndexes[newMatchIndex]);
  };

  return { handlePrevButtonClick, handleNextButtonClick };
};

