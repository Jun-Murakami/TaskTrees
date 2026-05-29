/**
 * Cloud Functions (2nd gen / v2 callable).
 *
 * すべての callable は呼び出し元の認証 (request.auth) を必須とし、
 * 対象ツリーのメンバーシップ等で認可を行う。admin SDK は RTDB の
 * セキュリティルールをバイパスするため、ここでの認可がアクセス制御の要となる。
 */

import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

admin.initializeApp();

// ---------------------------------------------------------------------------
// 認証・認可ヘルパー
// ---------------------------------------------------------------------------

// 認証必須。未認証なら unauthenticated を投げ、認証済みなら uid を返す。
function requireAuth(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  return request.auth.uid;
}

// 指定ツリーのメンバーか判定する。
async function isTreeMember(treeId: string, uid: string): Promise<boolean> {
  const snap = await admin
    .database()
    .ref(`trees/${treeId}/members/${uid}`)
    .once('value');
  return snap.val() === true;
}

// 指定ツリーのメンバーでなければ permission-denied を投げる。
async function requireTreeMember(treeId: string, uid: string): Promise<void> {
  if (!(await isTreeMember(treeId, uid))) {
    throw new HttpsError(
      'permission-denied',
      'You are not a member of this tree.',
    );
  }
}

// 呼び出し元が所属するツリーの全メンバー uid 集合（自分自身を含む）。
// getUserEmails / updateTimestamps の対象を「共有ツリーの仲間」に限定するために使う。
async function coMemberUids(uid: string): Promise<Set<string>> {
  const set = new Set<string>([uid]);
  const treeListSnap = await admin
    .database()
    .ref(`users/${uid}/treeList`)
    .once('value');
  const treeList: unknown = treeListSnap.val();
  if (Array.isArray(treeList)) {
    const treeIds = treeList.filter(
      (t): t is string => typeof t === 'string',
    );
    await Promise.all(
      treeIds.map(async (treeId) => {
        const membersSnap = await admin
          .database()
          .ref(`trees/${treeId}/members`)
          .once('value');
        const members = membersSnap.val() || {};
        Object.keys(members).forEach((m) => set.add(m));
      }),
    );
  }
  return set;
}

// Storage パス trees/<treeId>/... を検証して treeId を取り出す。
// パストラバーサルや trees 配下以外への操作を防ぐ。
function treeIdFromStoragePath(p: string): string {
  if (typeof p !== 'string' || p.includes('..')) {
    throw new HttpsError('permission-denied', 'Invalid storage path.');
  }
  const parts = p.split('/');
  if (parts.length < 3 || parts[0] !== 'trees' || !parts[1]) {
    throw new HttpsError('permission-denied', 'Invalid storage path.');
  }
  return parts[1];
}

// ---------------------------------------------------------------------------
// Callable functions
// ---------------------------------------------------------------------------

// メンバーのメールアドレスを取得（対象ツリーのメンバーのみ）
exports.getMemberEmails = onCall(
  async (request: CallableRequest<{ treeId: string }>) => {
    const uid = requireAuth(request);
    const { treeId } = request.data;
    if (!treeId) {
      throw new HttpsError('invalid-argument', 'A valid "treeId" is required.');
    }
    await requireTreeMember(treeId, uid);
    try {
      const membersRef = admin.database().ref(`trees/${treeId}/members`);
      const snapshot = await membersRef.once('value');
      const membersObject = snapshot.val() || {};
      const uids = Object.keys(membersObject);

      const emails = await Promise.all(
        uids.map(async (memberUid) => {
          const userRecord = await admin.auth().getUser(memberUid);
          return userRecord.email;
        }),
      );

      return { emails };
    } catch (error) {
      console.error('Error getting member emails:', error);
      throw new HttpsError('unknown', 'Failed to get member emails');
    }
  },
);

