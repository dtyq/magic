// 按需加载方式
export const loadKaTeX = () => import("katex")

// 同时加载 CSS
export const loadKaTeXCSS = () => import("katex/dist/katex.min.css")

// 使用示例
async function loadPackage() {
	const [katexModule, _] = await Promise.all([loadKaTeX(), loadKaTeXCSS()])
	return katexModule.default
}
export default loadPackage
