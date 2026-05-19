import { IMAGE_EXTENSIONS } from "@/constants/file"
import { MentionItemType, type MentionItem, type ProjectFileMentionData } from "../../../../types"

const imageExtSet = new Set(IMAGE_EXTENSIONS.map((ext) => ext.replace(/^\./, "").toLowerCase()))

export interface MentionFilePreviewSourceRow {
	type?: string
	is_directory?: boolean
	file_id?: string | number
	updated_at?: string
	relative_file_path?: string
	file_key?: string
	file_url?: string
	url?: string
}

export interface MentionFilePreviewIndexes {
	byFileId: Map<string, string>
	byPath: Map<string, string>
}

export function normalizeFileExtensionForMentionImage(ext?: string | null) {
	if (!ext) return ""
	return ext.replace(/^\./, "").toLowerCase()
}

export function isMentionPanelImageFileExtension(ext?: string | null) {
	const normalized = normalizeFileExtensionForMentionImage(ext)
	if (!normalized) return false
	return imageExtSet.has(normalized)
}

export function getMentionProjectFileImageExtension(item: MentionItem): string {
	if (item.type !== MentionItemType.PROJECT_FILE) return ""
	const data = item.data as ProjectFileMentionData | undefined
	return (
		item.extension ||
		data?.file_extension ||
		(typeof item.icon === "string" && !item.icon.startsWith("ts-") ? item.icon : "") ||
		""
	)
}

export function normalizeMentionComparablePath(path: string) {
	if (!path) return ""
	return path.replace(/^\/+/, "").replace(/\/+$/, "")
}

function fnv1aHashBase36(input: string) {
	let h = 2166136261
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i)
		h = Math.imul(h, 16777619) >>> 0
	}
	return (h >>> 0).toString(36)
}

export function buildMentionFilePreviewSourceFingerprint(
	rows: readonly MentionFilePreviewSourceRow[],
): string {
	const parts: string[] = []
	for (const row of rows) {
		const id = String(row.file_id ?? "")
		const fu = typeof row.file_url === "string" ? row.file_url : ""
		const u = typeof row.url === "string" ? row.url : ""
		const rp = row.relative_file_path
			? normalizeMentionComparablePath(row.relative_file_path)
			: ""
		const fk = row.file_key ? normalizeMentionComparablePath(row.file_key) : ""
		const dir = row.type === "directory" || row.is_directory ? "1" : "0"
		parts.push(
			`${id}:${fnv1aHashBase36(fu)}:${fnv1aHashBase36(u)}:${fnv1aHashBase36(rp)}:${fnv1aHashBase36(fk)}:${dir}`,
		)
	}
	return parts.join("|")
}

function pickRowPreviewUrl(row: MentionFilePreviewSourceRow): string {
	const fromFileUrl = typeof row.file_url === "string" ? row.file_url.trim() : ""
	if (fromFileUrl) return fromFileUrl
	const fromUrl = typeof row.url === "string" ? row.url.trim() : ""
	return fromUrl
}

export function buildMentionFilePreviewIndexes(
	rows: readonly MentionFilePreviewSourceRow[],
): MentionFilePreviewIndexes {
	const byFileId = new Map<string, string>()
	const byPath = new Map<string, string>()

	for (const row of rows) {
		if (row.type === "directory" || row.is_directory) continue

		const previewUrl = pickRowPreviewUrl(row)
		if (!previewUrl) continue

		if (row.file_id != null) byFileId.set(String(row.file_id), previewUrl)

		const relativePath = row.relative_file_path
			? normalizeMentionComparablePath(row.relative_file_path)
			: ""
		if (relativePath) byPath.set(relativePath, previewUrl)

		const fileKey = row.file_key ? normalizeMentionComparablePath(row.file_key) : ""
		if (fileKey) byPath.set(fileKey, previewUrl)
	}

	return { byFileId, byPath }
}

function findMentionFilePreviewByComparablePath(
	targetPath: string,
	byPath: ReadonlyMap<string, string>,
): string | undefined {
	if (!targetPath) return undefined

	const exact = byPath.get(targetPath)
	if (exact) return exact

	let matchedPreviewUrl: string | undefined
	byPath.forEach((previewUrl, path) => {
		if (matchedPreviewUrl) return
		if (targetPath.endsWith(path) || path.endsWith(targetPath)) matchedPreviewUrl = previewUrl
	})

	return matchedPreviewUrl
}

export function resolveProjectFileImagePreview(
	data: ProjectFileMentionData,
	sources: readonly MentionFilePreviewIndexes[],
): string | undefined {
	if (!data?.file_id && !data?.file_path) return undefined

	const targetPath = data.file_path ? normalizeMentionComparablePath(data.file_path) : ""
	const fileId = data.file_id ? String(data.file_id) : ""

	for (const source of sources) {
		if (fileId) {
			const fromFileId = source.byFileId.get(fileId)
			if (fromFileId) return fromFileId
		}

		const fromPath = findMentionFilePreviewByComparablePath(targetPath, source.byPath)
		if (fromPath) return fromPath
	}

	return undefined
}

export function hasMentionPanelImagePreviewItems(items: MentionItem[]): boolean {
	for (const item of items) {
		if (item.type !== MentionItemType.PROJECT_FILE) continue
		if (isMentionPanelImageFileExtension(getMentionProjectFileImageExtension(item))) return true
	}

	return false
}

export function buildMentionFilePreviewSyncMap(
	items: MentionItem[],
	sources: readonly MentionFilePreviewIndexes[],
): Record<string, string> {
	const map: Record<string, string> = {}

	for (const item of items) {
		if (item.type !== MentionItemType.PROJECT_FILE) continue

		const data = item.data as ProjectFileMentionData | undefined
		if (!data?.file_id) continue

		if (!isMentionPanelImageFileExtension(getMentionProjectFileImageExtension(item))) continue

		const previewUrl = resolveProjectFileImagePreview(data, sources)
		if (previewUrl) map[data.file_id] = previewUrl
	}

	return map
}

export function collectMentionImagePreviewFileIds(
	items: MentionItem[],
	syncMap: Record<string, string>,
): string[] {
	const ids = new Set<string>()

	for (const item of items) {
		if (item.type !== MentionItemType.PROJECT_FILE) continue

		const data = item.data as ProjectFileMentionData | undefined
		if (!data?.file_id) continue

		if (!isMentionPanelImageFileExtension(getMentionProjectFileImageExtension(item))) continue
		if (syncMap[data.file_id]) continue

		ids.add(data.file_id)
	}

	return Array.from(ids)
}
