/**
 * DOM节点缓存，减少重复查询操作
 */
export const domCache = {
	nodes: new Map<string, HTMLElement>(),
	getNode: (selector: string) => {
		if (!domCache.nodes.has(selector)) {
			const node = document.querySelector(selector) as HTMLElement
			if (node) {
				domCache.nodes.set(selector, node)
			}
		}
		return domCache.nodes.get(selector)
	},
	clearCache: () => {
		domCache.nodes.clear()
	},
}
