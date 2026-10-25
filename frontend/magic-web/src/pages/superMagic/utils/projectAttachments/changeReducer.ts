import type { SuperMagicFileChangeItem } from "@/types/chat/intermediate_message"
import type { AttachmentItem } from "../../components/TopicFilesButton/hooks"
import {
	createAttachmentNodeComparator,
	getAttachmentName,
	hasDirectoryStructuralChange,
	isRootAttachmentParent,
	normalizeAttachmentId,
	normalizeAttachmentItem,
} from "./treeUtils"
import {
	createProjectAttachmentsChangeOperationCounts,
	type ProjectAttachmentsChangeOperationCounts,
	toProcessedAttachmentTree,
	toProcessedSortedAttachmentData,
	shouldReprocessDisplayConfigAfterChanges,
} from "./changeReducerUtils"

export type { ProjectAttachmentsChangeOperationCounts } from "./changeReducerUtils"

export interface ApplyProjectAttachmentsChangesResult {
	tree: AttachmentItem[]
	list: AttachmentItem[]
	appliedCount: number
	skippedCount: number
	fallbackRequired: boolean
	fallbackReason?: string
	operationCounts: ProjectAttachmentsChangeOperationCounts
}

interface AttachmentTreeIndex {
	// file_id -> node snapshot. children are cleared; links live in childIdsByParentId.
	nodeById: Map<string, AttachmentItem>
	// file_id -> parent_id for O(1) removal from old siblings.
	parentIdById: Map<string, string>
	// parent_id -> child file_id set. Set dedupes repeated update/add inserts.
	childIdsByParentId: Map<string, Set<string>>
	// Top-level nodes have no real parent; rootIds are tree entry points.
	rootIds: Set<string>
}

interface SortedAttachmentTreeData {
	tree: AttachmentItem[]
	list: AttachmentItem[]
}

/**
 * Extract and normalize the file ID from file_change messages.
 * IDs can be in change.file_id or change.file.file_id; normalize to the reducer key.
 */
function getChangeFileId(change: SuperMagicFileChangeItem) {
	return normalizeAttachmentId(change.file_id || change.file?.file_id)
}

/**
 * Extract and normalize parent_id from the file_change file payload.
 * Used for same-batch dependency ordering and reattaching nodes to parents.
 */
function getChangeParentId(change: SuperMagicFileChangeItem) {
	return normalizeAttachmentId((change.file as AttachmentItem | undefined)?.parent_id)
}

/**
 * Reorder same-batch file_change records by parent-child dependency.
 * Apply parents first to reduce parent_missing fallback from short event reordering.
 */
function orderAttachmentChangesByDependency(changes: SuperMagicFileChangeItem[]) {
	// Same-batch changes can send children before parents; sort by dependency depth.
	// Only reorder dependencies visible in this batch; cross-batch order uses retry.
	const firstIndexById = new Map<string, number>()
	changes.forEach((change, index) => {
		const fileId = getChangeFileId(change)
		if (fileId && !firstIndexById.has(fileId)) {
			// Repeated file_id entries use the first position as the stable sort base.
			firstIndexById.set(fileId, index)
		}
	})

	const depthById = new Map<string, number>()
	const resolving = new Set<string>()
	const resolveDepth = (fileId: string): number => {
		// depth is the level in this batch dependency tree: roots are 0, children +1.
		const cachedDepth = depthById.get(fileId)
		if (cachedDepth !== undefined) return cachedDepth
		// Guard cycles so one bad batch cannot stall recursive sorting.
		if (resolving.has(fileId)) return 0

		const changeIndex = firstIndexById.get(fileId)
		if (changeIndex === undefined) return 0
		const parentId = getChangeParentId(changes[changeIndex])
		resolving.add(fileId)
		const depth = parentId && firstIndexById.has(parentId) ? resolveDepth(parentId) + 1 : 0
		resolving.delete(fileId)
		depthById.set(fileId, depth)
		return depth
	}

	return (
		changes
			.map((change, index) => ({
				change,
				index,
				depth: resolveDepth(getChangeFileId(change)),
			}))
			// Shallower parents apply first; same depth keeps original order.
			.sort((left, right) => left.depth - right.depth || left.index - right.index)
			.map((item) => item.change)
	)
}

