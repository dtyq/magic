// 按需加载方式
export const loadShikiTransformers = () =>
	import("@shikijs/transformers").then((m) => ({
		transformerNotationDiff: m.transformerNotationDiff,
		transformerNotationErrorLevel: m.transformerNotationErrorLevel,
		transformerNotationFocus: m.transformerNotationFocus,
		transformerNotationHighlight: m.transformerNotationHighlight,
		transformerNotationWordHighlight: m.transformerNotationWordHighlight,
	}))

export default loadShikiTransformers
