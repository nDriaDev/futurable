import { readFile, readdir, writeFile } from 'fs/promises';
import path from 'path';

const __dirname = new URL('.', import.meta.url).pathname;

async function copy() {
	try {
		const dir = await readdir(path.join(__dirname, "..", "resources", "images"));
		for (const file of dir) {
			const asset = await readFile(path.join(__dirname, "..", "resources", "images", file));
			await writeFile(path.join(__dirname, "..", "docs", file), asset);
		}
	} catch (error) {
		console.error(error);
	}
}

copy();