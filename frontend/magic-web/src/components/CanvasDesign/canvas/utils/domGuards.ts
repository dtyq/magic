export function isCanvasUIComponentNode(
	node: Node | null,
	options?: { stopAt?: Node | null },
): boolean {
	const stopAt = options?.stopAt ?? null
	let currentNode: Node | null = node

	while (currentNode && currentNode !== document.body) {
		if (
			currentNode instanceof Element &&
			(currentNode.hasAttribute("data-canvas-ui-component") ||
				currentNode.hasAttribute("data-mention-panel"))
		) {
			return true
		}
		if (currentNode === stopAt) {
			break
		}
		currentNode = currentNode.parentNode
	}

	return false
}
