import express from 'express';
import path from 'path';

const __dirname = new URL('.', import.meta.url).pathname;

const app = express();

app.use(express.static(path.join((__dirname, "..", "docs"))));

app.get('/', (req, res) => {
	return res.sendFile(path.join(__dirname, '..', 'docs', 'index.html'))
});

app.listen(4173, () => {
	console.log("run");
});