/**
 * Join an attachment relative path.
 * Handles empty parent paths or names without extra slashes.
 */
function joinAttachmentPath(parentPath: string, name: string) {
	if (!parentPath) return name
	if (!name) return parentPath
	return `${parentPath}/${name}`
}

/**
 * Resolve a node's current relative_file_path from the index.
 * If missing, derive it from the parent chain for directory move/rename rewrites.
 */
function resolveIndexedNodePath(index: AttachmentTreeIndex, fileId: string): string {
	// Some old data lacks relative_file_path; derive it through parents for rewrites.
	// Example: name=bar with parent=foo resolves to foo/bar.
	const node = index.nodeById.get(fileId)
	if (!node) return ""
	if (node.relative_file_path) return node.relative_file_path

	const name = getAttachmentName(node)
	const parentId = index.parentIdById.get(fileId)
	if (!parentId || isRootAttachmentParent(parentId)) return name

	return joinAttachmentPath(resolveIndexedNodePath(index, parentId), name)
}

/**
 * Check whether candidateId is a descendant of ancestorId.
 * Prevents moving a directory under its own descendant.
 */
function isIndexedDescendant(index: AttachmentTreeIndex, ancestorId: string, candidateId: string) {
	// Walk candidate upward through parentId to find ancestor.
	let currentId = candidateId
	const visited = new Set<string>()
	while (currentId && !isRootAttachmentParent(currentId)) {
		if (currentId === ancestorId) return true
		if (visited.has(currentId)) return false
		visited.add(currentId)
		currentId = index.parentIdById.get(currentId) || ""
	}
	return false
}

/**
 * Move parent-child references in the index.
 * Only changes relationships; node content is replaced by the caller.
 */
function moveIndexedNodeReference(index: AttachmentTreeIndex, fileId: string, parentId: string) {
	// Move only relationship indexes; updateIndexedDirectoryNode replaces node content.
	removeChildReference(index, fileId)
	index.parentIdById.set(fileId, parentId)

	if (isRootAttachmentParent(parentId)) {
		index.rootIds.add(fileId)
		return
	}

	const siblings = index.childIdsByParentId.get(parentId) || new Set<string>()
	siblings.add(fileId)
	index.childIdsByParentId.set(parentId, siblings)
}

/**
 * Rewrite relative_file_path for all descendants of a directory.
 * After rename/move, parent_id may stay unchanged while display/open paths must update.
 */
function updateIndexedSubtreePaths(
	index: AttachmentTreeIndex,
	rootId: string,
	oldBasePath: string,
	newBasePath: string,
) {
	// Descendant parent_id stays stable, but relative_file_path must follow the new path.
	// Use an iterative stack to avoid call-stack risk on deep directories.
	const stack = Array.from(index.childIdsByParentId.get(rootId) || []).map((childId) => ({
		fileId: childId,
		oldParentPath: oldBasePath,
		newParentPath: newBasePath,
	}))

	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) continue

		const node = index.nodeById.get(current.fileId)
		if (!node) continue

		const name = getAttachmentName(node)
		const currentOldPath =
			node.relative_file_path || joinAttachmentPath(current.oldParentPath, name)
		let currentNewPath = joinAttachmentPath(current.newParentPath, name)

		// Replace the old prefix when possible to preserve the full suffix path.
		// Otherwise fall back to new parent path + node name so old data converges.
		if (
			oldBasePath &&
			newBasePath &&
			(currentOldPath === oldBasePath || currentOldPath.startsWith(`${oldBasePath}/`))
		) {
			const suffix =
				currentOldPath === oldBasePath ? "" : currentOldPath.slice(oldBasePath.length + 1)
			currentNewPath = suffix ? `${newBasePath}/${suffix}` : newBasePath
		}

		index.nodeById.set(current.fileId, {
			...node,
			relative_file_path: currentNewPath,
		})

		const childIds = index.childIdsByParentId.get(current.fileId)
		childIds?.forEach((childId) => {
			stack.push({
				fileId: childId,
				oldParentPath: currentOldPath,
				newParentPath: currentNewPath,
			})
		})
	}
}

