/**
 * Reset document scroll position
 * 修复场景：
 * 1. 编辑器 focus 时，导致页面高度变化，root节点出现滚动条，用于 blur 时重置滚动位置
 * 2. 审批模板 tab 切换时，会导致整个页面被顶上，用于切换 tab 后重置滚动位置
 */
export function resetDocumentScrollPosition() {
	// 将文档元素滚动到顶部，避免文档位置异常
	document.documentElement.scrollTo({ top: 0, behavior: "instant" })
}
