import { readFile, readdir, writeFile } from 'fs/promises';
import path from 'path';

const __dirname = new URL('.', import.meta.url).pathname;
const IMAGES_PATH = path.join(__dirname, "..", "resources", "images");
const SEO_PATH = path.join(__dirname, "..", "resources", "seo");
const DOCS_PATH = path.join(__dirname, "..", "docs");

async function copy() {
	try {
		const [dir, dirSeo] = await Promise.all([
			readdir(IMAGES_PATH),
			readdir(SEO_PATH)
		]);
		for (const file of dir) {
			const asset = await readFile(path.join(IMAGES_PATH, file));
			await writeFile(path.join(DOCS_PATH, file), asset);
		}
		for (const file of dirSeo) {
			if (file === "meta-tags.html") {
				const asset = await readFile(path.join(SEO_PATH, file), { encoding: "utf8" });
				let indexFile = await readFile(path.join(DOCS_PATH, "index.html"), {
					encoding: "utf8"
				});
				indexFile = indexFile.split("<head>")[0] + "<head>" + asset.split("\n").filter((_, index, arr) => index !== 0 && index !== arr.length - 1).join("") + indexFile.split("<head>")[1];
				await writeFile(path.join(DOCS_PATH, "index.html"), indexFile);
			} else {
				const asset = await readFile(path.join(SEO_PATH, file));
				await writeFile(path.join(DOCS_PATH, file), asset);
			}
		}
	} catch (error) {
		console.error(error);
	}
}

copy();