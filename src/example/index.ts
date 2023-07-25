import { Futurable } from "./../index";

// let data;
// (async () => {
// 	await new Promise<void>((res) => {
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
// 	});
// 	console.log(data);
// })();
// async function getData() {
// 	await Futurable.fetch("https://hub.dummyapis.com/delay?seconds=10").then(res=>res.text()).then(()=>console.log("finish"))
// 	return true;
// }
// (async () => {
// 	const futurable = Futurable.all([
// 		getData()
// 	]);
// 	setTimeout(() => {
// 		futurable.cancel();
// 	}, 4000);
// 	await futurable;
// 	console.log(data);
// })();

// (async () => {
// 	const data = await Futurable.allSettled([
// 		Futurable.resolve(1),
// 		1,
// 		Futurable.reject(1)
// 	]);
// 	console.log(data)
// })();

// const ff = new Promise<boolean>((res, rej) => res(true)).then(val => 1).then().finally().then(val => console.log(val));
// const f = Promise.any([Promise.resolve(false),new Promise<number>(res => res(3)), 3, Error("dd")]);
// const fh = Futurable.any([
// 	new Futurable<number>((res, rej, utils) => utils.sleep(4000).then(() => rej(4))),
// 	new Futurable<number>((res, rej, utils) => utils.sleep(2000).then(() => rej(3))),
// ]);
//setTimeout(() => { fh.cancel() }, 3000);
// f.then(console.log).catch(console.log);
// fh.then(console.log)
// const f = new Futurable<boolean>((res) => res(true)).then(val => 1).then(onfulfilled)

function getData(signal?: AbortSignal) {
	return Futurable
		.fetch("https://hub.dummyapis.com/delay?seconds=10", {signal})
		.then(res => res.text())
		.then(() => console.log("finish"))
}

const f = Futurable.all([
	getData()
])

setTimeout(() => {
	f.cancel();
}, 3000);