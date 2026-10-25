import type { AttachmentItem } from "../../components/TopicFilesButton/hooks"
import { isMagicSystemFolder } from "../../components/TopicFilesButton/utils/magic-system-folder"

// Root parent_id has several legacy forms; normalize it across V1/V2/WS.
export const ROOT_PARENT_MARKERS = new Set(["", "0", "918559425666367489"])

export function normalizeAttachmentId(value: unknown): string {
	if (value === null || value === undefined) return ""
	return String(value)
}

export function normalizeAttachmentObjectConfig(value: unknown) {
	// In V1/V2/WS, display_config/metadata may be objects or JSON strings.
	if (typeof value !== "string") return value ?? null
	try {
		return JSON.parse(value)
	} catch (_error) {
		return null
	}
}

export function getAttachmentName(item: AttachmentItem) {
	return item.file_name || item.filename || item.display_filename || item.name || ""
}

export function isRootAttachmentParent(parentId: unknown) {
	return ROOT_PARENT_MARKERS.has(normalizeAttachmentId(parentId))
}

export function normalizeAttachmentItem(file: AttachmentItem): AttachmentItem | null {
	// V1/V2/WS shapes differ; normalize to one stable AttachmentItem shape.
	const fileId = normalizeAttachmentId(file.file_id)
	if (!fileId) return null

	const isDirectory = Boolean(file.is_directory)
	const name = getAttachmentName(file)

	return {
		...file,
		file_id: fileId,
		parent_id: normalizeAttachmentId(file.parent_id),
		file_name: file.file_name || name,
		filename: file.filename || name,
		display_filename: file.display_filename || name,
		name,
		type: file.type ?? (isDirectory ? "directory" : "file"),
		is_directory: isDirectory,
		display_config: normalizeAttachmentObjectConfig(file.display_config),
		metadata: normalizeAttachmentObjectConfig(file.metadata),
		children: Array.isArray(file.children) ? file.children : [],
	}
}

function normalizeLocale(locale?: string) {
	if (!locale) return "zh-CN"
	return locale.replace("_", "-")
}

export function createAttachmentNodeComparator(locale?: string) {
	// Ignore backend sort; display folders first, then natural file names.
	const collator = new Intl.Collator(normalizeLocale(locale), {
		numeric: true,
		sensitivity: "accent",
		usage: "sort",
	})

	return (left: AttachmentItem, right: AttachmentItem) => {
		const magicPriority = compareMagicFolderPriority(left, right)
		if (magicPriority) return magicPriority
		const leftIsDirectory = Boolean(left.is_directory)
		const rightIsDirectory = Boolean(right.is_directory)
		if (leftIsDirectory !== rightIsDirectory) return leftIsDirectory ? -1 : 1

		return collator.compare(getAttachmentName(left), getAttachmentName(right))
	}
}

/** 系统目录优先于名称和时间排序；两个普通节点返回 0，保留调用方的原排序。 */
export function compareMagicFolderPriority(left: AttachmentItem, right: AttachmentItem): number {
	return Number(isMagicSystemFolder(right)) - Number(isMagicSystemFolder(left))
}

export function sortAttachmentTree(tree: AttachmentItem[], locale?: string): AttachmentItem[] {
	const comparator = createAttachmentNodeComparator(locale)

	return [...tree]
		.map((item) => ({
			...item,
			children: Array.isArray(item.children) ? sortAttachmentTree(item.children, locale) : [],
		}))
		.sort(comparator)
}

export function removeHiddenAttachmentItems(tree: AttachmentItem[]): AttachmentItem[] {
	return tree
		.filter((item) => !item.is_hidden)
		.map((item) => ({
			...item,
			children: Array.isArray(item.children)
				? removeHiddenAttachmentItems(item.children)
				: [],
		}))
}

export function flattenAttachmentTree(tree: AttachmentItem[]) {
	// Iterative DFS keeps list order aligned with the tree and avoids recursion risk.
	const list: AttachmentItem[] = []
	const stack = [...tree].reverse()

	while (stack.length > 0) {
		const item = stack.pop()
		if (!item) continue

		list.push(item)
		if (item.children?.length) {
			for (let index = item.children.length - 1; index >= 0; index -= 1) {
				stack.push(item.children[index])
			}
		}
	}

	return list
}

export function hasDirectoryStructuralChange(existing: AttachmentItem, incoming: AttachmentItem) {
	// Directory structure changes affect subtree paths; reducer handles only safe local edits.
	if (!existing.is_directory || !incoming.is_directory) return false
	const incomingPath = incoming.relative_file_path

	return (
		normalizeAttachmentId(existing.parent_id) !== normalizeAttachmentId(incoming.parent_id) ||
		getAttachmentName(existing) !== getAttachmentName(incoming) ||
		(typeof incomingPath === "string" &&
			incomingPath.length > 0 &&
			(existing.relative_file_path || "") !== incomingPath)
	)
}
