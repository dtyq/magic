import { getElementSelector, isInjectedElement } from "../utils/dom"
import { isSourceNode, markSourceSubtree, SOURCE_NODE_ATTRIBUTE } from "../utils/sourceNodes"
import { EditorLogger } from "../utils/EditorLogger"

export const EDITOR_NODE_ID_ATTRIBUTE = "data-magic-editor-node-id"

export interface DuplicatedIdMapping {
	originalId: string
	duplicatedId: string
}

const EXCLUDED_TAGS = new Set([
	"head",
	"script",
	"style",
	"link",
	"meta",
	"title",
	"template",
	"noscript",
])

const VOID_TAGS = new Set([
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr",
])

export interface DomTreeNode {
	nodeId: string
	selector: string
	tagName: string
	label: string
	textContent?: string
	resource?: string
	/** Resolved image source used for the lightweight DOM-tree thumbnail. */
	thumbnailUrl?: string
	children: DomTreeNode[]
	/** Whether the canvas can select this node. Root nodes remain selectable. */
	canSelect?: boolean
	editable: boolean
	canHaveChildren: boolean
	canDelete: boolean
	canMove: boolean
	disabledReason?: string
	dynamicWarning?: string
}

let nextNodeId = 1

function createUniqueDuplicateId(originalId: string, usedIds: Set<string>): string {
	const base = `${originalId}-copy`
	let candidate = base
	let suffix = 2
	while (usedIds.has(candidate)) candidate = `${base}-${suffix++}`
	usedIds.add(candidate)
	return candidate
}

/**
 * Give cloned elements unique HTML ids while preserving the source markup.
 * This is used by duplicate and paste commands so selectors never resolve to
 * the original and duplicated element at the same time.
 */
export function assignUniqueIdsToClone(
	clone: HTMLElement,
	forcedMappings?: DuplicatedIdMapping[],
): DuplicatedIdMapping[] {
	const usedIds = new Set(
		Array.from(document.querySelectorAll<HTMLElement>("[id]"))
			.map((element) => element.id)
			.filter(Boolean),
	)
	const mappingByOriginalId = new Map(
		(forcedMappings ?? []).map((mapping) => [mapping.originalId, mapping]),
	)
	const clonedElements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))]

	return clonedElements.reduce<DuplicatedIdMapping[]>((result, element) => {
		const originalId = element.id
		if (!originalId) return result

		const forcedMapping = mappingByOriginalId.get(originalId)
		const duplicatedId =
			forcedMapping && !usedIds.has(forcedMapping.duplicatedId)
				? forcedMapping.duplicatedId
				: createUniqueDuplicateId(originalId, usedIds)
		element.id = duplicatedId
		result.push({ originalId, duplicatedId })
		return result
	}, [])
}

function getNodeId(element: HTMLElement): string {
	const existing = element.getAttribute(EDITOR_NODE_ID_ATTRIBUTE)
	if (existing) return existing

	const nodeId = `node-${nextNodeId++}`
	element.setAttribute(EDITOR_NODE_ID_ATTRIBUTE, nodeId)
	return nodeId
}

/** Reuse session-only DOM identities so build rows survive style changes and moves. */
export function getEditorNodeSelector(element: HTMLElement): string {
	return `[${EDITOR_NODE_ID_ATTRIBUTE}="${CSS.escape(getNodeId(element))}"]`
}

export function resetEditorNodeIds(root: Element): void {
	if (root instanceof HTMLElement) root.removeAttribute(EDITOR_NODE_ID_ATTRIBUTE)
	root.querySelectorAll(`[${EDITOR_NODE_ID_ATTRIBUTE}]`).forEach((element) => {
		element.removeAttribute(EDITOR_NODE_ID_ATTRIBUTE)
	})
}

/** Assign fresh session-only identifiers to a newly inserted subtree. */
export function assignEditorNodeIds(root: HTMLElement): void {
	getNodeId(root)
	root.querySelectorAll<HTMLElement>("*").forEach((element) => getNodeId(element))
}

function getResource(element: HTMLElement): string | undefined {
	const value =
		element.getAttribute("data-original-path") ||
		element.getAttribute("src") ||
		element.getAttribute("href") ||
		element.getAttribute("poster") ||
		element.getAttribute("data-src")
	return value?.trim() || undefined
}

