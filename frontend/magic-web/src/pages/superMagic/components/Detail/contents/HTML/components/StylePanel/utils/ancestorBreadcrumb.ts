import { getSemanticKey, type DomTreeSemanticKey } from "../../DOMTreePanel/domTreeModel"

export const BREADCRUMB_VISIBLE_COUNT = 3
export const BREADCRUMB_TEXT_MAX = 8

export interface AncestorNode {
	selector: string
	tagName: string
	textContent?: string
	rect?: {
		top: number
		left: number
		width: number
		height: number
	}
}

export interface BreadcrumbItem extends AncestorNode {
	semanticKey: DomTreeSemanticKey
	text?: string
	isCurrent: boolean
}

export interface AncestorCrumbs {
	overflow: boolean
	hiddenAncestor?: BreadcrumbItem
	items: BreadcrumbItem[]
}

export function formatBreadcrumbText(text?: string): string | undefined {
	const collapsed = text?.replace(/\s+/g, " ").trim()
	if (!collapsed) return undefined
	const firstWord = collapsed.split(" ")[0] ?? collapsed
	return firstWord.length > BREADCRUMB_TEXT_MAX
		? firstWord.slice(0, BREADCRUMB_TEXT_MAX)
		: firstWord
}

function toBreadcrumbItem(node: AncestorNode, isCurrent: boolean): BreadcrumbItem {
	return {
		...node,
		semanticKey: getSemanticKey(node.tagName),
		text: formatBreadcrumbText(node.textContent),
		isCurrent,
	}
}

export function buildAncestorCrumbs(
	current: AncestorNode,
	ancestors: AncestorNode[],
	maxVisible = BREADCRUMB_VISIBLE_COUNT,
): AncestorCrumbs {
	const rootFirst = [...ancestors].reverse()
	const chain = [...rootFirst, current]
	const items = chain.map((node, index) => toBreadcrumbItem(node, index === chain.length - 1))
	if (items.length <= maxVisible) {
		return { overflow: false, items }
	}
	return {
		overflow: true,
		hiddenAncestor: items[items.length - maxVisible - 1],
		items: items.slice(-maxVisible),
	}
}
