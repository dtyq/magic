// 按需加载方式
export const loadShiki = () =>
	import("shiki").then((m) => ({
		getSingletonHighlighter: m.getSingletonHighlighter,
	}))

// 使用示例
async function loadPackage() {
	return await loadShiki()
}
export default loadPackage