/**
 * Incrementally update a directory node and rewrite move/rename subtree paths.
 * false means the caller should fallback to a full refresh.
 */
function updateIndexedDirectoryNode(
	index: AttachmentTreeIndex,
	parentId: string,
	node: AttachmentItem,
) {
	const fileId = node.file_id as string
	// Disallow moving a directory under its descendant; that would cycle the index.
	if (!isRootAttachmentParent(parentId) && isIndexedDescendant(index, fileId, parentId)) {
		return false
	}

	const directoryName = getAttachmentName(node)
	const parentPath = isRootAttachmentParent(parentId)
		? ""
		: resolveIndexedNodePath(index, parentId)
	// The server may send the new path; otherwise derive it from parent path + name.
	const newBasePath = node.relative_file_path || joinAttachmentPath(parentPath, directoryName)
	if (!newBasePath && directoryName) return false

	const oldBasePath = resolveIndexedNodePath(index, fileId)
	// Move the directory relationship first so subtree traversal uses the new index.
	moveIndexedNodeReference(index, fileId, parentId)
	index.nodeById.set(fileId, { ...node, relative_file_path: newBasePath, children: [] })
	if (!index.childIdsByParentId.has(fileId)) {
		index.childIdsByParentId.set(fileId, new Set())
	}
	updateIndexedSubtreePaths(index, fileId, oldBasePath, newBasePath)
	return true
}

function createAttachmentTreeIndex(tree: AttachmentItem[]): AttachmentTreeIndex {
	const index: AttachmentTreeIndex = {
		nodeById: new Map(),
		parentIdById: new Map(),
		childIdsByParentId: new Map(),
		rootIds: new Set(),
	}

	const addExistingNode = (item: AttachmentItem, parentId: string | null) => {
		// Normalize API shapes during indexing so apply only sees AttachmentItem.
		const normalized = normalizeAttachmentItem(item)
		if (!normalized || normalized.is_hidden) return

		const fileId = normalized.file_id as string
		// If the current tree already has duplicates, keep the first to avoid relation churn.
		if (index.nodeById.has(fileId)) return

		// nodeById omits children so subtree state lives only in relationship indexes.
		index.nodeById.set(fileId, { ...normalized, children: [] })
		index.parentIdById.set(fileId, parentId ?? normalizeAttachmentId(normalized.parent_id))
		index.childIdsByParentId.set(fileId, new Set())

		if (parentId === null) {
			index.rootIds.add(fileId)
		} else {
			const siblings = index.childIdsByParentId.get(parentId) || new Set<string>()
			siblings.add(fileId)
			index.childIdsByParentId.set(parentId, siblings)
		}

		for (const child of normalized.children || []) {
			addExistingNode(child, fileId)
		}
	}

	for (const item of tree) {
		addExistingNode(item, null)
	}

	return index
}

function removeChildReference(index: AttachmentTreeIndex, fileId: string) {
	// Remove the parent link before deleting the node to avoid dangling child ids.
	index.rootIds.delete(fileId)
	const parentId = index.parentIdById.get(fileId)
	if (!parentId || isRootAttachmentParent(parentId)) return
	index.childIdsByParentId.get(parentId)?.delete(fileId)
}