function resolveThumbnailUrl(value: string | null | undefined): string | undefined {
	const raw = value?.trim()
	if (!raw || raw.startsWith("#")) return undefined
	if (raw.startsWith("data:")) return raw

	try {
		return new URL(raw, document.baseURI).href
	} catch {
		return raw
	}
}

function getBackgroundImageUrl(value: string | undefined): string | undefined {
	if (!value || value === "none") return undefined
	const match = value.match(/url\(\s*(?:"([\s\S]*?)"|'([\s\S]*?)'|([^)]*?))\s*\)/i)
	return resolveThumbnailUrl(match?.[1] || match?.[2] || match?.[3])
}

function getInlineBackgroundValues(styleAttribute: string | null): string[] {
	if (!styleAttribute) return []

	return Array.from(
		styleAttribute.matchAll(/(?:^|;)\s*background(?:-image)?\s*:\s*([^;]+)/gi),
		(match) => match[1],
	)
}

/** Prefer the element's own visual source before inheriting one from children. */
function getDirectThumbnailUrl(element: HTMLElement): string | undefined {
	const tagName = element.tagName.toLowerCase()
	if (tagName === "img") {
		const image = element as HTMLImageElement
		return resolveThumbnailUrl(image.currentSrc || element.getAttribute("src") || image.src)
	}
	if (tagName === "source") {
		const source = element as HTMLSourceElement
		return resolveThumbnailUrl(source.src || element.getAttribute("src"))
	}

	const computedStyle = window.getComputedStyle(element)
	const backgroundCandidates = [
		element.style.backgroundImage,
		element.style.background,
		computedStyle.backgroundImage,
		computedStyle.background,
	]

	for (const candidate of backgroundCandidates) {
		const thumbnailUrl = getBackgroundImageUrl(candidate)
		if (thumbnailUrl) return thumbnailUrl
	}

	// Some DOM emulators do not expose shorthand values through CSSOM. Keep
	// the raw fallback limited to actual background declarations so unrelated
	// URL-bearing properties such as mask-image are not treated as thumbnails.
	for (const candidate of getInlineBackgroundValues(element.getAttribute("style")).reverse()) {
		const thumbnailUrl = getBackgroundImageUrl(candidate)
		if (thumbnailUrl) return thumbnailUrl
	}

	return undefined
}

function getLabel(element: HTMLElement): string {
	const tagName = element.tagName.toLowerCase()
	const id = element.id ? `#${element.id}` : ""
	const className = element.classList[0] ? `.${element.classList[0]}` : ""
	return `${tagName}${id}${className}`
}

function hasDynamicMarker(element: HTMLElement): boolean {
	return Array.from(element.attributes).some(({ name }) => {
		return (
			name.startsWith("data-react") ||
			name.startsWith("data-v-") ||
			name === "ng-version" ||
			name.startsWith("ng-")
		)
	})
}

function collectIdCounts(): Map<string, number> {
	const counts = new Map<string, number>()
	document.querySelectorAll<HTMLElement>("[id]").forEach((element) => {
		if (element.id) counts.set(element.id, (counts.get(element.id) ?? 0) + 1)
	})
	return counts
}

function getVisibleElementChildren(element: HTMLElement): HTMLElement[] {
	return Array.from(element.children)
		.filter((child): child is HTMLElement => child instanceof HTMLElement)
		.filter(
			(child) =>
				!isInjectedElement(child) &&
				isSourceNode(child) &&
				!EXCLUDED_TAGS.has(child.tagName.toLowerCase()),
		)
}

/**
 * Return text authored directly by the element.
 *
 * Do not aggregate descendant text here: every descendant already has its own
 * tree row. Reading only direct text keeps container summaries useful without
 * repeating the same content at every ancestor, and preserves mixed content
 * such as `<div>prefix <strong>emphasis</strong> suffix</div>`.
 */
function getDirectTextContent(element: HTMLElement): string | undefined {
	const parts: string[] = []
	element.childNodes.forEach((node) => {
		if (node.nodeType === Node.TEXT_NODE && node.textContent) parts.push(node.textContent)
	})
	return parts.join(" ").trim().replace(/\s+/g, " ").slice(0, 80) || undefined
}

