/**
 * @description 等待某个条件成立，成立返回true，超时返回false
 * @case 
    waitFor({
        dataFn:()=>{return window.test}, 
        timeout: 10000,
        intervel: 1000
    }).then((res)=>{
        console.log(res)
    })
 */
interface WaitForType {
	dataFn?: () => unknown
	timeout?: number
	intervel?: number
}
export const waitFor: (arg0: WaitForType) => Promise<boolean> = async (
	{ dataFn, timeout, intervel } = {
		timeout: 5000,
		intervel: 1000,
	},
) => {
	return new Promise((resolve) => {
		const timeoutId = setTimeout(() => {
			resolve(false)
			clearInterval(intervalId)
		}, timeout)
		const intervalId = setInterval(() => {
			if (dataFn?.()) {
				clearTimeout(timeoutId)
				clearInterval(intervalId)
				resolve(true)
			}
		}, intervel)
	})
}
