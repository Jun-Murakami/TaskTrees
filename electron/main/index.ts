import { app, shell, BrowserWindow, ipcMain, nativeTheme, Menu, dialog, session } from 'electron';
import fs from 'fs';
import http from 'http';
import https from 'https';
import { spawn, execFileSync } from 'child_process';
import { createHash } from 'crypto';
import path, { join } from 'path';
import { electronApp, optimizer, is } from '@electron-toolkit/utils';
import contextMenu from 'electron-context-menu';
import icon from '../../resources/icon.png?asset';

let mainWindow: BrowserWindow | null = null; // mainWindowをグローバル変数として宣言
let forceCloseTimeout: ReturnType<typeof setTimeout> | null = null; // レンダラー応答なし時の強制終了タイマー

// アップデートダウンロード中のリクエストとファイルパス（キャンセル時に破棄するため保持）
let activeDownloadRequest: http.ClientRequest | null = null;
let activeDownloadPath: string | null = null;
interface WindowState {
  bounds?: {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  };
  isMaximized?: boolean;
}

contextMenu({
  showInspectElement: is.dev,
});

// アップデート配布元として許可するホスト（GitHub Releases のみ）。
// github.com から *.githubusercontent.com（CDN）への 302 リダイレクトを許可する。
function isAllowedUpdateHost(hostname: string): boolean {
  return hostname === 'github.com' || hostname.endsWith('.githubusercontent.com');
}

// ダウンロード URL が https かつ許可ホストかを検証する。
// レンダラー（侵害時）からの任意 URL ダウンロード／実行を防ぐ。
function isAllowedUpdateUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    return u.protocol === 'https:' && isAllowedUpdateHost(u.hostname);
  } catch {
    return false;
  }
}

// shell.openExternal は OS のプロトコルハンドラを起動するため、
// 安全なスキーム（http/https/mailto）のみに限定する。
// （file: や任意カスタムスキーム経由の攻撃・誤起動を防ぐ）
function openExternalSafely(rawUrl: string): void {
  try {
    const { protocol } = new URL(rawUrl);
    if (protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:') {
      shell.openExternal(rawUrl);
    } else {
      console.warn(`許可されないスキームのため外部オープンを拒否しました: ${rawUrl}`);
    }
  } catch {
    console.warn(`不正な URL のため外部オープンを拒否しました: ${rawUrl}`);
  }
}

// 任意: 期待する署名者でさらに厳格化する。空文字なら「有効な署名であること」のみ要求。
//   Windows: 証明書 Subject の部分一致（例: 'CN=Jun Murakami'）
//   macOS  : Developer ID の Team ID（例: 'XXXXXXXXXX'）
const EXPECTED_WIN_PUBLISHER = '';
const EXPECTED_MAC_TEAM_ID = '';

// 許可ホストからテキスト（.sha256 等）を取得する。リダイレクトも許可ホストに限定。
function fetchTextFromAllowedUrl(
  rawUrl: string,
  redirectCount = 0,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isAllowedUpdateUrl(rawUrl)) {
      reject(new Error('invalid-url'));
      return;
    }
    if (redirectCount > 5) {
      reject(new Error('too-many-redirects'));
      return;
    }
    https
      .get(rawUrl, (res) => {
        if (
          (res.statusCode === 301 || res.statusCode === 302) &&
          res.headers.location
        ) {
          res.resume();
          fetchTextFromAllowedUrl(res.headers.location, redirectCount + 1).then(
            resolve,
            reject,
          );
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => {
          data += c;
          // .sha256 は数十バイト。異常に大きければ中断。
          if (data.length > 100_000) res.destroy();
        });
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });
}

// ファイルの SHA-256 を計算する（ストリームで、メモリに全展開しない）。
function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// 完全性検証: リリースの <asset>.sha256 を取得し、ダウンロード物のハッシュと照合。
// .sha256 が取得できない／不一致なら false（fail-closed）。
async function verifyChecksum(
  filePath: string,
  downloadUrl: string,
): Promise<boolean> {
  try {
    const text = await fetchTextFromAllowedUrl(`${downloadUrl}.sha256`);
    const match = text.match(/[a-fA-F0-9]{64}/);
    if (!match) return false;
    const expected = match[0].toLowerCase();
    const actual = (await computeFileSha256(filePath)).toLowerCase();
    return expected === actual;
  } catch (error) {
    console.error('チェックサム検証に失敗しました:', error);
    return false;
  }
}

