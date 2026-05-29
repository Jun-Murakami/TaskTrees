#!/usr/bin/env node

/**
 * electron-builder afterAllArtifactBuild フック。
 *
 * 全成果物のビルド完了後に SHA256SUMS とその GPG デタッチ署名 (.asc) を生成する。
 * Linux には OS 強制の署名関門が無いため、配布物の「完全性（改ざん検知）」と
 * 「真正性（誰が作ったか）」を配布側で担保する。
 *
 *   - SHA256SUMS       : 各成果物の SHA-256 (`sha256sum -c` 互換フォーマット)
 *   - SHA256SUMS.asc   : SHA256SUMS への GPG デタッチ署名 (鍵がある場合のみ)
 *
 * ユーザー側の検証手順:
 *   gpg --verify SHA256SUMS.asc SHA256SUMS   # 真正性
 *   sha256sum -c SHA256SUMS                  # 完全性
 *
 * 環境変数:
 *   GPG_SIGNING_KEY : 署名鍵 (鍵ID / フィンガープリント / メール)。省略時は既定鍵
 *   SKIP_GPG_SIGN   : 'true' で署名スキップ（チェックサムのみ生成）
 *
 * 返り値で追加成果物のパスを返すと electron-builder の publish 対象に含まれる。
 */

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadDotEnv } = require(path.join(__dirname, 'load-env.cjs'));

// GPG_SIGNING_KEY / SKIP_GPG_SIGN を拾うため .env を読み込む
loadDotEnv();

const DISTRIBUTABLE = /\.(AppImage|deb|rpm|snap|exe|dmg|zip|pkg)$/i;

/** @param {{ artifactPaths: string[] }} buildResult */
module.exports = async function afterAllArtifactBuild(buildResult) {
  const artifacts = (buildResult.artifactPaths || []).filter((p) =>
    DISTRIBUTABLE.test(path.basename(p)),
  );

  if (artifacts.length === 0) {
    return [];
  }

  const outDir = path.dirname(artifacts[0]);
  const sumsPath = path.join(outDir, 'SHA256SUMS');

  // 成果物ごとに SHA-256 を計算し、
  //   - SHA256SUMS              : 全成果物まとめ（従来どおり）
  //   - <artifact>.sha256       : 成果物ごとのサイドカー（アプリ内自動更新が個別取得して照合）
  // を生成する。サイドカーは `sha256sum -c` 互換フォーマット。
  const additional = [];
  const lines = [];
  for (const p of artifacts) {
    const hash = createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    const base = path.basename(p);
    lines.push(`${hash}  ${base}`);

    const sidecarPath = `${p}.sha256`;
    fs.writeFileSync(sidecarPath, `${hash}  ${base}\n`);
    additional.push(sidecarPath);
  }
  fs.writeFileSync(sumsPath, `${lines.join('\n')}\n`);
  additional.push(sumsPath);
  console.log(
    `  • SHA256SUMS と 各 .sha256 サイドカーを生成 (${artifacts.length} 件)`,
  );

  if (process.env.SKIP_GPG_SIGN === 'true') {
    console.log('  • SKIP_GPG_SIGN=true のため GPG 署名をスキップ');
    return additional;
  }

  try {
    execFileSync('gpg', ['--version'], { stdio: 'ignore' });
  } catch {
    console.warn('  • gpg が見つからないため署名をスキップ（チェックサムのみ）');
    return additional;
  }

  const ascPath = `${sumsPath}.asc`;
  const args = [
    '--batch',
    '--yes',
    '--armor',
    '--detach-sign',
    '--output',
    ascPath,
  ];
  if (process.env.GPG_SIGNING_KEY) {
    args.push('--local-user', process.env.GPG_SIGNING_KEY);
  }
  args.push(sumsPath);

  try {
    execFileSync('gpg', args, { stdio: 'inherit' });
    console.log('  • SHA256SUMS.asc を生成（GPG 署名）');
    additional.push(ascPath);
  } catch {
    console.warn(
      '  • GPG 署名に失敗（署名鍵が無い等）。チェックサムのみ同梱します。',
    );
  }

  return additional;
};
