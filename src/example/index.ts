import { Futurable } from "./../index";

let data;
(async () => {
	await new Promise<void>((res) => {
		Futurable.reject(3)
			.delay(() => {
				data = 4;
				console.log("delay");
				res();
			}, 4000)
			.catch(() => {
				data = 1;
				console.log("catch");
				res();
			});
	});
	console.log(data);
})();
async function getData() {
	await Futurable.fetch("https://hub.dummyapis.com/delay?seconds=10").then(res=>res.text()).then(()=>console.log("finish"))
	return true;
}
(async () => {
	const futurable = Futurable.all([
		getData()
	]);
	setTimeout(() => {
		futurable.cancel();
	}, 4000);
	await futurable;
	console.log(data);
})();

(async () => {
	const data = await Futurable.allSettled([
		Futurable.resolve(1),
		1,
		Futurable.reject(1)
	]);
	console.log(data)
})();
