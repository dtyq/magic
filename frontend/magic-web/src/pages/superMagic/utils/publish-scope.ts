import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

const DEFAULT_PUBLISH_ROOT = ".magic"

type AttachmentPathFields = AttachmentItem & {
	file_path?: string
	file_type?: string
	updated_at?: string | number
	updatedAt?: string | number
	modified_at?: string | number
	modify_time?: string | number
}

export interface PublishScopeFile {
	path: string
	updatedAt?: string | number
}

function normalizePath(value: unknown): string {
	if (typeof value !== "string") return ""
	return value
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/^\.\//, "")
		.replace(/\/+$/, "")
}

function isDirectory(item: AttachmentItem): boolean {
	const candidate = item as AttachmentPathFields
	return Boolean(
		item.is_directory || item.type === "directory" || candidate.file_type === "directory",
	)
}

function getItemName(item: AttachmentItem): string {
	return (
		item.file_name?.trim() ||
		item.name?.trim() ||
		item.filename?.trim() ||
		item.display_filename?.trim() ||
		""
	)
}

function getItemPath(item: AttachmentItem, fallbackParentPath = ""): string {
	const candidate = item as AttachmentPathFields
	const explicitPath = normalizePath(item.relative_file_path ?? candidate.file_path ?? item.path)
	if (explicitPath) return explicitPath

	const name = normalizePath(getItemName(item))
	if (!name) return normalizePath(fallbackParentPath)
	return [normalizePath(fallbackParentPath), name].filter(Boolean).join("/")
}

function getItemUpdatedAt(item: AttachmentItem): string | number | undefined {
	const candidate = item as AttachmentPathFields
	return (
		candidate.updated_at ??
		candidate.updatedAt ??
		candidate.modified_at ??
		candidate.modify_time
	)
}

function collectFiles(items: AttachmentItem[], parentPath = ""): PublishScopeFile[] {
	const files: PublishScopeFile[] = []

	for (const item of items) {
		const itemPath = getItemPath(item, parentPath)
		if (isDirectory(item)) {
			if (item.children?.length) files.push(...collectFiles(item.children, itemPath))
			continue
		}

		if (itemPath) files.push({ path: itemPath, updatedAt: getItemUpdatedAt(item) })
	}

	return files
}

function toTimestamp(value: string | number | undefined): number | undefined {
	if (typeof value === "number") return Number.isFinite(value) ? value : undefined
	if (!value) return undefined

	const timestamp = Date.parse(value)
	return Number.isNaN(timestamp) ? undefined : timestamp
}

function comparePublishScopeFiles(a: PublishScopeFile, b: PublishScopeFile): number {
	const aTimestamp = toTimestamp(a.updatedAt)
	const bTimestamp = toTimestamp(b.updatedAt)
	if (aTimestamp !== undefined && bTimestamp !== undefined && aTimestamp !== bTimestamp) {
		return bTimestamp - aTimestamp
	}
	if (aTimestamp !== undefined && bTimestamp === undefined) return -1
	if (aTimestamp === undefined && bTimestamp !== undefined) return 1
	return a.path < b.path ? -1 : a.path > b.path ? 1 : 0
}

/**
 * Returns project-relative file paths that will not be included by the publish exporter.
 * Directory entries are intentionally ignored; only files can make the notice necessary.
 */
export function findFilesOutsidePublishRoot(
	items: AttachmentItem[],
	publishRoot = DEFAULT_PUBLISH_ROOT,
): string[] {
	return findPublishScopeFilesOutsideRoot(items, publishRoot)
		.map(({ path }) => path)
		.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
}

/**
 * Returns project-relative files outside the publish root, ordered by latest
 * modification time first. Files without a usable timestamp are shown last.
 */
export function findPublishScopeFilesOutsideRoot(
	items: AttachmentItem[],
	publishRoot = DEFAULT_PUBLISH_ROOT,
): PublishScopeFile[] {
	const normalizedRoot = normalizePath(publishRoot)
	if (!normalizedRoot) return []

	const rootPrefix = `${normalizedRoot}/`
	const filesByPath = new Map<string, PublishScopeFile>()

	for (const file of collectFiles(items)) {
		if (file.path === normalizedRoot || file.path.startsWith(rootPrefix)) continue

		const existing = filesByPath.get(file.path)
		if (!existing || comparePublishScopeFiles(file, existing) < 0) {
			filesByPath.set(file.path, file)
		}
	}

	return Array.from(filesByPath.values()).sort(comparePublishScopeFiles)
}

export function hasFilesOutsidePublishRoot(
	items: AttachmentItem[],
	publishRoot = DEFAULT_PUBLISH_ROOT,
): boolean {
	return findFilesOutsidePublishRoot(items, publishRoot).length > 0
}
