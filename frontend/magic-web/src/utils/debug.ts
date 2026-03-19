/**
 * 判断是否为调试模式
 * @returns
 */
export const isDebug = () => {
	const urlParams = new URLSearchParams(window.location.search)
	return urlParams.get("debug") === "true"
}
