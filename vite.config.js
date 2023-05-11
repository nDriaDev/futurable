import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import EsLint from 'vite-plugin-linter'
import tsConfigPaths from 'vite-tsconfig-paths'
const { EsLinter, linterPlugin } = EsLint

// https://vitejs.dev/config/
export default defineConfig((configEnv) => ({
	plugins: [
		tsConfigPaths(),
		linterPlugin({
			include: ['./src}/**/*.{ts,tsx}'],
			linters: [new EsLinter({ configEnv })],
		}),
		dts({
			include: ['src'],
		}),
	],
	build: {
		lib: {
			entry: resolve('src', 'index.ts'),
			name: 'futurable',
			formats: ['es', 'umd', "cjs"],
			fileName: (format) => `futurable.${format}.js`
		},
		rollupOptions: {
			// external: [...Object.keys(packageJson.peerDependencies)],
		},
	},
}))