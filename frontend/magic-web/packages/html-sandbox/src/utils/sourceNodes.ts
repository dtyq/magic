/** Only nodes parsed from the saved HTML source may be edited directly. */
export const SOURCE_NODE_ATTRIBUTE = "data-magic-source-node"

export function markSourceNodes(doc: Document): void {
	// Mark before user scripts run; generated descendants will have no provenance marker.
	doc.querySelectorAll("*").forEach((element) => {
		element.setAttribute(SOURCE_NODE_ATTRIBUTE, "")
	})
}

/** Mark one editor-owned node without changing the provenance of its descendants. */
export function markSourceNode(element: Element): void {
	element.setAttribute(SOURCE_NODE_ATTRIBUTE, "")
}

/** Mark a newly created editor-owned subtree as persistable source content. */
export function markSourceSubtree(element: Element): void {
	markSourceNode(element)
	element.querySelectorAll("*").forEach((child) => {
		markSourceNode(child)
	})
}

export function removeRuntimeNodes(doc: Document): void {
	if (!doc.documentElement.hasAttribute(SOURCE_NODE_ATTRIBUTE)) return
	// Never serialize DOM created by scripts: rerunning those scripts would create it again.
	doc.querySelectorAll("*").forEach((element) => {
		if (!element.hasAttribute(SOURCE_NODE_ATTRIBUTE)) element.remove()
	})
}

export function isSourceNode(element: Element): boolean {
	const root = element.ownerDocument.documentElement
	// Standalone sandbox consumers that do not use getFullContent retain their old behavior.
	if (!root.hasAttribute(SOURCE_NODE_ATTRIBUTE)) return true
	for (
		let current: Element | null = element;
		current && current !== root;
		current = current.parentElement
	) {
		if (!current.hasAttribute(SOURCE_NODE_ATTRIBUTE)) return false
	}
	return true
}
