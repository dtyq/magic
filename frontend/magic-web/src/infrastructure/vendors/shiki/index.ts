// 按需加载方式
export type { Highlighter } from "shiki"

export const loadShiki = () =>
	import("shiki").then((m) => ({
		getSingletonHighlighter: m.getSingletonHighlighter,
	}))

export default loadShiki