// メンバーをツリーに追加（既存メンバーのみが招待可能）
exports.addUserToTree = onCall(
  async (request: CallableRequest<{ email: string; treeId: string }>) => {
    const callerUid = requireAuth(request);
    const { email, treeId } = request.data;
    if (!treeId) {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with a valid "treeId".',
      );
    }
    if (!email) {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with a valid "email".',
      );
    }
    await requireTreeMember(treeId, callerUid);
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      const userId = userRecord.uid;

      const treeMembersRef = admin.database().ref(`trees/${treeId}/members`);
      await treeMembersRef.transaction(
        (currentMembers: { [key: string]: boolean } | null) => {
          if (currentMembers === null) {
            const newMembers: { [key: string]: boolean } = {};
            newMembers[userId] = true;
            return newMembers;
          } else {
            if (
              !Object.prototype.hasOwnProperty.call(currentMembers, userId)
            ) {
              currentMembers[userId] = true;
            }
            return currentMembers;
          }
        },
      );
      const treeMembersRefV2 = admin.database().ref(`trees/${treeId}/membersV2`);
      await treeMembersRefV2.transaction(
        (currentMembers: { [key: string]: string | boolean } | null) => {
          if (currentMembers === null) {
            const newMembers: { [key: string]: string } = {};
            newMembers[userId] = email;
            return newMembers;
          } else {
            if (
              !Object.prototype.hasOwnProperty.call(currentMembers, userId)
            ) {
              currentMembers[userId] = email;
            }
            return currentMembers;
          }
        },
      );

      const userTreeListRef = admin.database().ref(`users/${userId}/treeList`);
      await userTreeListRef.transaction((currentTreeList: string[] | null) => {
        if (currentTreeList === null) {
          return [treeId];
        } else if (!currentTreeList.includes(treeId)) {
          return [...currentTreeList, treeId];
        } else {
          return currentTreeList;
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error adding user to tree:', error);
      if (error instanceof HttpsError) throw error;
      const message =
        error instanceof Error ? error.message : 'An unknown error occurred';
      throw new HttpsError('unknown', message);
    }
  },
);

// ユーザーのメールアドレスを取得（共有ツリーの仲間のみ）
exports.getUserEmails = onCall(
  async (request: CallableRequest<{ userIds: string[] }>) => {
    const uid = requireAuth(request);
    const { userIds } = request.data;
    if (!userIds || !Array.isArray(userIds)) {
      throw new HttpsError(
        'invalid-argument',
        'A valid "userIds" array is required.',
      );
    }
    const allowed = await coMemberUids(uid);
    const denied = userIds.some((id) => !allowed.has(id));
    if (denied) {
      throw new HttpsError(
        'permission-denied',
        'You can only resolve emails of users who share a tree with you.',
      );
    }
    try {
      const emails = await Promise.all(
        userIds.map(async (targetUid) => {
          const userRecord = await admin.auth().getUser(targetUid);
          return userRecord.email;
        }),
      );

      return { emails };
    } catch (error) {
      console.error('Error getting user emails:', error);
      const message =
        error instanceof Error ? error.message : 'An unknown error occurred';
      throw new HttpsError('unknown', message);
    }
  },
);

// ツリーからユーザーを削除（対象ツリーのメンバーのみ操作可能）
exports.removeUserFromTree = onCall(
  async (request: CallableRequest<{ treeId: string; userId: string }>) => {
    const callerUid = requireAuth(request);
    const { treeId, userId } = request.data;
    if (!treeId) {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with a valid "treeId".',
      );
    }
    if (!userId) {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with a valid "userId".',
      );
    }
    await requireTreeMember(treeId, callerUid);
    try {
      const treeMembersRef = admin.database().ref(`trees/${treeId}/members`);
      await treeMembersRef.transaction(
        (currentMembers: { [key: string]: boolean } | null) => {
          if (currentMembers === null) {
            return currentMembers;
          } else {
            if (Object.prototype.hasOwnProperty.call(currentMembers, userId)) {
              delete currentMembers[userId];
              return currentMembers;
            } else {
              return currentMembers;
            }
          }
        },
      );
      const treeMembersRefV2 = admin.database().ref(`trees/${treeId}/membersV2`);
      await treeMembersRefV2.transaction(
        (currentMembers: { [key: string]: string } | null) => {
          if (currentMembers === null) {
            return currentMembers;
          } else {
            if (Object.prototype.hasOwnProperty.call(currentMembers, userId)) {
              delete currentMembers[userId];
              return currentMembers;
            } else {
              return currentMembers;
            }
          }
        },
      );

      const userTreeListRef = admin.database().ref(`users/${userId}/treeList`);
      await userTreeListRef.transaction((currentTreeList: string[] | null) => {
        if (currentTreeList === null) {
          return currentTreeList;
        } else {
          const index = currentTreeList.indexOf(treeId);
          if (index > -1) {
            currentTreeList.splice(index, 1);
            return currentTreeList;
          } else {
            return currentTreeList;
          }
        }
      });

      return { success: true };
    } catch (error) {
      console.error('Error removing user from tree:', error);
      if (error instanceof HttpsError) throw error;
      const message =
        error instanceof Error ? error.message : 'An unknown error occurred';
      throw new HttpsError('unknown', message);
    }
  },
);

