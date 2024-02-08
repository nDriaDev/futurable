import { resolve } from 'node:path'

import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import tsConfigPaths from 'vite-tsconfig-paths'
import { EsLinter, linterPlugin } from "vite-plugin-linter";

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
			formats: ['es', "cjs"],
			fileName: (format) => `futurable.${format === "cjs" ? "cjs" : "mjs"}`
		},
		rollupOptions: {
			// external: [...Object.keys(packageJson.peerDependencies)],
		},
	},
}))