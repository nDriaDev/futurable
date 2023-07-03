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
