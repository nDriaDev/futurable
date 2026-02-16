import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		clearMocks: true,
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html', 'lcov'],
			reportsDirectory: './coverage',
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.test.ts',
				'src/**/*.spec.ts',
				'src/index.ts'
			]
			// Optional: configure min coverage values
			// thresholds: {
			//   lines: 80,
			//   branches: 80,
			//   functions: 80,
			//   statements: 80
			// }
		},
		environment: 'node',
		// Reporters
		reporters: ['verbose'],
		// Globals - use describe, it, expect without import
		globals: true,
		// Test file patterns
		include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
		// Exclude patterns
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/cypress/**',
			'**/.{idea,git,cache,output,temp}/**',
			'**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
		],
	},
});