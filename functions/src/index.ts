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

    return { success: true };
  } catch (error) {
    console.error('Error adding user to tree:', error);
    const message = (error instanceof Error) ? error.message : 'An unknown error occurred';
    throw new functions.https.HttpsError('unknown', message);
  }
});

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
    await newTreeRef.set({
      items: items,
      name: name,
      members: members,
    });
    return newTreeRef.key;
  } catch (error) {
    console.error('Error creating new tree:', error);
    throw new functions.https.HttpsError('unknown', 'Failed to create new tree');
  }
});