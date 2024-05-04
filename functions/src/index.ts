/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

// メンバーのメールアドレスを取得
exports.getMemberEmails = functions.https.onCall(async (data: { treeId: string }) => {
  const { treeId } = data;
  try {
    // trees/$treeId/membersからUIDのリストを取得
    const membersRef = admin.database().ref(`trees/${treeId}/members`);
    const snapshot = await membersRef.once('value');
    const membersObject = snapshot.val() || {};
    const uids = Object.keys(membersObject); // UIDのリストを取得

    // 各UIDに対応するメールアドレスを取得
    const emails = await Promise.all(
      uids.map(async (uid) => {
        const userRecord = await admin.auth().getUser(uid);
        return userRecord.email;
      })
    );

    return { emails };
  } catch (error) {
    console.error('Error getting member emails:', error);
    throw new functions.https.HttpsError('unknown', 'Failed to get member emails');
  }
});

// メンバーをツリーに追加
exports.addUserToTree = functions.https.onCall(async (data: { email: string; treeId: string }) => {
  const { email, treeId } = data;
  if (!treeId) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "treeId".');
  }
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "email".');
  }
  try {
    // メールアドレスからユーザーを検索
    const userRecord = await admin.auth().getUserByEmail(email);
    const userId = userRecord.uid;

    // trees/$treeId/membersにuserIdを追加
    // membersをオブジェクトとして操作
    const treeMembersRef = admin.database().ref(`trees/${treeId}/members`);
    await treeMembersRef.transaction((currentMembers: { [key: string]: boolean } | null) => {
      if (currentMembers === null) {
        const newMembers: { [key: string]: boolean } = {};
        newMembers[userId] = true; // 新しいメンバーとして追加
        return newMembers;
      } else {
        if (!Object.prototype.hasOwnProperty.call(currentMembers, userId)) {
          currentMembers[userId] = true; // メンバーが存在しなければ追加
        }
        return currentMembers;
      }
    });
    const treeMembersRefV2 = admin.database().ref(`trees/${treeId}/membersV2`);
    await treeMembersRefV2.transaction((currentMembers: { [key: string]: string | boolean } | null) => {
      if (currentMembers === null) {
        const newMembers: { [key: string]: string } = {};
        newMembers[userId] = email; // 新しいメンバーとして追加
        return newMembers;
      } else {
        if (!Object.prototype.hasOwnProperty.call(currentMembers, userId)) {
          currentMembers[userId] = email; // メンバーが存在しなければ追加
        }
        return currentMembers;
      }
    });

    // users/$userId/treeListにtreeIdを追加
    const userTreeListRef = admin.database().ref(`users/${userId}/treeList`);
    await userTreeListRef.transaction((currentTreeList: string[] | null) => {
      if (currentTreeList === null) {
        return [treeId];
      } else if (!currentTreeList.includes(treeId)) {
        return [...currentTreeList, treeId];
      } else {
        return currentTreeList; // 既にtreeListに含まれている場合は何もしない
      }
    });

    // trees/$treeId/timestampに現在の時間を追加
    const timestampRef = admin.database().ref(`trees/${treeId}/timestamp`);
    await timestampRef.set(Date.now());

    return { success: true };
  } catch (error) {
    console.error('Error adding user to tree:', error);
    const message = (error instanceof Error) ? error.message : 'An unknown error occurred';
    throw new functions.https.HttpsError('unknown', message);
  }
});

// ユーザーのメールアドレスを取得
exports.getUserEmails = functions.https.onCall(async (data: { userIds: string[] }) => {
  const { userIds } = data;
  try {
    // 各ユーザーIDに対応するメールアドレスを取得
    const emails = await Promise.all(
      userIds.map(async (uid) => {
        const userRecord = await admin.auth().getUser(uid);
        return userRecord.email;
      })
    );

    return { emails };
  } catch (error) {
    console.error('Error getting user emails:', error);
    const message = (error instanceof Error) ? error.message : 'An unknown error occurred';
    throw new functions.https.HttpsError('unknown', message);
  }
});