interface ServerTreeItem {
  id: string;
  children: ServerTreeItem[];
  value: string;
  collapsed?: boolean;
  done?: boolean;
}

// 新しいツリーを作成（呼び出し元が members に含まれている必要がある）
exports.createNewTree = onCall(
  async (
    request: CallableRequest<{
      items: ServerTreeItem[];
      name: string;
      members: { [key: string]: boolean };
    }>,
  ) => {
    const uid = requireAuth(request);
    const { items, name, members } = request.data;
    if (!name) {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with a valid "name".',
      );
    }
    if (!items || !Array.isArray(items)) {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with a valid "items" array.',
      );
    }
    if (!members || typeof members !== 'object') {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with a valid "members" object.',
      );
    }
    // 呼び出し元自身が含まれないツリーは作らせない。
    if (members[uid] !== true) {
      throw new HttpsError(
        'permission-denied',
        'You must include yourself in the new tree members.',
      );
    }
    try {
      const db = admin.database();
      const treesRef = db.ref('trees');
      const newTreeRef = treesRef.push();
      const emails = await Promise.all(
        Object.keys(members).map(async (memberUid) => {
          const userRecord = await admin.auth().getUser(memberUid);
          return userRecord.email;
        }),
      );
      const membersV2: { [key: string]: string } = {};
      Object.keys(members).forEach((memberUid, index) => {
        const email = emails[index];
        if (email) {
          membersV2[memberUid] = email;
        } else {
          throw new Error('Email not found for UID: ' + memberUid);
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
      throw new HttpsError('unknown', 'Failed to create new tree');
    }
  },
);

// ストレージ内のファイルをコピー（コピー元・先ともに自分のツリー配下に限定）
exports.copyFileInStorage = onCall(
  async (
    request: CallableRequest<{ sourcePath: string; destinationPath: string }>,
  ) => {
    const uid = requireAuth(request);
    const { sourcePath, destinationPath } = request.data;
    if (!sourcePath || !destinationPath) {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with valid "sourcePath" and "destinationPath".',
      );
    }
    const sourceTreeId = treeIdFromStoragePath(sourcePath);
    const destinationTreeId = treeIdFromStoragePath(destinationPath);
    await requireTreeMember(sourceTreeId, uid);
    await requireTreeMember(destinationTreeId, uid);
    try {
      const storage = admin.storage();
      const sourceBucket = storage.bucket();
      const destinationBucket = storage.bucket();

      await sourceBucket
        .file(sourcePath)
        .copy(destinationBucket.file(destinationPath));

      return { success: true };
    } catch (error) {
      console.error('Error copying file:', error);
      throw new HttpsError('unknown', 'Failed to copy file');
    }
  },
);

// 指定された uid リストのタイムスタンプを更新（共有ツリーの仲間のみ対象）
exports.updateTimestamps = onCall(
  async (request: CallableRequest<{ uids: string[]; timestamp: number }>) => {
    const callerUid = requireAuth(request);
    const { uids, timestamp } = request.data;
    if (!uids || !Array.isArray(uids) || !timestamp) {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with valid "uids" and "timestamp".',
      );
    }
    const allowed = await coMemberUids(callerUid);
    if (uids.some((id) => !allowed.has(id))) {
      throw new HttpsError(
        'permission-denied',
        'You can only update timestamps of users who share a tree with you.',
      );
    }
    try {
      const db = admin.database();
      await Promise.all(
        uids.map(async (uid) => {
          const userRef = db.ref(`users/${uid}`);
          await userRef.update({ timestampV2: timestamp });
          await userRef.update({ timestamp: timestamp });
        }),
      );
      return { success: true };
    } catch (error) {
      console.error('Error updating timestamps:', error);
      throw new HttpsError('unknown', 'Failed to update timestamps');
    }
  },
);

// 指定されたツリーのタイムスタンプを更新（対象ツリーのメンバーのみ）
exports.updateTreeTimestamp = onCall(
  async (request: CallableRequest<{ treeId: string; timestamp: number }>) => {
    const uid = requireAuth(request);
    const { treeId, timestamp } = request.data;
    if (!treeId || !timestamp) {
      throw new HttpsError(
        'invalid-argument',
        'The function must be called with valid "treeId" and "timestamp".',
      );
    }
    await requireTreeMember(treeId, uid);
    try {
      const db = admin.database();
      const treeRef = db.ref(`trees/${treeId}`);
      await treeRef.update({ timestamp: timestamp });
      return { success: true };
    } catch (error) {
      console.error('Error updating tree timestamp:', error);
      throw new HttpsError('unknown', 'Failed to update tree timestamp');
    }
  },
);
