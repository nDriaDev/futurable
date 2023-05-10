export interface FuturableStatus {
	PENDING: "pending";
	FULFILLED: "fulfilled";
	REJECTED: "rejected";
}

// export class Futurable<T> extends Promise<T> {

// }

export type Executor<T> = (
	(
		resolve: (value?: T | PromiseLike<T>) => void,
		reject: (reason?: any) => void,
		utils: {signal:AbortSignal, cancel: () => void, onAbort: (cb:()=>void)=>void, delay: (cb:()=>void, timer:number)=> Futurable<T>, sleep: (timer:number) => Futurable<T>, fetch: (url:string, opts: RequestInit)=>Futurable<T>}
	) => void)