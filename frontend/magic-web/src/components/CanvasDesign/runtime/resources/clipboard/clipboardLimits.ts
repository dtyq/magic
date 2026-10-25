const MAX_CLIPBOARD_ELEMENT_COUNT = 4096
const MAX_CLIPBOARD_TREE_DEPTH = 64
const MAX_CLIPBOARD_CHILDREN_PER_ELEMENT = 1024
const MAX_CLIPBOARD_FILE_METADATA_COUNT = 1024
const MAX_CLIPBOARD_CONNECTION_COUNT = 4096

export function isCanvasClipboardPayloadWithinLimits(value: {
	elements: unknown[]
	files: unknown[]
	connections?: unknown
}): boolean {
	if (value.elements.length > MAX_CLIPBOARD_ELEMENT_COUNT) return false
	if (value.files.length > MAX_CLIPBOARD_FILE_METADATA_COUNT) return false
	if (
		Array.isArray(value.connections) &&
		value.connections.length > MAX_CLIPBOARD_CONNECTION_COUNT
	) {
		return false
	}

	const stack = value.elements.map((element) => ({ element, depth: 1 }))
	let visited = 0
	while (stack.length > 0) {
		const current = stack.pop()
		if (!current || !current.element || typeof current.element !== "object") return false
		visited += 1
		if (visited > MAX_CLIPBOARD_ELEMENT_COUNT || current.depth > MAX_CLIPBOARD_TREE_DEPTH) {
			return false
		}

		const children = (current.element as { children?: unknown }).children
		if (children === undefined) continue
		if (!Array.isArray(children) || children.length > MAX_CLIPBOARD_CHILDREN_PER_ELEMENT) {
			return false
		}
		for (let index = children.length - 1; index >= 0; index -= 1) {
			stack.push({ element: children[index], depth: current.depth + 1 })
		}
	}

	return true
}