function removeIndexedSubtree(index: AttachmentTreeIndex, fileId: string) {
	const removed = index.nodeById.get(fileId) || null
	if (!removed) return null

	removeChildReference(index, fileId)

	// Delete directories with descendants; use a stack to avoid deep recursion.
	const stack = [fileId]
	while (stack.length > 0) {
		const currentId = stack.pop()
		if (!currentId) continue

		const childIds = index.childIdsByParentId.get(currentId)
		if (childIds?.size) {
			childIds.forEach((childId) => {
				stack.push(childId)
			})
		}

		index.nodeById.delete(currentId)
		index.parentIdById.delete(currentId)
		index.childIdsByParentId.delete(currentId)
	}

	return removed
}

function insertIndexedNode(index: AttachmentTreeIndex, parentId: string, node: AttachmentItem) {
	// New files may include children; expand them into index relationships.
	const normalized = normalizeAttachmentItem(node)
	if (!normalized || normalized.is_hidden) return

	const fileId = normalized.file_id as string
	index.nodeById.set(fileId, { ...normalized, children: [] })
	index.parentIdById.set(fileId, parentId)
	if (!index.childIdsByParentId.has(fileId)) {
		index.childIdsByParentId.set(fileId, new Set())
	}

	if (isRootAttachmentParent(parentId)) {
		index.rootIds.add(fileId)
	} else {
		const siblings = index.childIdsByParentId.get(parentId) || new Set<string>()
		siblings.add(fileId)
		index.childIdsByParentId.set(parentId, siblings)
	}

	for (const child of normalized.children || []) {
		const childNode = normalizeAttachmentItem(child)
		if (!childNode) continue
		insertIndexedNode(index, fileId, childNode)
	}
}

function buildSortedTreeDataFromIndex(
	index: AttachmentTreeIndex,
	locale?: string,
): SortedAttachmentTreeData {
	const comparator = createAttachmentNodeComparator(locale)
	// Build list during tree DFS to avoid an extra flatten pass.
	const list: AttachmentItem[] = []
	const visiting = new Set<string>()
	// The index has no display order; sort once before commit.
	const sortIds = (ids: string[]) =>
		ids.sort((leftId, rightId) => {
			const left = index.nodeById.get(leftId)
			const right = index.nodeById.get(rightId)
			if (!left || !right) return 0
			return comparator(left, right)
		})

	const buildNode = (fileId: string): AttachmentItem | null => {
		// Normal data is acyclic; guard abnormal parent links from stalling tree build.
		if (visiting.has(fileId)) return null

		const node = index.nodeById.get(fileId)
		if (!node || node.is_hidden) return null

		visiting.add(fileId)
		// Recreate node objects so MobX/React see new tree refs and snapshots stay clean.
		const nextNode: AttachmentItem = { ...node, children: [] }
		list.push(nextNode)

		const children: AttachmentItem[] = []
		const childIds = sortIds(Array.from(index.childIdsByParentId.get(fileId) || []))
		for (const childId of childIds) {
			const child = buildNode(childId)
			if (child) children.push(child)
		}
		nextNode.children = children
		visiting.delete(fileId)

		return nextNode
	}

	const tree: AttachmentItem[] = []
	for (const fileId of sortIds(Array.from(index.rootIds))) {
		const root = buildNode(fileId)
		if (root) tree.push(root)
	}

	return { tree, list }
}

