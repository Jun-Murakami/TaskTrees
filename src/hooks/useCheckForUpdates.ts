import { useCallback } from 'react';

const RELEASES_API = 'https://api.github.com/repos/Jun-Murakami/TaskTrees/releases/latest';

export interface ReleaseAsset {
  name: string;
  browserDownloadUrl: string;
  size: number;
}

export interface UpdateInfo {
  latestVersion: string;
  releasePageUrl: string;
  releaseBody: string;
  releaseAssets: ReleaseAsset[];
}

// セマンティックバージョン互換の比較（v は事前に取り除いておく）
const compareVersions = (a: string, b: string): number => {
  const av = a.split('.').map(Number);
  const bv = b.split('.').map(Number);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const x = av[i] || 0;
    const y = bv[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
};

/**
 * GitHub Releases API で最新版をチェック。
 * 新しい版が無い・取得失敗の場合は null を返す。
 */
export const useCheckForUpdates = () => {
  return useCallback(async (currentVersion: string | null): Promise<UpdateInfo | null> => {
    try {
      if (!currentVersion) return null;
      const response = await fetch(RELEASES_API);
      if (!response.ok) return null;
      const data = await response.json();
      if (!data?.tag_name) return null;

      const latestVersion = data.tag_name.replace(/^v/, '');
      if (compareVersions(latestVersion, currentVersion) <= 0) {
        return null;
      }

      const releaseAssets: ReleaseAsset[] = (data.assets ?? []).map(
        (asset: { name: string; browser_download_url: string; size: number }) => ({
          name: asset.name,
          browserDownloadUrl: asset.browser_download_url,
          size: asset.size,
        }),
      );
      return {
        latestVersion,
        releasePageUrl: data.html_url ?? '',
        releaseBody: data.body ?? '',
        releaseAssets,
      };
    } catch (error) {
      console.error('更新のチェック中にエラーが発生しました:', error);
      return null;
    }
  }, []);
};
