// 按需加载方式
export const loadMermaid = () => import("mermaid").then((m) => m.default)

// 使用示例
async function loadPackage() {
	return await loadMermaid()
}
export default loadPackage