export function applyProjectAttachmentsChangesToTree(
	currentTree: AttachmentItem[],
	changes: SuperMagicFileChangeItem[],
	options: { locale?: string } = {},
): ApplyProjectAttachmentsChangesResult {
	// Hot WS apply path: build one index, then batch-apply changes.
	const treeIndex = createAttachmentTreeIndex(currentTree)
	let appliedCount = 0
	let skippedCount = 0
	let fallbackRequired = false
	let fallbackReason: string | undefined
	const operationCounts = createProjectAttachmentsChangeOperationCounts()

	const markFallback = (reason: string) => {
		// Record only the first fallback reason for easier diagnosis.
		fallbackRequired = true
		fallbackReason = fallbackReason || reason
	}

	const orderedChanges = orderAttachmentChangesByDependency(changes)

	for (const change of orderedChanges) {
		const operation = change.operation
		const fileId = getChangeFileId(change)

		if (operation === "add") operationCounts.add += 1
		else if (operation === "delete") operationCounts.delete += 1
		else if (operation === "update") operationCounts.update += 1
		else operationCounts.unknown += 1

		if (!fileId) {
			// Without file_id, incremental apply cannot locate the node; refresh fully.
			skippedCount += 1
			markFallback("missing_file_id")
			break
		}

		if (operation === "delete") {
			// Deletes may omit file payload; a missing node still counts as consumed.
			removeIndexedSubtree(treeIndex, fileId)
			appliedCount += 1
			continue
		}

		if (operation !== "add" && operation !== "update") {
			skippedCount += 1
			markFallback("unknown_operation")
			break
		}

		if (!change.file) {
			// add/update require full file payload for name, parent, type, and display fields.
			skippedCount += 1
			markFallback("missing_file_payload")
			break
		}

		const incoming = normalizeAttachmentItem(change.file as AttachmentItem)
		if (!incoming) {
			skippedCount += 1
			markFallback("invalid_file_payload")
			break
		}

		if (incoming.is_hidden) {
			// hidden means not shown; remove the existing subtree if present.
			removeIndexedSubtree(treeIndex, fileId)
			appliedCount += 1
			continue
		}

		let parentId = normalizeAttachmentId(incoming.parent_id)
		if (
			parentId &&
			!isRootAttachmentParent(parentId) &&
			!treeIndex.nodeById.has(parentId) &&
			Array.from(treeIndex.rootIds).some(
				(rootId) =>
					normalizeAttachmentId(treeIndex.nodeById.get(rootId)?.parent_id) === parentId,
			)
		) {
			parentId = ""
		}
		if (Array.from(treeIndex.nodeById).length === 0) {
			parentId = ""
		}
		if (!isRootAttachmentParent(parentId) && !treeIndex.nodeById.has(parentId)) {
			// Missing parent would create an orphan node, so use full refresh.
			skippedCount += 1
			markFallback("parent_missing")
			break
		}

		const existing = treeIndex.nodeById.get(fileId) || null
		const hasDirectoryChange = Boolean(
			existing?.is_directory &&
			incoming.is_directory &&
			hasDirectoryStructuralChange(existing, incoming),
		)

		// Preserve children indexes for non-structural directory field updates.
		if (existing?.is_directory && incoming.is_directory) {
			const updated = updateIndexedDirectoryNode(treeIndex, parentId, incoming)
			if (!updated) {
				skippedCount += 1
				markFallback(
					hasDirectoryChange
						? "directory_structural_update_unresolvable"
						: "directory_update_unresolvable",
				)
				break
			}
		} else {
			// File updates, duplicate adds, and type changes use delete-then-add.
			removeIndexedSubtree(treeIndex, fileId)
			insertIndexedNode(treeIndex, parentId, incoming)
		}
		appliedCount += 1
	}

	if (fallbackRequired) {
		// On fallback, skip partial commits and wait for the caller's full refresh.
		const current = toProcessedAttachmentTree(currentTree, options.locale)
		return {
			...current,
			appliedCount,
			skippedCount,
			fallbackRequired,
			fallbackReason,
			operationCounts,
		}
	}

	const sortedData = buildSortedTreeDataFromIndex(treeIndex, options.locale)
	const shouldReprocessDisplayConfig = shouldReprocessDisplayConfigAfterChanges(changes)
	const processed = shouldReprocessDisplayConfig
		? toProcessedSortedAttachmentData(sortedData.tree, sortedData.list)
		: sortedData
	return {
		...processed,
		appliedCount,
		skippedCount,
		fallbackRequired,
		fallbackReason,
		operationCounts,
	}
}
