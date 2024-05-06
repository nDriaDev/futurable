const pkg = require('./package.json');

/** @type {import('typedoc').TypeDocOptions} */
module.exports = {
	entryPoints: ["src/index.ts"],
	hideGenerator: true,
	commentStyle: "JSDoc",
	customCss: "resources/css/style.css",
	customTitle: `Futurable ${pkg.version}`,
	customDescription: "Extension Javascript's Promise API with more functionalities",
	excludePrivate: true,
	favicon: "resources/images/Futurable.ico",
	htmlLang: "en",
	name: "Futurable",
	keywords: [
		"promise",
		"promises",
		"promises-a",
		"promises-aplus",
		"async",
		"await",
		"deferred",
		"deferreds",
		"future",
		"cancel",
		"abort",
		"delay",
		"sleep",
		"abortable",
		"cancelable",
		"futurable"
	],
	out: "docs",
	plugin: [
		"typedoc-material-theme",
		"typedoc-plugin-keywords",
		"typedoc-plugin-extras"
	],
	navigationLinks: {
		"nDriaDev": "https://ndria.dev"
	},
	sidebarLinks: {
		"Github": "https://github.com/nDriaDev/futurable",
	},
	themeColor: "#d0cb32",
	darkHighlightTheme: "material-theme-palenight",
	visibilityFilters: {
		private: false
	}
};