// 真正性検証: Windows / macOS のコード署名を検証する。
//   Windows: Authenticode の Status が Valid（改ざんなし＋信頼チェーン＋失効なし）
//   macOS  : Gatekeeper 評価（公証＋Developer ID 署名、ステープル済み）
// Linux は OS の署名関門が無いため true（完全性は SHA-256、真正性は配布側 GPG で担保）。
function verifyCodeSignature(filePath: string): boolean {
  try {
    if (process.platform === 'win32') {
      const escaped = filePath.replace(/'/g, "''");
      const publisherCheck = EXPECTED_WIN_PUBLISHER
        ? `if ($sig.SignerCertificate.Subject -notlike '*${EXPECTED_WIN_PUBLISHER}*') { exit 2 }`
        : '';
      const psScript =
        `$ErrorActionPreference='Stop'; ` +
        `$sig = Get-AuthenticodeSignature -LiteralPath '${escaped}'; ` +
        `if ($sig.Status -ne 'Valid') { exit 1 }; ` +
        `${publisherCheck} exit 0`;
      execFileSync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', psScript],
        { stdio: 'pipe' },
      );
      return true;
    }
    if (process.platform === 'darwin') {
      // ダウンロードした .dmg を Gatekeeper で評価（公証チケットを検証）。
      execFileSync(
        'spctl',
        [
          '--assess',
          '--type',
          'open',
          '--context',
          'context:primary-signature',
          '--verbose',
          filePath,
        ],
        { stdio: 'pipe' },
      );
      return true;
    }
    return true;
  } catch (error) {
    console.error('コード署名の検証に失敗しました:', error);
    return false;
  }
}

