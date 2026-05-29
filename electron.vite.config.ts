import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// @rolldown/plugin-babel returns a Promise; electron-vite cannot deep-clone Promises,
// so resolve it once at module load time and reuse the plugin instance.
const reactCompilerBabel = await babel({ presets: [reactCompilerPreset()] })

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: resolve('electron/main/index.ts')
      }
    }
  },
  preload: {
    // sandbox: true で動かすため、preload は ESM ではなく CJS で出力し、
    // 依存（@electron-toolkit/preload）はバンドルする。
    // サンドボックス化された preload は ESM import / 任意モジュールの require が
    // できないため、electron 以外はバンドルする必要がある。
    // electron-vite の externalizeDepsPlugin は electron / node 組み込みを
    // 自動 external 化しつつ、exclude で指定したパッケージはバンドル対象に残す。
    // これを使わず external: ['electron'] のみ指定すると SSR ビルドの既定で
    // @electron-toolkit/preload も external 化され、サンドボックス下で
    // 「module not found」となり preload 全体の読み込みに失敗する。
    plugins: [externalizeDepsPlugin({ exclude: ['@electron-toolkit/preload'] })],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: resolve('electron/preload/index.ts'),
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs'
        }
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: resolve('index.html')
      }
    },
    resolve: {
      alias: {
        '@': resolve('src')
      }
    },
    plugins: [react(), reactCompilerBabel]
  }
})
