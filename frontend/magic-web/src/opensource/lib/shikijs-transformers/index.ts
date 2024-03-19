// 按需加载方式
export const loadShikiTransformers = () =>
	import("@shikijs/transformers").then((m) => ({
		transformerNotationDiff: m.transformerNotationDiff,
		transformerNotationErrorLevel: m.transformerNotationErrorLevel,
		transformerNotationFocus: m.transformerNotationFocus,
		transformerNotationHighlight: m.transformerNotationHighlight,
		transformerNotationWordHighlight: m.transformerNotationWordHighlight,
	}))

// 使用示例
async function loadPackage() {
	return await loadShikiTransformers()
}
export default loadPackage
