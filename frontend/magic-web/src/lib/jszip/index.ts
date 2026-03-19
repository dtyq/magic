// 按需加载方式
export const loadJSZip = () => import("jszip").then((m) => m.default)

// 使用示例
async function loadPackage() {
	return await loadJSZip()
}
export default loadPackage
