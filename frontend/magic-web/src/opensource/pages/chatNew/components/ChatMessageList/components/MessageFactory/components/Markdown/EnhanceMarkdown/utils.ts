// 递归找到DOM下真正的最后一个可见的文本节点所在元素
export function findLastElement(element: HTMLElement): HTMLElement {
	// 如果元素不存在或不可见，返回父元素
	if (!element || element.offsetParent === null) {
		return (element.parentNode as HTMLElement) || element
	}

	// 对子节点进行倒序遍历，确保从最后一个开始查找
	for (let i = element.childNodes.length - 1; i >= 0; i -= 1) {
		const node = element.childNodes[i]

		// 如果是文本节点且有内容，返回父元素
		if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
			return element
		}

		// 如果是元素节点且可见
		if (node.nodeType === Node.ELEMENT_NODE) {
			const childElement = node as HTMLElement
			// 忽略不可见元素
			if (childElement.offsetParent !== null) {
				// 递归查找子元素
				const lastElement = findLastElement(childElement)
				if (lastElement) return lastElement
			}
		}
	}

	// 当前元素没有找到合适的文本节点，返回自身
	return element
}

// 全局光标管理，确保始终只有一个光标
export function manageCursor(cursorClassName: string): {
	clearAllCursors: () => void
	addCursorToElement: (element: HTMLElement) => void
} {
	// 清除所有现有光标
	const clearAllCursors = () => {
		document.querySelectorAll(`.${cursorClassName}`).forEach((cursor) => {
			cursor.remove()
		})
	}

	// 添加光标到指定元素
	const addCursorToElement = (element: HTMLElement) => {
		// 先清除所有现有光标
		clearAllCursors()

		// 确保元素存在后再添加光标
		if (element) {
			// 创建光标元素
			const cursorSpan = document.createElement("span")
			cursorSpan.className = cursorClassName

			// 添加到目标元素
			element.appendChild(cursorSpan)
		}
	}

	return {
		clearAllCursors,
		addCursorToElement,
	}
}
