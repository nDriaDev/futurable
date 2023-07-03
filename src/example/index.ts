import { Futurable } from './../index';

let data;
// (async () => {
// 	await new Promise<void>(res => {
// 		Futurable.reject(3)
// 			.delay(() => {
// 				data = 4;
// 				console.log("delay");
// 				res();
// 			}, 4000)
// 			.catch(() => {
// 				data = 1;
// 				console.log("catch");
// 				res();
// 			});
// 	})
// 	console.log(data);
// })();
let f: any;
setTimeout(() => { f.cancel() }, 1000);
(async () => {
	f = new Futurable((res, rej) => {
		new Promise(res2 => setTimeout(() => {
			console.log("Timeout executed");
			res2(true);
		}, 3000)).then(val => res(val));
	})
		.onCancel(() => { console.log("Cancelled") });
	console.log("pending");
	await f;
	console.log("finish");
})();