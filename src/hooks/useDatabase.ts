import { UniqueIdentifier } from '@dnd-kit/core'
import { TreeItems, TreesList, TreesListItem, TreesListItemIncludingItems } from '../types/types'
import { isTreeItemArray } from '../components/SortableTree/utilities'
import { getAuth } from 'firebase/auth'
import { getDatabase, ref, set, get } from 'firebase/database'
import { useError } from './useError'

export const useDatabase = () => {
  // エラーハンドリング
  const { handleError } = useError()

  // ----------------------------------------------------------------------
  // itemsの保存だけはデバウンスを掛けたいので、useTreeManagement.tsで実装
  // その他はイベントハンドラ内でこれらの関数を呼び出す
  // ----------------------------------------------------------------------

  // itemsをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveItemsDb = (newItems: TreeItems, targetTree: UniqueIdentifier) => {
    if (!getAuth().currentUser || !targetTree || !newItems) {
      return
    }
    try {
      // newItemsの内容をチェック
      if (!isTreeItemArray(newItems)) {
        handleError('保存内容のデータが配列ではありません。code:1')
        return
      }

      const treeStateRef = ref(getDatabase(), `trees/${targetTree}/items`)
      // 更新対象が存在するかチェック
      get(treeStateRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            // 存在する場合、更新を実行
            set(treeStateRef, newItems).catch((error) => {
              handleError('データベースの保存に失敗しました。code:3' + error)
            })
          } else {
            // 存在しない場合、エラーハンドリング
            console.log(
              '更新対象のsnapshotが存在しません。ツリー内容の変更は破棄されました。code:4'
            )
          }
        })
        .catch((error) => {
          console.log(
            '更新対象のitemsが存在しません。ツリー内容の変更は破棄されました。code:5 ' + error
          )
        })
    } catch (error) {
      handleError('ツリー内容の変更をデータベースに保存できませんでした。' + error)
    }
  }

  // treesListをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveTreesListDb = (newTreesList: TreesList) => {
    const user = getAuth().currentUser
    if (!user) {
      return
    }
    try {
      const userTreeListRef = ref(getDatabase(), `users/${user.uid}/treeList`)
      set(
        userTreeListRef,
        newTreesList.map((tree) => tree.id)
      )
    } catch (error) {
      handleError('ツリーリストの変更をデータベースに保存できませんでした。' + error)
    }
  }

  // currentTreeNameをデータベースに保存する関数 ---------------------------------------------------------------------------
  const saveCurrentTreeNameDb = (editedTreeName: string, targetTree: UniqueIdentifier | null) => {
    const user = getAuth().currentUser
    if (!user || !targetTree || !editedTreeName) {
      return
    }
    try {
      const treeNameRef = ref(getDatabase(), `trees/${targetTree}/name`)
      set(treeNameRef, editedTreeName)
    } catch (error) {
      handleError('ツリー名の変更をデータベースに保存できませんでした。' + error)
    }
  }

  // treeListを反復して、データベースからitemsとnameを取得する関数 ---------------------------------------------------------------------------
  // treeDataがTreesListItemIncludingItems型かチェックする関数
  const isValiedTreesListItemIncludingItems = (arg: any): arg is TreesListItemIncludingItems => {
    return arg.id && arg.name && arg.members && arg.items
  }
  // 本編
  const loadAllTreesDataFromDb = async (treesList: TreesList) => {
    const user = getAuth().currentUser
    if (!user) {
      return
    }
    try {
      if (treesList) {
        const promises = treesList.map(async (treesListItem: TreesListItem) => {
          const treeRef = ref(getDatabase(), `trees/${treesListItem.id}`)
          const treeSnapshot = await get(treeRef)
          if (treeSnapshot.exists()) {
            const treeData = treeSnapshot.val()
            if (treeData && !isValiedTreesListItemIncludingItems(treeData)) {
              const treeItemsIncludingItems: TreesListItemIncludingItems = {
                id: treesListItem.id,
                name: treeData.name,
                members: treeData.members,
                items: treeData.items
              }
              return treeItemsIncludingItems
            }
            throw new Error('ツリーデータが不正です。')
          }
          throw new Error('ツリーデータが見つかりません。')
        })
        const treeData = await Promise.all(promises)
        return treeData.filter((item) => item !== null)
      }
    } catch (error) {
      throw new Error('ツリーデータの取得に失敗しました。' + error)
    }
    return null
  }

  return { saveItemsDb, saveTreesListDb, saveCurrentTreeNameDb, loadAllTreesDataFromDb }
}