// ツリーからユーザーを削除
exports.removeUserFromTree = functions.https.onCall(async (data: { treeId: string; userId: string }) => {
  const { treeId, userId } = data;
  if (!treeId) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "treeId".');
  }
  if (!userId) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "userId".');
  }
  try {
    // trees/$treeId/membersからuserIdを削除
    const treeMembersRef = admin.database().ref(`trees/${treeId}/members`);
    await treeMembersRef.transaction((currentMembers: { [key: string]: boolean } | null) => {
      if (currentMembers === null) {
        return currentMembers; // 何もしない
      } else {
        if (Object.prototype.hasOwnProperty.call(currentMembers, userId)) {
          delete currentMembers[userId]; // userIdをキーとして持つプロパティを削除
          return currentMembers;
        } else {
          return currentMembers; // ユーザーが見つからない場合は何もしない
        }
      }
    });
    const treeMembersRefV2 = admin.database().ref(`trees/${treeId}/membersV2`);
    await treeMembersRefV2.transaction((currentMembers: { [key: string]: string } | null) => {
      if (currentMembers === null) {
        return currentMembers; // 何もしない
      } else {
        if (Object.prototype.hasOwnProperty.call(currentMembers, userId)) {
          delete currentMembers[userId]; // userIdをキーとして持つプロパティを削除
          return currentMembers;
        } else {
          return currentMembers; // ユーザーが見つからない場合は何もしない
        }
      }
    });

    // users/$userId/treeListからtreeIdを削除
    const userTreeListRef = admin.database().ref(`users/${userId}/treeList`);
    await userTreeListRef.transaction((currentTreeList: string[] | null) => {
      if (currentTreeList === null) {
        return currentTreeList; // 何もしない
      } else {
        const index = currentTreeList.indexOf(treeId);
        if (index > -1) {
          currentTreeList.splice(index, 1);
          return currentTreeList;
        } else {
          return currentTreeList; // ツリーが見つからない場合は何もしない
        }
      }
    });

    // trees/$treeId/timestampに現在の時間を追加
    const timestampRef = admin.database().ref(`trees/${treeId}/timestamp`);
    await timestampRef.set(Date.now());

    return { success: true };
  } catch (error) {
    console.error('Error removing user from tree:', error);
    const message = (error instanceof Error) ? error.message : 'An unknown error occurred';
    throw new functions.https.HttpsError('unknown', message);
  }
});

interface ServerTreeItem {
  id: string;
  children: ServerTreeItem[];
  value: string;
  collapsed?: boolean;
  done?: boolean;
}

// 新しいツリーを作成
exports.createNewTree = functions.https.onCall(async (data: { items: ServerTreeItem[], name: string, members: { [key: string]: boolean } }) => {
  const { items, name, members } = data;
  if (!name) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "name".');
  }
  if (!items || !Array.isArray(items)) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "items" array.');
  }
  if (!members || typeof members !== 'object') {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a valid "members" object.');
  }
  try {
    const db = admin.database();
    const treesRef = db.ref('trees');
    const newTreeRef = treesRef.push();
    const emails = await Promise.all(
      Object.keys(members).map(async (uid) => {
        const userRecord = await admin.auth().getUser(uid);
        return userRecord.email;
      })
    );
    const membersV2: { [key: string]: string } = {};
    Object.keys(members).forEach((uid, index) => {
      const email = emails[index];
      if (email) {
        membersV2[uid] = email;
      } else {
        throw new Error('Email not found for UID: ' + uid);
      }
    });
    await newTreeRef.set({
      items: items,
      name: name,
      members: members,
      membersV2: membersV2,
    });
    return newTreeRef.key;
  } catch (error) {
    console.error('Error creating new tree:', error);
    throw new functions.https.HttpsError('unknown', 'Failed to create new tree');
  }
});

// ストレージ内のファイルをコピー
exports.copyFileInStorage = functions.https.onCall(async (data: { sourcePath: string, destinationPath: string }) => {
  const { sourcePath, destinationPath } = data;
  if (!sourcePath || !destinationPath) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with valid "sourcePath" and "destinationPath".');
  }
  try {
    const storage = admin.storage();
    const sourceBucket = storage.bucket();
    const destinationBucket = storage.bucket();

    await sourceBucket.file(sourcePath).copy(destinationBucket.file(destinationPath));

    return { success: true };
  } catch (error) {
    console.error('Error copying file:', error);
    throw new functions.https.HttpsError('unknown', 'Failed to copy file');
  }
});

// 指定されたuidリストを指定されたタイムスタンプで更新
exports.updateTimestamps = functions.https.onCall(async (data: { uids: string[], timestamp: number }) => {
  const { uids, timestamp } = data;
  if (!uids || !Array.isArray(uids) || !timestamp) {
    throw new functions.https.HttpsError('invalid-argument', 'The function must be called with valid "uids" and "timestamp".');
  }
  try {
    const db = admin.database();
    await Promise.all(
      uids.map(async (uid) => {
        const userRef = db.ref(`users/${uid}`);
        await userRef.update({ timestamp: timestamp });
      })
    );
    return { success: true };
  } catch (error) {
    console.error('Error updating timestamps:', error);
    throw new functions.https.HttpsError('unknown', 'Failed to update timestamps');
  }
});