import { useEffect, useState } from 'react'
import { AppState } from '../types/types'
import { isValidAppSettingsState } from '../components/SortableTree/utilities'
import { getAuth } from 'firebase/auth'
import { getDatabase, ref, onValue, set } from 'firebase/database'
import { useAppStateStore } from '../store/appStateStore'
import { useError } from './useError'

export const useAppStateSync = () => {
  const [isLoadedFromExternal, setIsLoadedFromExternal] = useState(false)

  const darkMode = useAppStateStore((state) => state.darkMode)
  const setDarkMode = useAppStateStore((state) => state.setDarkMode)
  const hideDoneItems = useAppStateStore((state) => state.hideDoneItems)
  const setHideDoneItems = useAppStateStore((state) => state.setHideDoneItems)
  const isLoggedIn = useAppStateStore((state) => state.isLoggedIn)

  // エラーハンドリング
  const { handleError } = useError()

  // ダークモード、完了済みアイテムの非表示設定の監視 ------------------------------------------------
  useEffect(() => {
    const user = getAuth().currentUser
    const db = getDatabase()
    if (!user || !isLoggedIn || !db) {
      return
    }
    try {
      const userSettingsRef = ref(db, `users/${user.uid}/settings`)
      onValue(userSettingsRef, (snapshot) => {
        if (snapshot.exists()) {
          const data: AppState = snapshot.val()
          if (isValidAppSettingsState(data)) {
            setHideDoneItems(data.hideDoneItems)
            setDarkMode(data.darkMode)
            setIsLoadedFromExternal(true)
          }
        }
      })
    } catch (error) {
      handleError(error)
    }
  }, [isLoggedIn, handleError, setDarkMode, setHideDoneItems])

  // ダークモード、完了済みアイテムの非表示設定の保存 ------------------------------------------------
  useEffect(() => {
    const user = getAuth().currentUser
    const db = getDatabase()
    if (!user || !db) {
      return
    }

    if (isLoadedFromExternal) {
      setIsLoadedFromExternal(false)
      return
    }

    try {
      const userSettingsRef = ref(db, `users/${user.uid}/settings`)
      set(userSettingsRef, { darkMode, hideDoneItems })
    } catch (error) {
      handleError(error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode, hideDoneItems, handleError])
}

export default useAppStateSync
