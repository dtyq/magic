import type { TFunction } from "i18next"
import type { DomTreeNode } from "../../iframe-bridge/types/messages"

export const DOM_TREE_INDENT_STEP = 16
export const DOM_TREE_VIRTUAL_THRESHOLD = 100
export const DOM_TREE_ROW_HEIGHT = 32
export const DOM_TREE_VIRTUAL_OVERSCAN = 4
export const DOM_TREE_VIRTUAL_INITIAL_RECT = { width: 360, height: 320 }

export function estimateDomTreeRowSize(): number {
	return DOM_TREE_ROW_HEIGHT
}

export type DropPosition = "before" | "inside" | "after"
export type InsertPlacement = "before" | "inside" | "after"
export type DomTreeSemanticKey =
	| "code"
	| "container"
	| "control"
	| "disclosure"
	| "divider"
	| "element"
	| "embed"
	| "form"
	| "heading"
	| "heading1"
	| "heading2"
	| "heading3"
	| "heading4"
	| "heading5"
	| "heading6"
	| "image"
	| "lineBreak"
	| "link"
	| "list"
	| "media"
	| "quote"
	| "table"
	| "text"

export interface TextInsertRequest {
	parentNodeId: string
	index?: number
	targetLabel: string
	placement: InsertPlacement
}

export interface DeleteRequest {
	selector: string
	targetLabel: string
}

export interface VisibleDomTreeRow {
	nodeId: string
	depth: number
}

export interface DomTreeIndex {
	nodeMap: Map<string, DomTreeNode>
	parentMap: Map<string, DomTreeNode>
	nodeIdBySelector: Map<string, string>
}

export function getDomTreeNodeDisplayLabel(node: DomTreeNode, semanticLabel: string): string {
	return node.textContent ? `${semanticLabel} · ${node.textContent}` : semanticLabel
}

export function getDomTreeSemanticLabel(t: TFunction, semanticKey: DomTreeSemanticKey): string {
	return t(`stylePanel.domTree.semantic.${semanticKey}`)
}

export function getTextInsertPlacementLabel(t: TFunction, placement: InsertPlacement): string {
	switch (placement) {
		case "before":
			return t("stylePanel.domTree.addTextDialog.placements.before")
		case "inside":
			return t("stylePanel.domTree.addTextDialog.placements.inside")
		case "after":
			return t("stylePanel.domTree.addTextDialog.placements.after")
	}
}

export function collectNodeIds(root: DomTreeNode): Set<string> {
	const result = new Set<string>()
	const stack = [root]

	while (stack.length > 0) {
		const node = stack.pop()
		if (!node) continue
		result.add(node.nodeId)
		for (let index = node.children.length - 1; index >= 0; index -= 1) {
			stack.push(node.children[index])
		}
	}

	return result
}

export function collectVisibleNodeRows(
	root: DomTreeNode,
	expanded: Set<string>,
): VisibleDomTreeRow[] {
	const result: VisibleDomTreeRow[] = []
	const stack: Array<{ node: DomTreeNode; depth: number }> = [{ node: root, depth: 0 }]

	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) continue
		result.push({ nodeId: current.node.nodeId, depth: current.depth })
		if (!expanded.has(current.node.nodeId)) continue
		for (let index = current.node.children.length - 1; index >= 0; index -= 1) {
			stack.push({ node: current.node.children[index], depth: current.depth + 1 })
		}
	}

	return result
}

export function buildDomTreeIndex(treeRoot?: DomTreeNode): DomTreeIndex {
	const nodeMap = new Map<string, DomTreeNode>()
	const parentMap = new Map<string, DomTreeNode>()
	const nodeIdBySelector = new Map<string, string>()
	if (!treeRoot) return { nodeMap, parentMap, nodeIdBySelector }

	const stack: Array<{ node: DomTreeNode; parent?: DomTreeNode }> = [{ node: treeRoot }]
	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) continue
		const { node, parent } = current
		nodeMap.set(node.nodeId, node)
		if (parent) parentMap.set(node.nodeId, parent)
		if (node.selector) nodeIdBySelector.set(node.selector, node.nodeId)
		for (let index = node.children.length - 1; index >= 0; index -= 1) {
			stack.push({ node: node.children[index], parent: node })
		}
	}

	return { nodeMap, parentMap, nodeIdBySelector }
}

export function getSemanticKey(tagName: string): DomTreeSemanticKey {
	const tag = tagName.toLowerCase()
	if (["br", "wbr"].includes(tag)) return "lineBreak"
	if (tag === "hr") return "divider"
	if (["img", "picture", "source"].includes(tag)) return "image"
	if (
		[
			"input",
			"button",
			"select",
			"textarea",
			"option",
			"optgroup",
			"output",
			"progress",
			"meter",
		].includes(tag)
	)
		return "control"
	if (["video", "audio", "canvas", "svg"].includes(tag)) return "media"
	if (["iframe", "object", "embed"].includes(tag)) return "embed"
	if (["a", "area"].includes(tag)) return "link"
	if (["blockquote", "q", "cite"].includes(tag)) return "quote"
	if (["code", "pre", "kbd", "samp", "var"].includes(tag)) return "code"
	if (["details", "summary"].includes(tag)) return "disclosure"
	if (
		["p", "span", "strong", "em", "b", "i", "u", "small", "mark", "del", "ins", "s"].includes(
			tag,
		)
	)
		return "text"
	if (tag === "h1") return "heading1"
	if (tag === "h2") return "heading2"
	if (tag === "h3") return "heading3"
	if (tag === "h4") return "heading4"
	if (tag === "h5") return "heading5"
	if (tag === "h6") return "heading6"
	if (["ul", "ol", "li", "dl", "dt", "dd"].includes(tag)) return "list"
	if (["table", "thead", "tbody", "tr", "th", "td"].includes(tag)) return "table"
	if (["form", "fieldset", "legend"].includes(tag)) return "form"
	if (
		[
			"html",
			"body",
			"main",
			"section",
			"article",
			"header",
			"footer",
			"nav",
			"aside",
			"div",
			"figure",
			"figcaption",
		].includes(tag)
	)
		return "container"
	return "element"
}

export function getSemanticTone(semanticKey: string): string {
	switch (semanticKey) {
		case "container":
			return "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
		case "text":
		case "heading":
		case "heading1":
		case "heading2":
		case "heading3":
		case "heading4":
		case "heading5":
		case "heading6":
		case "link":
		case "quote":
		case "code":
			return "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300"
		case "image":
		case "media":
			return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
		case "control":
		case "form":
		case "disclosure":
			return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
		case "list":
		case "table":
		case "divider":
			return "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300"
		case "lineBreak":
			return "border-slate-500/25 bg-slate-500/10 text-slate-700 dark:text-slate-300"
		case "embed":
			return "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
		default:
			return "border-border/70 bg-muted/55 text-foreground/80"
	}
}

export function isSelectableNode(node: DomTreeNode): boolean {
	if (node.canSelect !== undefined) return node.canSelect
	return (
		node.editable ||
		node.disabledReason === "根节点不可移动或删除" ||
		["html", "body"].includes(node.tagName.toLowerCase())
	)
}