function createWindow(): void {
  const userDataPath = app.getPath('userData');
  const windowStatePath = path.join(userDataPath, 'windowState.json');
  let windowState: WindowState = {};
  if (fs.existsSync(windowStatePath)) {
    try {
      windowState = JSON.parse(fs.readFileSync(windowStatePath, 'utf8'));
    } catch (error) {
      console.error('ウィンドウの状態の読み込みに失敗しました:', error);
    }
  }

  // バックアップを保存するフォルダを作成
  const backupsFolderPath = path.join(userDataPath, 'Backups');
  if (!fs.existsSync(backupsFolderPath)) {
    fs.mkdirSync(backupsFolderPath, { recursive: true });
  }

  mainWindow = new BrowserWindow({
    width: 900,
    height: 800,
    minWidth: 770,
    minHeight: 400,
    ...windowState.bounds, // 保存されたウィンドウの位置とサイズを適用
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      spellcheck: false,
    },
  });

  if (windowState.isMaximized) {
    mainWindow.maximize(); // 保存された状態が最大化なら最大化する
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    openExternalSafely(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  if (is.dev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('close', (e) => {
    // Mac以外でデフォルトの閉じる動作をキャンセル
    e.preventDefault();

    if (mainWindow && !mainWindow.isDestroyed()) {
      // ウィンドウの状態を取得（最大化を解除せずに通常サイズを取得）
      const isMaximized = mainWindow.isMaximized();
      const bounds = isMaximized ? mainWindow.getNormalBounds() : mainWindow.getBounds();

      // JSON形式で保存するデータ
      const windowState = {
        bounds: bounds,
        isMaximized: isMaximized,
      };

      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      fs.writeFileSync(path.join(userDataPath, 'windowState.json'), JSON.stringify(windowState));

      if (!forceCloseTimeout) {
        // 最後のツリー状態を保存
        mainWindow.webContents.send('save-last-tree');

        // 全ツリーをバックアップ
        mainWindow.webContents.send('before-close');

        // レンダラーが応答しない場合、8秒後に強制終了
        forceCloseTimeout = setTimeout(() => {
          forceCloseTimeout = null;
          mainWindow?.destroy();
        }, 8000);
      }
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // 2つ目のインスタンスが起動しようとしたときの処理
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron.tasktrees');

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    // CSP ------------------------------------------------------------------------------------
    // Dev mode skips CSP — HMR requires inline scripts injected by @vitejs/plugin-react-swc
    // Production: apply CSP only to the main renderer (file:// origin), not to OAuth windows
    if (!is.dev) {
      session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        if (!details.url.startsWith('file://')) {
          callback({ cancel: false });
          return;
        }
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              [
                "default-src 'self'",
                "script-src 'self' https://*.firebasedatabase.app https://tasktree-s.web.app https://tasktrees-fb.web.app https://appleid.apple.com https://appleid.cdn-apple.com https://www.apple.com https://accounts.google.com https://oauth2.googleapis.com",
                "connect-src https://*.cloudfunctions.net https://api.github.com https://tasktree-s.web.app https://tasktrees-fb.web.app https://appleid.apple.com https://appleid.cdn-apple.com https://www.apple.com https://*.googleapis.com https://accounts.google.com https://*.firebasedatabase.app gs://*.appspot.com ws://*.firebasedatabase.app ws://tasktree-s.web.app ws://tasktrees-fb.web.app",
                "frame-src 'self' https://*.firebasedatabase.app https://tasktree-s.web.app https://tasktrees-fb.web.app https://appleid.apple.com https://appleid.cdn-apple.com https://www.apple.com https://*.googleapis.com https://accounts.google.com",
                "style-src 'self' 'unsafe-inline' https://appleid.apple.com https://appleid.cdn-apple.com https://www.apple.com https://*.googleapis.com https://accounts.google.com",
                "img-src 'self' https://firebasestorage.googleapis.com data: https://appleid.apple.com https://appleid.cdn-apple.com https://www.apple.com https://*.googleapis.com https://accounts.google.com",
                "font-src 'self' data: https://appleid.apple.com https://appleid.cdn-apple.com https://www.apple.com https://*.googleapis.com https://accounts.google.com",
              ].join('; '),
            ],
          },
        });
      });
    }

    // IPC ------------------------------------------------------------------------------------

    // アプリのバージョンを取得
    ipcMain.handle('get-app-version', () => {
      return app.getVersion();
    });

    // プラットフォーム情報を取得
    // - osInfo: 'darwin' | 'win32' | 'linux'
    // - isAppImage: AppImage 起動時のみ true（env APPIMAGE が設定される）
    //   AppImage 以外（deb など）は false → アプリ内自動更新が可能
    ipcMain.handle('get-platform-info', () => {
      return {
        osInfo: process.platform,
        isAppImage: !!process.env.APPIMAGE,
      };
    });

    // 外部 URL を OS の既定ブラウザで開く（リリースページや AppImage 案内用）
    ipcMain.on('open-external-link', (_, url: string) => {
      openExternalSafely(url);
    });

    // アップデートのダウンロード
    // 戻り値: { success: true } / { success: false, error: string }
    //   error === 'cancelled' のとき、UI 側は idle に戻す
    ipcMain.handle(
      'update:download',
      async (
        event,
        downloadUrl: string,
      ): Promise<{ success: boolean; error?: string }> => {
        // 配布元の検証（GitHub Releases のみ許可）。
        // 不正な URL はダウンロードも実行もしない。
        if (!isAllowedUpdateUrl(downloadUrl)) {
          return { success: false, error: 'invalid-download-url' };
        }

        // Linux は Downloads に置く（AppImage を後から手動起動するため）。
        // それ以外は temp に置いて完了後に installer を起動する。
        const savePath =
          process.platform === 'linux'
            ? app.getPath('downloads')
            : app.getPath('temp');
        // path.basename でパストラバーサル（../ 等）を除去してファイル名のみ採用。
        const fileName =
          path.basename(
            decodeURIComponent(downloadUrl.split('/').pop() || ''),
          ) || 'update-installer';
        const fullPath = path.join(savePath, fileName);
        activeDownloadPath = fullPath;

        return new Promise((resolve) => {
          const doDownload = (url: string, redirectCount = 0): void => {
            if (redirectCount > 5) {
              activeDownloadRequest = null;
              activeDownloadPath = null;
              resolve({ success: false, error: 'Too many redirects' });
              return;
            }

            const lib = url.startsWith('https') ? https : http;
            const req = lib.get(url, (response) => {
              // リダイレクト対応（GitHub Releases の S3 リダイレクト）
              if (
                (response.statusCode === 301 || response.statusCode === 302) &&
                response.headers.location
              ) {
                response.resume();
                // リダイレクト先も許可ホストに限定する。
                if (!isAllowedUpdateUrl(response.headers.location)) {
                  activeDownloadRequest = null;
                  activeDownloadPath = null;
                  resolve({ success: false, error: 'invalid-download-url' });
                  return;
                }
                doDownload(response.headers.location, redirectCount + 1);
                return;
              }

              if (response.statusCode !== 200) {
                activeDownloadRequest = null;
                activeDownloadPath = null;
                resolve({
                  success: false,
                  error: `HTTP ${response.statusCode}`,
                });
                return;
              }

              const totalBytes = Number.parseInt(
                response.headers['content-length'] || '0',
                10,
              );
              let receivedBytes = 0;

              const fileStream = fs.createWriteStream(fullPath);

              response.on('data', (chunk: Buffer) => {
                receivedBytes += chunk.length;
                const percent =
                  totalBytes > 0
                    ? Math.round((receivedBytes / totalBytes) * 100)
                    : 0;
                if (!event.sender.isDestroyed()) {
                  event.sender.send('update:download-progress', {
                    receivedBytes,
                    totalBytes,
                    percent,
                  });
                }
              });

              response.pipe(fileStream);

              fileStream.on('finish', async () => {
                activeDownloadRequest = null;

                // ① 完全性検証: リリースの <asset>.sha256 と照合
                const checksumOk = await verifyChecksum(fullPath, downloadUrl);
                if (!checksumOk) {
                  try {
                    fs.unlinkSync(fullPath);
                  } catch {}
                  activeDownloadPath = null;
                  resolve({ success: false, error: 'checksum-mismatch' });
                  return;
                }

                // ② 真正性検証: Windows / macOS のコード署名
                if (!verifyCodeSignature(fullPath)) {
                  try {
                    fs.unlinkSync(fullPath);
                  } catch {}
                  activeDownloadPath = null;
                  resolve({ success: false, error: 'signature-invalid' });
                  return;
                }

                activeDownloadPath = null;

                if (process.platform === 'win32') {
                  // NSIS installer を起動してアプリを終了 → installer が上書き
                  const errorMsg = await shell.openPath(fullPath);
                  if (errorMsg) {
                    resolve({ success: false, error: errorMsg });
                    return;
                  }
                  setTimeout(() => app.quit(), 500);
                } else if (process.platform === 'darwin') {
                  // macOS: DMG をマウントして .app を入れ替え、新バージョンで再起動
                  const appBundlePath = path.resolve(
                    process.execPath,
                    '..',
                    '..',
                    '..',
                  );
                  if (!appBundlePath.endsWith('.app')) {
                    // dev 環境等のフォールバック（Finder で開いてアプリ終了）
                    await shell.openPath(fullPath);
                    setTimeout(() => app.quit(), 500);
                    resolve({ success: true });
                    return;
                  }
                  const pid = process.pid;
                  const scriptPath = path.join(
                    app.getPath('temp'),
                    'tasktrees-update.sh',
                  );
                  // パス類はスクリプト本文に文字列補間せず、bash の位置引数
                  // ($1..$4) として渡す。これによりファイル名（URL 由来）に
                  // シェルメタ文字が含まれてもコマンドインジェクションは発生しない。
                  const script = `#!/bin/bash
PID="$1"
DMG_PATH="$2"
APP_PATH="$3"
SCRIPT_PATH="$4"
EXPECTED_TEAM_ID="$5"

# 旧アプリの終了を待機
while kill -0 "$PID" 2>/dev/null; do sleep 0.5; done

# DMG をマウント
MOUNT_OUTPUT=$(hdiutil attach "$DMG_PATH" -nobrowse -noautoopen 2>&1)
MOUNT_POINT=$(echo "$MOUNT_OUTPUT" | grep -oE '/Volumes/.*' | head -1)

if [ -z "$MOUNT_POINT" ]; then
  exit 1
fi

# マウントされたボリューム内の .app を検索
SRC_APP=$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" -print -quit)

if [ -z "$SRC_APP" ]; then
  hdiutil detach "$MOUNT_POINT" -quiet
  exit 1
fi

# 実際にインストールする .app のコード署名を検証（防御の深さ）。
# 不正なら旧アプリを保持したまま中止する。
if ! codesign --verify --deep --strict "$SRC_APP"; then
  hdiutil detach "$MOUNT_POINT" -quiet
  exit 1
fi
if ! spctl --assess --type execute "$SRC_APP"; then
  hdiutil detach "$MOUNT_POINT" -quiet
  exit 1
fi
if [ -n "$EXPECTED_TEAM_ID" ]; then
  ACTUAL_TEAM_ID=$(codesign -dv --verbose=4 "$SRC_APP" 2>&1 | grep -oE 'TeamIdentifier=[A-Z0-9]+' | head -1 | cut -d= -f2)
  if [ "$ACTUAL_TEAM_ID" != "$EXPECTED_TEAM_ID" ]; then
    hdiutil detach "$MOUNT_POINT" -quiet
    exit 1
  fi
fi

# 旧アプリを削除して新アプリをコピー
rm -rf "$APP_PATH"
ditto "$SRC_APP" "$APP_PATH"

# アンマウント＆クリーンアップ
hdiutil detach "$MOUNT_POINT" -quiet
rm -f "$DMG_PATH"

# 新バージョンを起動
open "$APP_PATH"

# 自身を削除
rm -f "$SCRIPT_PATH"
`;
                  fs.writeFileSync(scriptPath, script, { mode: 0o755 });
                  spawn(
                    'bash',
                    [
                      scriptPath,
                      String(pid),
                      fullPath,
                      appBundlePath,
                      scriptPath,
                      EXPECTED_MAC_TEAM_ID,
                    ],
                    {
                      detached: true,
                      stdio: 'ignore',
                    },
                  ).unref();
                  setTimeout(() => app.quit(), 500);
                } else {
                  // Linux: .deb / .AppImage どちらも、ダウンロード先フォルダを開く
                  // （.deb は dpkg、AppImage は実行権限付与してダブルクリック起動を案内）
                  if (fullPath.endsWith('.AppImage')) {
                    try {
                      fs.chmodSync(fullPath, 0o755);
                    } catch (chmodError) {
                      console.error(
                        'AppImage への実行権限付与に失敗しました:',
                        chmodError,
                      );
                    }
                  }
                  shell.showItemInFolder(fullPath);
                }
                resolve({ success: true });
              });

              fileStream.on('error', (err) => {
                activeDownloadRequest = null;
                try {
                  fs.unlinkSync(fullPath);
                } catch {}
                activeDownloadPath = null;
                resolve({ success: false, error: err.message });
              });
            });

            req.on('error', (err) => {
              activeDownloadRequest = null;
              try {
                if (activeDownloadPath) fs.unlinkSync(activeDownloadPath);
              } catch {}
              activeDownloadPath = null;
              // ユーザーキャンセル（destroy）はエラーにしない
              if (
                (err as NodeJS.ErrnoException).code === 'ERR_STREAM_DESTROYED'
              ) {
                resolve({ success: false, error: 'cancelled' });
              } else {
                resolve({ success: false, error: err.message });
              }
            });

            activeDownloadRequest = req;
          };

          doDownload(downloadUrl);
        });
      },
    );

    // アップデートダウンロードのキャンセル
    ipcMain.on('update:cancel-download', () => {
      if (activeDownloadRequest) {
        activeDownloadRequest.destroy();
        activeDownloadRequest = null;
      }
      if (activeDownloadPath) {
        try {
          fs.unlinkSync(activeDownloadPath);
        } catch {}
        activeDownloadPath = null;
      }
    });

    // ダークモードの設定
    ipcMain.on('set-dark-mode', (_, isDarkMode) => {
      nativeTheme.themeSource = isDarkMode ? 'dark' : 'light';
    });

    // メニュー項目の定義
    const template: (Electron.MenuItemConstructorOptions | Electron.MenuItem)[] = [
      {
        label: 'ファイル',
        submenu: [
          {
            label: '新しいツリーを作成',
            id: 'create-new-tree',
            enabled: false,
            click: (): void => {
              mainWindow!.webContents.send('create-new-tree');
            },
          },
          { type: 'separator' },
          {
            label: 'ツリーを読み込み',
            id: 'import-tree',
            enabled: false,
            click: async (): Promise<void> => {
              const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openFile'],
                filters: [{ name: 'JSON', extensions: ['json'] }],
              });
              if (!canceled && filePaths.length === 1) {
                try {
                  const data = fs.readFileSync(filePaths[0], 'utf8');
                  mainWindow!.webContents.send('loaded-content', data);
                } catch (error) {
                  console.error('ファイルの読み込みに失敗しました:', error);
                  mainWindow!.webContents.send('loaded-content', null);
                }
              }
              return Promise.resolve();
            },
          },
          {
            label: '現在のツリーを保存',
            id: 'save-tree',
            enabled: false,
            click: (): void => {
              mainWindow!.webContents.send('save-tree');
            },
          },
          {
            label: 'すべてのツリーを保存',
            id: 'save-all-tree',
            enabled: false,
            click: (): void => {
              mainWindow!.webContents.send('save-all-tree');
            },
          },
          { type: 'separator' },
          {
            label: 'バックアップフォルダを表示',
            click: (): void => {
              const backupsFolderPath = path.join(app.getPath('userData'), 'Backups');
              shell.openPath(backupsFolderPath);
            },
          },
          { type: 'separator' },
          { label: '終了', role: 'quit' as const }, // 'as const'を使用してroleの値がリテラル型であることを明示
        ],
      },
      {
        label: '編集',
        submenu: [
          { label: '元に戻す', role: 'undo' as const },
          { label: 'やり直し', role: 'redo' as const },
          { type: 'separator' },
          { label: '切り取り', role: 'cut' as const },
          { label: 'コピー', role: 'copy' as const },
          { label: '貼り付け', role: 'paste' as const },
          { label: 'すべて選択', role: 'selectAll' as const },
        ],
      },
    ];

    // メニューの作成
    const menu = Menu.buildFromTemplate(template);

    // アプリケーションのメニューとして設定
    Menu.setApplicationMenu(menu);

    // メニュー項目の有効・無効を切り替える
    ipcMain.on('toggle-menu-item', (_, { menuItemId, enabled }) => {
      const menuItem = Menu.getApplicationMenu()!.getMenuItemById(menuItemId);
      if (menuItem) {
        menuItem.enabled = enabled;
      }
    });

    // 認証のためのURLを開く
    ipcMain.handle('open-oauth-url', (_, url: string) => {
      return new Promise((resolve, reject) => {
        const window = new BrowserWindow({
          width: 800,
          height: 800,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            // リモートの OAuth ページを読み込むウィンドウ。preload も持たないため
            // サンドボックスを有効化してレンダラーを隔離する。
            sandbox: true,
          },
          autoHideMenuBar: true,
        })
        const defaultUA = window.webContents.getUserAgent()
        window.webContents.setUserAgent(defaultUA.replace(/\s*Electron\/\S+/, ''))
        window.loadURL(url)

        // ユーザーがウィンドウを閉じた場合にRejectを返す
        window.on('closed', () => {
          reject(new Error('closed-by-user'))
        })

        window.webContents.on("will-navigate", (_, url) => {
          if (url.startsWith(`https://${import.meta.env.VITE_ELECTRON_AUTH_DOMAIN}/auth/redirect`)) {
            window.removeAllListeners('closed') // 'closed'イベントリスナーを削除
            window.close()

            // get ID token from the URL
            const urlObj = new URL(url)
            const credential = urlObj.searchParams.get("credential")

            if (credential === null) {
              reject(new Error("ID Token is missing"))
              return
            }

            resolve(JSON.parse(credential))
          }
        })
      })
    });

    let isQuitting = false;

    app.on('before-quit', () => {
      isQuitting = true; // アプリケーションが終了しようとしていることを示すフラグを設定
    });

    // レンダラーからバックアップjsonを受け取り、ファイルとして保存
    function getCurrentDateTime() {
      const now = new Date();
      return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
    }

    function saveBackup(data: string) {
      const userDataPath = app.getPath('userData');
      const backupsFolderPath = path.join(userDataPath, 'Backups');
      if (!fs.existsSync(backupsFolderPath)) {
        fs.mkdirSync(backupsFolderPath, { recursive: true });
      }
      const filePath = join(backupsFolderPath, `TaskTrees_Backup_${getCurrentDateTime()}.json`);
      fs.writeFileSync(filePath, data, 'utf8');
      // バックアップファイルをリストアップし、50個以上あれば古いものから削除
      const files = fs
        .readdirSync(backupsFolderPath)
        .filter((file: string) => file.startsWith('TaskTrees_Backup_'))
        .sort((a: string, b: string) => a.localeCompare(b));
      if (files.length > 50) {
        files.slice(0, files.length - 50).forEach((file: string) => {
          fs.unlinkSync(join(backupsFolderPath, file));
        });
      }
    }

    // データをバックアップしてからウィンドウを閉じる
    ipcMain.on('close-completed', (_, data) => {
      if (forceCloseTimeout) {
        clearTimeout(forceCloseTimeout);
        forceCloseTimeout = null;
      }
      if (data !== 'error') {
        saveBackup(data);
      }
      mainWindow?.destroy(); // ウィンドウを強制的に閉じる
      if (isQuitting) {
        app?.quit(); // アプリケーションを終了
      }
    });

    // データをバックアップ
    ipcMain.on('save-backup', (_, { data }) => {
      saveBackup(data);
    });

    createWindow();

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