function describeNode(
	element: HTMLElement,
	isRoot: boolean,
	idCounts: ReadonlyMap<string, number>,
) {
	const tagName = element.tagName.toLowerCase()
	const selector = getElementSelector(element)
	const isExcluded =
		isInjectedElement(element) || !isSourceNode(element) || EXCLUDED_TAGS.has(tagName)
	// The selector path is rooted at body and disambiguates same-tag siblings
	// with :nth-of-type(). Only duplicate ids can make that path ambiguous, so
	// count ids once per snapshot instead of querying the whole document per node.
	const selectorIsUnique = Boolean(selector) && (!element.id || idCounts.get(element.id) === 1)
	const canHaveChildren = !VOID_TAGS.has(tagName)
	const isRootElement =
		isRoot || element === document.documentElement || element === document.body

	let disabledReason: string | undefined
	if (isExcluded) disabledReason = "运行时或非可视节点"
	else if (isRootElement) disabledReason = "根节点不可移动或删除"
	else if (!selectorIsUnique) disabledReason = "节点定位不唯一"
	return {
		selector,
		tagName,
		label: getLabel(element),
		// Keep direct text visible even when this node also contains child elements.
		// Descendant text is rendered by the corresponding child rows.
		textContent: getDirectTextContent(element),
		resource: getResource(element),
		thumbnailUrl: getDirectThumbnailUrl(element),
		canSelect: !isExcluded && selectorIsUnique,
		editable: !disabledReason,
		canHaveChildren,
		canDelete: !disabledReason && !isRootElement,
		canMove: !disabledReason && !isRootElement,
		disabledReason,
		dynamicWarning: hasDynamicMarker(element)
			? "该节点可能由脚本重新渲染，修改后可能被覆盖"
			: undefined,
	}
}

function buildNode(element: HTMLElement, isRoot = false): DomTreeNode {
	const idCounts = collectIdCounts()
	const root: DomTreeNode = {
		nodeId: getNodeId(element),
		...describeNode(element, isRoot, idCounts),
		children: [],
	}
	const stack: Array<{ element: HTMLElement; node: DomTreeNode }> = [{ element, node: root }]

	// The HTML editor can receive generated documents with very deep wrapper
	// nesting. Iterative DFS avoids exhausting the iframe call stack while
	// preserving the same document order as the previous recursive traversal.
	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) continue
		const children = getVisibleElementChildren(current.element)
		const childNodes = children.map((child) => ({
			node: {
				nodeId: getNodeId(child),
				...describeNode(child, false, idCounts),
				children: [],
			} satisfies DomTreeNode,
			element: child,
		}))
		current.node.children.push(...childNodes.map(({ node }) => node))
		for (let index = childNodes.length - 1; index >= 0; index -= 1) {
			stack.push(childNodes[index])
		}
	}
	return root
}

export function buildDomTree(): { root: DomTreeNode } {
	if (!document.body) {
		throw new Error("HTML document body is unavailable")
	}

	return { root: buildNode(document.body, true) }
}

export function findNodeById(nodeId: string): HTMLElement {
	const element = Array.from(document.querySelectorAll(`[${EDITOR_NODE_ID_ATTRIBUTE}]`)).find(
		(candidate) => candidate.getAttribute(EDITOR_NODE_ID_ATTRIBUTE) === nodeId,
	)
	if (!(element instanceof HTMLElement)) {
		throw new Error(`DOM node not found: ${nodeId}`)
	}
	return element
}

export function ensureEditableNode(element: HTMLElement, action: string): void {
	const info = describeNode(element, false, collectIdCounts())
	if (!info.editable) {
		throw new Error(info.disabledReason || `节点不支持${action}`)
	}
}

export function insertAtElementIndex(
	parent: HTMLElement,
	child: HTMLElement,
	index?: number,
): number {
	// Parsed editor content has no marker; moving an existing source node must retain
	// unmarked runtime descendants instead of promoting them to saved content.
	if (!child.hasAttribute(SOURCE_NODE_ATTRIBUTE)) markSourceSubtree(child)
	const children = Array.from(parent.children)
	const targetIndex = Math.max(0, Math.min(index ?? children.length, children.length))
	const reference = children[targetIndex]
	if (reference) parent.insertBefore(child, reference)
	else parent.appendChild(child)
	return Array.from(parent.children).indexOf(child)
}

export function logDomTreeError(message: string, error: unknown): void {
	EditorLogger.error(`[DOMTree] ${message}`, error)
}
