import { defineConfig } from 'vitepress'
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig({
	title: 'Futurable',
	description: "JavaScript's Promise and Fetch APIs with superpowers!",
	base: '/',
	buildEnd() {
		const sitemapPath = resolve(join(__dirname, "dist", "sitemap.xml"));
		const humansPath = resolve(join(__dirname, "dist", "humans.txt"));
		if (!existsSync(sitemapPath)) {
			return;
		}
		let xml = readFileSync(sitemapPath, "utf-8");
		const now = new Date();
		xml = xml.replace(/<lastmod>.*?<\/lastmod>/g, `<lastmod>${now.toISOString()}</lastmod >`);
		writeFileSync(sitemapPath, xml);
		if (!existsSync(humansPath)) {
			return;
		}
		const [month, day, year] = now.toLocaleDateString().split("/");
		let humans = readFileSync(humansPath, "utf-8");
		humans = humans.replace(
			/(Last update:\s*).*/,
			`$1${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
		);
		writeFileSync(humansPath, humans);
	},
	themeConfig: {
		logo: '/Futurable.png',

		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Guide', link: '/guide/getting-started' },
			{ text: 'API', link: '/api/constructor' },
			{ text: 'Examples', link: '/examples/' }
		],

		sidebar: {
			'/guide/': [
				{
					text: 'Introduction',
					items: [
						{ text: 'Getting Started', link: '/guide/getting-started' },
						{ text: 'Why Futurable?', link: '/guide/why-futurable' },
						{ text: 'Installation', link: '/guide/installation' }
					]
				},
				{
					text: 'Core Concepts',
					items: [
						{ text: 'Cancellation', link: '/guide/cancellation' },
						{ text: 'Delays & Sleep', link: '/guide/delays-and-sleep' },
						{ text: 'Fetch Integration', link: '/guide/fetch-integration' },
						{ text: 'Polling', link: '/guide/polling' }
					]
				}
			],
			'/api/': [
				{
					text: 'Instance Methods',
					items: [
						{ text: 'Constructor', link: '/api/constructor' },
						{ text: 'cancel()', link: '/api/cancel' },
						{ text: 'onCancel()', link: '/api/on-cancel' },
						{ text: 'sleep()', link: '/api/sleep' },
						{ text: 'delay()', link: '/api/delay' },
						{ text: 'fetch()', link: '/api/fetch' },
						{ text: 'futurizable()', link: '/api/futurizable' }
					]
				},
				{
					text: 'Static Methods',
					items: [
						{ text: 'Futurable.all()', link: '/api/static-all' },
						{ text: 'Futurable.allSettled()', link: '/api/static-all-settled' },
						{ text: 'Futurable.any()', link: '/api/static-any' },
						{ text: 'Futurable.race()', link: '/api/static-race' },
						{ text: 'Futurable.polling()', link: '/api/static-polling' },
						{ text: 'Futurable.withResolvers()', link: '/api/static-with-resolvers' },
						{ text: 'Futurable.sleep()', link: '/api/static-sleep' },
						{ text: 'Futurable.delay()', link: '/api/static-delay' },
						{ text: 'Futurable.fetch()', link: '/api/static-fetch' },
						{ text: 'Futurable.futurizable()', link: '/api/static-futurizable' }
					]
				},
				{
					text: 'Types',
					items: [
						{ text: 'FuturableExecutor', link: '/api/types/executor' },
						{ text: 'FuturableUtils', link: '/api/types/utils' },
						{ text: 'FuturableLike', link: '/api/types/like' },
						{ text: 'FuturableIterable', link: '/api/types/iterable' }
					]
				}
			],
			'/examples/': [
				{
					text: 'Usage Examples',
					items: [
						{ text: 'Overview', link: '/examples/' },
						{ text: 'React Integration', link: '/examples/react' },
						{ text: 'Vue Integration', link: '/examples/vue' },
						{ text: 'Node.js', link: '/examples/nodejs' },
						{ text: 'Timeout & Retry', link: '/examples/timeout-retry' },
						{ text: 'Advanced Patterns', link: '/examples/advanced' }
					]
				}
			]
		},

		socialLinks: [
			{ icon: 'github', link: 'https://github.com/nDriaDev/futurable' },
			{ icon: 'npm', link: 'https://www.npmjs.com/package/@ndriadev/futurable' },
			{ icon: 'googlehome', link: 'https://ndria.dev' }
		],

		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Copyright © 2024-present Andrea Cosentino'
		},

		search: {
			provider: 'local'
		}
	},

	head: [
		['link', { rel: 'icon', href: '/Futurable.ico' }],
		['meta', { property: 'og:title', content: 'Futurable' }],
		['meta', { property: 'og:description', content: "JavaScript's Promise and Fetch APIs with superpowers!" }],
		['meta', { property: 'og:image', content: '/Futurable.png' }]
	]
})
