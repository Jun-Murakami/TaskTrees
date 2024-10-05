import type { TreeItem } from '@/types/types';
import dayjs from 'dayjs';


export const checkAndUpdateItems = async (recentItems: TreeItem[]) => {
  const updatedItems = [...recentItems];
  let hasChanges = false;
  const notificationMessages: string[] = [];

  const checkItem = (item: TreeItem, parentArray: TreeItem[], index: number) => {
    if (
      item.timer &&
      item.isUpLift &&
      item.upLiftMinute !== undefined &&
      item.upLiftMinute > 0
    ) {
      const now = dayjs();
      const timerTime = dayjs(item.timer);
      const diff = timerTime.diff(now, 'minute');

      if (diff <= 0) {
        // タイマー設定時刻が現在時刻を過ぎている場合
        item.isUpLift = false;
        parentArray.splice(index, 1);
        parentArray.unshift(item);
        hasChanges = true;

        const passedTime = Math.abs(diff);
        const hours = Math.floor(passedTime / 60);
        const minutes = passedTime % 60;

        let formattedDiff;
        if (hours > 0 && minutes > 0) {
          formattedDiff = `${hours}時間 ${minutes}分`;
        } else if (hours > 0) {
          formattedDiff = `${hours}時間`;
        } else {
          formattedDiff = `${minutes}分`;
        }

        notificationMessages.push(`タスク "${item.value}" のタイマー設定時刻を ${formattedDiff} 過ぎています。`);
      } else if (dayjs(Date.now()).isAfter(dayjs(item.timer).subtract(item.upLiftMinute, 'minutes'))) {
        // 元の処理（タイマー設定時刻前の通知）
        item.isUpLift = false;
        parentArray.splice(index, 1);
        parentArray.unshift(item);
        hasChanges = true;

        const hours = Math.floor(diff / 60);
        const minutes = (diff % 60) + 1;

        let formattedDiff;
        if (hours > 0 && minutes > 0) {
          formattedDiff = `${hours}時間 ${minutes}分`;
        } else if (hours > 0) {
          formattedDiff = `${hours}時間`;
        } else {
          formattedDiff = `${minutes}分`;
        }

        notificationMessages.push(`タスク "${item.value}" タイマー設定時刻の ${formattedDiff} 前です。`);
      }
    }

    item.children.forEach((child, childIndex) => checkItem(child, item.children, childIndex));
  };

  updatedItems.forEach((item, index) => checkItem(item, updatedItems, index));

  return { hasChanges, updatedItems, notificationMessages };
};