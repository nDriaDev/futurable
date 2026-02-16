import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
	entries: [
		'src/index'
	],
	clean: true,
	declaration: true,
	rollup: {
		emitCJS: true,
		inlineDependencies: true,
		output: {
			exports: "named"
		},
		esbuild: {
			target: "node16",
			minify: true,
			minifyWhitespace: true,
			minifySyntax: true,
			minifyIdentifiers: true,
			treeShaking: true,
			ignoreAnnotations: true,
			legalComments: "none"
		}
	},
	externals: []
})
