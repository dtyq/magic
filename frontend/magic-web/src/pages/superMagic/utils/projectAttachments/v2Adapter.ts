import type { AttachmentItem } from "../../components/TopicFilesButton/hooks"
import { manualPerfLogger } from "@/utils/manualPerfLogger"
import {
	createAttachmentNodeComparator,
	flattenAttachmentTree,
	getAttachmentName,
	isRootAttachmentParent,
	normalizeAttachmentId,
	normalizeAttachmentItem,
} from "./treeUtils"

// Convert V2 BFS pages into the file panel's { tree, list } shape.
// Builder keeps mutable Maps internally; snapshot() creates a sorted UI tree.

export interface ProjectAttachmentsV2Diagnostics {
	rawRows: number
	normalizedRows: number
	hiddenFilteredCount: number
	dedupFileIdCount: number
	orphanCount: number
	adapterWarningCodes: string[]
}

export interface ProjectAttachmentsV2Snapshot {
	tree: AttachmentItem[]
	list: AttachmentItem[]
	total: number
	diagnostics: ProjectAttachmentsV2Diagnostics
}

export interface ProjectAttachmentsV2BuilderOptions {
	locale?: string
	/**
	 * Keep is_hidden files in the snapshot for path lookup (recording notes).
	 * Default false so file panels keep the original visible-only tree.
	 */
	includeHidden?: boolean
}

function isExplicitRootContainer(row: AttachmentItem) {
	// The file panel hides the root container and shows only root children.
	if (!row.is_directory || !isRootAttachmentParent(row.parent_id)) return false
	const name = getAttachmentName(row)
	return name === "" || name === "/" || row.file_type === "root"
}

function normalizeRow(row: AttachmentItem): AttachmentItem | null {
	const normalized = normalizeAttachmentItem(row)
	return normalized ? { ...normalized, children: [] } : null
}

export function createProjectAttachmentsV2Builder(
	options: ProjectAttachmentsV2BuilderOptions = {},
) {
	// nodeById stores normalized nodes; hidden rows are omitted unless includeHidden.
	// childrenByParentId stores ids only. Each snapshot rebuilds fresh tree objects.
	const nodeById = new Map<string, AttachmentItem>()
	const childrenByParentId = new Map<string, Set<string>>()
	const seenFileIds = new Set<string>()
	const adapterWarningCodes = new Set<string>()
	const comparator = createAttachmentNodeComparator(options.locale)
	let rootContainerId: string | null = null
	let rawRows = 0
	let normalizedRows = 0
	let hiddenFilteredCount = 0
	let dedupFileIdCount = 0

	function addChild(parentId: string, childId: string) {
		const children = childrenByParentId.get(parentId) || new Set<string>()
		children.add(childId)
		childrenByParentId.set(parentId, children)
	}

	function mergeBatch(rows: AttachmentItem[]) {
		const startedAt = manualPerfLogger.now()
		rawRows += rows.length

		// Filter and dedupe before tree building and path joining.
		for (const row of rows) {
			const normalized = normalizeRow(row)
			if (!normalized) continue

			const fileId = normalized.file_id as string
			if (isExplicitRootContainer(normalized)) {
				rootContainerId = fileId || null
			}

			if (normalized.is_hidden) {
				hiddenFilteredCount += 1
				// Opt-in lookup snapshots keep hidden content except the virtual root.
				if (!options.includeHidden || isExplicitRootContainer(normalized)) {
					continue
				}
			}

			if (seenFileIds.has(fileId)) {
				dedupFileIdCount += 1
				continue
			}
			seenFileIds.add(fileId)

			normalizedRows += 1
			nodeById.set(fileId, normalized)
			addChild(normalized.parent_id || "", fileId)
		}

		manualPerfLogger.recordDuration("attachments_incremental_merge_ms", startedAt, {
			batch_size: rows.length,
			normalized_rows: normalizedRows,
		})
	}

	function resolveRootIds() {
		// Parse top-level nodes in V1 shape: skip the root container when present;
		// otherwise nodes with root parent markers are top-level.
		const roots: string[] = []

		for (const node of Array.from(nodeById.values())) {
			const nodeId = node.file_id as string
			if (nodeId === rootContainerId) continue

			const parentId = normalizeAttachmentId(node.parent_id)
			if (rootContainerId && parentId === rootContainerId) {
				roots.push(nodeId)
				continue
			}

			if (isRootAttachmentParent(parentId)) {
				roots.push(nodeId)
			}
		}

		if (roots.length === 0) {
			adapterWarningCodes.add("root_unresolved")
		}

		return roots.sort((leftId, rightId) => {
			const left = nodeById.get(leftId)
			const right = nodeById.get(rightId)
			if (!left || !right) return 0
			return comparator(left, right)
		})
	}

	function buildRelativePath(node: AttachmentItem, parentPath: string) {
		// V2 no longer returns relative_file_path; rebuild V1-style paths locally.
		const name = getAttachmentName(node)
		if (!name || name === "/") return parentPath || "/"
		return `${parentPath === "/" || !parentPath ? "" : parentPath}/${name}`
	}

	function buildTreeNode(
		nodeId: string,
		parentPath: string,
		visiting: Set<string>,
	): AttachmentItem | null {
		// BFS data should not cycle; guard bad parent links from stalling tree build.
		if (visiting.has(nodeId)) {
			adapterWarningCodes.add("parent_cycle_detected")
			return null
		}

		const node = nodeById.get(nodeId)
		if (!node) return null

		visiting.add(nodeId)
		const childIds = Array.from(childrenByParentId.get(nodeId) || [])
		const children = childIds
			.map((childId) => buildTreeNode(childId, buildRelativePath(node, parentPath), visiting))
			.filter(Boolean) as AttachmentItem[]
		children.sort(comparator)
		visiting.delete(nodeId)

		const relativeFilePath = buildRelativePath(node, parentPath)
		return {
			...node,
			relative_file_path: relativeFilePath,
			children,
		}
	}

	function snapshot(): ProjectAttachmentsV2Snapshot {
		// snapshot() is a heavy boundary; call it per page/frame, not per node.
		const startedAt = manualPerfLogger.now()
		const tree = resolveRootIds()
			.map((rootId) => buildTreeNode(rootId, "", new Set<string>()))
			.filter(Boolean) as AttachmentItem[]
		tree.sort(comparator)
		const list = flattenAttachmentTree(tree)
		const hiddenRootContainerOffset = rootContainerId && nodeById.has(rootContainerId) ? 1 : 0
		const orphanCount = Math.max(0, nodeById.size - hiddenRootContainerOffset - list.length)
		if (orphanCount > 0) adapterWarningCodes.add("unexpected_orphan_after_bfs")

		manualPerfLogger.recordDuration("attachments_snapshot_build_ms", startedAt, {
			tree_count: tree.length,
			list_count: list.length,
		})

		return {
			tree,
			list,
			total: list.length,
			diagnostics: {
				rawRows,
				normalizedRows,
				hiddenFilteredCount,
				dedupFileIdCount,
				orphanCount,
				adapterWarningCodes: Array.from(adapterWarningCodes),
			},
		}
	}

	return {
		mergeBatch,
		snapshot,
		finalize: snapshot,
	}
}
