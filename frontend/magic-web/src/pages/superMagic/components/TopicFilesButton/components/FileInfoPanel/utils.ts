import { getMagicProjectType, type MagicProjectKind } from "@/constants/magicProjectTypes"
import { formatFileSize } from "@/utils/string"
import type { AttachmentItem } from "../../hooks/types"
import { AttachmentSource } from "../../hooks/types"
import type { FileInfoField, FileInfoModel, FileInfoSpecialSection, FileInfoStats } from "./types"

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"])
const DATA_EXTENSIONS = new Set(["json", "js", "csv", "xls", "xlsx"])
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "mkv"])
const REGULAR_FILE_NAMES = new Set(["magic.project.js", "index.html"])

type FileInfoConfig = Record<string, unknown>

function compact<T>(items: Array<T | false | null | undefined>): T[] {
	return items.filter(Boolean) as T[]
}

export function resolveDisplayName(item?: AttachmentItem | null): string {
	return (
		item?.display_filename ||
		item?.file_name ||
		item?.filename ||
		item?.name ||
		item?.relative_file_path?.split("/").filter(Boolean).pop() ||
		"-"
	)
}

function resolvePath(item: AttachmentItem): string {
	return item.relative_file_path || item.path || resolveDisplayName(item)
}

function normalizeExtension(item: AttachmentItem): string {
	const extension = item.file_extension || resolveDisplayName(item).split(".").pop() || ""
	return extension.replace(/^\./, "").toLowerCase()
}

function normalizeDateText(value?: string): string {
	if (!value) return "-"
	const parsed = new Date(value.replace(/-/g, "/"))
	if (Number.isNaN(parsed.getTime())) return value
	const pad = (next: number) => String(next).padStart(2, "0")
	const date = `${parsed.getFullYear()}/${pad(parsed.getMonth() + 1)}/${pad(parsed.getDate())}`
	const time = `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`
	return `${date} ${time}`
}

function numberValue(value: unknown): number | undefined {
	if (typeof value !== "number" || Number.isNaN(value)) return undefined
	return value
}

function formatSizeValue(size?: number): string {
	if (!size) return "topicFiles.fileInfo.unknownSize"
	return formatFileSize(size)
}

export function collectFolderStats(item: AttachmentItem): FileInfoStats {
	const stats: FileInfoStats = {
		directChildren: item.children?.length || 0,
		fileCount: 0,
		folderCount: 0,
		hiddenCount: 0,
		totalSize: 0,
	}

	const walk = (nodes?: AttachmentItem[]) => {
		for (const node of nodes || []) {
			if (node.is_directory) {
				stats.folderCount += 1
			} else {
				stats.fileCount += 1
			}
			if (node.is_hidden) stats.hiddenCount += 1
			stats.totalSize += numberValue(node.file_size) || 0
			if (node.children?.length) walk(node.children)
		}
	}

	walk(item.children)
	return stats
}

function resolveDisplayConfig(item: AttachmentItem): FileInfoConfig | undefined {
	if (!item.is_directory && REGULAR_FILE_NAMES.has(resolveDisplayName(item))) return undefined
	const displayConfig = item.display_config
	if (displayConfig && typeof displayConfig === "object") return displayConfig as FileInfoConfig
	return undefined
}

function resolveSpecialType(item: AttachmentItem): string | undefined {
	const config = resolveDisplayConfig(item)
	const type = config?.type
	return typeof type === "string" && type.trim()
		? (getMagicProjectType(type.trim())?.kind ?? type.trim())
		: undefined
}

function basename(path: string): string {
	return path.split("/").filter(Boolean).pop() || path
}

function normalizeRelativePathSegments(relativePath: string): string[] {
	return relativePath.trim().replace(/\\/g, "/").split("/").filter(Boolean)
}

function resolveFileByRelativePath(children: AttachmentItem[] | undefined, relativePath?: string) {
	if (!relativePath) return undefined
	const segments = normalizeRelativePathSegments(relativePath)
	let currentLevel = children || []
	let current: AttachmentItem | undefined

	for (const segment of segments) {
		current = currentLevel.find((child) => resolveDisplayName(child) === segment)
		if (!current) return undefined
		currentLevel = current.children || []
	}

	return current?.is_directory ? undefined : current
}

export function resolveEntryFile(item: AttachmentItem): { path: string; file?: AttachmentItem } {
	const config = resolveDisplayConfig(item)
	const configuredPath = [config?.entry, config?.index, config?.root_path].find(
		(value) => typeof value === "string" && value.trim(),
	) as string | undefined
	const path = configuredPath?.trim() || "index.html"
	const file =
		resolveFileByRelativePath(item.children, path) ||
		item.children?.find((child) => !child.is_directory && resolveDisplayName(child) === path)

	return { path, file }
}

function countFilesByExtension(item: AttachmentItem, extensions: Set<string>): number {
	let count = 0
	const walk = (nodes?: AttachmentItem[]) => {
		for (const node of nodes || []) {
			if (!node.is_directory && extensions.has(normalizeExtension(node))) count += 1
			if (node.children?.length) walk(node.children)
		}
	}
	walk(item.children)
	return count
}

export function sourceLabelKey(source?: AttachmentSource): string {
	switch (source) {
		case AttachmentSource.HOME:
		case AttachmentSource.PROJECT_DIRECTORY:
			return "topicFiles.fileInfo.source.uploaded"
		case AttachmentSource.AGENT:
			return "topicFiles.fileInfo.source.agent"
		case AttachmentSource.COPY:
			return "topicFiles.fileInfo.source.copy"
		case AttachmentSource.AI:
			return "topicFiles.fileInfo.source.ai"
		default:
			return "topicFiles.fileInfo.source.default"
	}
}

const PROJECT_TYPE_LABEL_KEYS = {
	audio: "topicFiles.fileInfo.type.audio",
	slide: "topicFiles.fileInfo.type.slide",
	dashboard: "topicFiles.fileInfo.type.dashboard",
	design: "topicFiles.fileInfo.type.design",
	"ai-card": "topicFiles.fileInfo.type.ai-card",
	"slide-template": "topicFiles.fileInfo.type.slide-template",
	custom: "topicFiles.fileInfo.type.custom",
	"micro-app": "topicFiles.fileInfo.type.micro-app",
	video: "topicFiles.fileInfo.type.video",
	"self-media": "topicFiles.fileInfo.type.self-media",
} satisfies Record<MagicProjectKind, string>

function typeLabelKey(type?: string, isDirectory?: boolean): string {
	if (!type)
		return isDirectory ? "topicFiles.fileInfo.type.folder" : "topicFiles.fileInfo.type.file"
	const definition = getMagicProjectType(type)
	return definition
		? PROJECT_TYPE_LABEL_KEYS[definition.kind]
		: "topicFiles.fileInfo.type.special"
}

function iconTypeForItem(item: AttachmentItem, specialType?: string): string {
	const definition = getMagicProjectType(specialType)
	if (definition) return definition.extensionType
	if (specialType) return specialType
	if (item.is_directory) return "folder"
	return normalizeExtension(item) || "other"
}

function field(key: string, labelKey: string, value: unknown, copyable = false) {
	if (value === undefined || value === null || value === "") return undefined
	if (typeof value !== "string" && typeof value !== "number") return undefined
	return { key, labelKey, value: String(value), copyable }
}

function resolveSlideSection(item: AttachmentItem, config: FileInfoConfig): FileInfoSpecialSection {
	const slides = Array.isArray(config.slides)
		? config.slides.filter((slide): slide is string => typeof slide === "string")
		: []
	const children = item.children || []
	const fileNames = new Set(
		children.filter((child) => !child.is_directory).map(resolveDisplayName),
	)
	const matchedCount = slides.filter((slide) => fileNames.has(basename(slide))).length
	const missingCount = Math.max(slides.length - matchedCount, 0)
	const entry = resolveEntryFile(item)
	const resourceDirs = children.filter((child) => child.is_directory).map(resolveDisplayName)

	return {
		type: "slide",
		typeLabelKey: "topicFiles.fileInfo.type.slide",
		fields: compact([
			field("projectName", "topicFiles.fileInfo.labels.projectName", config.name),
			field("slideCount", "topicFiles.fileInfo.labels.slideCount", slides.length),
			field(
				"entry",
				"topicFiles.fileInfo.labels.entryFile",
				entry.file ? resolveDisplayName(entry.file) : entry.path,
			),
			field(
				"matchedSlides",
				"topicFiles.fileInfo.labels.matchedSlides",
				`${matchedCount}/${slides.length}`,
			),
			missingCount
				? field("missingSlides", "topicFiles.fileInfo.labels.missingSlides", missingCount)
				: undefined,
			resourceDirs.length
				? field(
						"resourceDirs",
						"topicFiles.fileInfo.labels.resourceDirs",
						resourceDirs.join(", "),
					)
				: undefined,
		]),
		previewItems: slides.slice(0, 5),
	}
}

function resolveAppSection(
	item: AttachmentItem,
	config: FileInfoConfig,
	type: "custom" | "micro-app",
): FileInfoSpecialSection {
	const entry = resolveEntryFile(item)
	const iconPath = [config.icon, config.icon_path].find(
		(value) => typeof value === "string" && value.trim(),
	) as string | undefined

	return {
		type,
		typeLabelKey: `topicFiles.fileInfo.type.${type}`,
		fields: compact([
			field(
				"entry",
				"topicFiles.fileInfo.labels.entryFile",
				entry.file ? resolveDisplayName(entry.file) : entry.path,
			),
			field("entryPath", "topicFiles.fileInfo.labels.entryPath", entry.path, true),
			field("icon", "topicFiles.fileInfo.labels.iconSource", iconPath, true),
			field(
				"imageResources",
				"topicFiles.fileInfo.labels.imageResources",
				countFilesByExtension(item, IMAGE_EXTENSIONS),
			),
		]),
	}
}

function resolveGenericSpecialSection(
	item: AttachmentItem,
	config: FileInfoConfig,
	type: string,
): FileInfoSpecialSection {
	const entry = resolveEntryFile(item)
	const fields: FileInfoField[] = []

	if (["dashboard", "audio", "video"].includes(type)) {
		fields.push(
			...compact([
				field(
					"entry",
					"topicFiles.fileInfo.labels.entryFile",
					entry.file ? resolveDisplayName(entry.file) : entry.path,
				),
				field("entryPath", "topicFiles.fileInfo.labels.entryPath", entry.path, true),
			]),
		)
	}

	if (type === "dashboard") {
		fields.push(
			...compact([
				field(
					"dataResources",
					"topicFiles.fileInfo.labels.dataResources",
					countFilesByExtension(item, DATA_EXTENSIONS),
				),
			]),
		)
	}
	if (type === "video") {
		fields.push(
			...compact([
				field(
					"mediaResources",
					"topicFiles.fileInfo.labels.mediaResources",
					countFilesByExtension(item, VIDEO_EXTENSIONS),
				),
			]),
		)
	}
	if (type === "self-media") {
		const platforms = Object.keys(config).filter(
			(key) => !["type", "version", "name"].includes(key) && typeof config[key] === "object",
		)
		fields.push(
			...compact([
				field(
					"platformCount",
					"topicFiles.fileInfo.labels.platformCount",
					platforms.length,
				),
			]),
		)
		return {
			type,
			typeLabelKey: "topicFiles.fileInfo.type.self-media",
			fields,
			chips: platforms,
		}
	}

	return {
		type,
		typeLabelKey: typeLabelKey(type, item.is_directory),
		fields: fields.length
			? fields
			: compact([field("rawType", "topicFiles.fileInfo.labels.rawType", type, true)]),
	}
}

export function resolveSpecialProjectInfo(
	item: AttachmentItem,
): FileInfoSpecialSection | undefined {
	const type = resolveSpecialType(item)
	const config = resolveDisplayConfig(item)
	if (!type || !config) return undefined

	if (type === "slide") return resolveSlideSection(item, config)
	if (type === "custom" || type === "micro-app") return resolveAppSection(item, config, type)
	if (type === "design" || type === "audio") return undefined
	return resolveGenericSpecialSection(item, config, type)
}

export function buildFileInfoModel(item: AttachmentItem): FileInfoModel {
	const displayName = resolveDisplayName(item)
	const specialType = resolveSpecialType(item)
	const specialSection = resolveSpecialProjectInfo(item)
	const stats = collectFolderStats(item)
	const size = item.is_directory ? stats.totalSize : numberValue(item.file_size)
	const extension = normalizeExtension(item)
	const resolvedTypeLabelKey = typeLabelKey(specialType, item.is_directory)
	const typeFallback = specialType && !getMagicProjectType(specialType) ? specialType : undefined

	const generalFields = compact([
		field("kind", "topicFiles.fileInfo.labels.kind", typeFallback || resolvedTypeLabelKey),
		field("size", "topicFiles.fileInfo.labels.size", formatSizeValue(size)),
		field("path", "topicFiles.fileInfo.labels.path", resolvePath(item), true),
		field("source", "topicFiles.fileInfo.labels.source", sourceLabelKey(item.source)),
		field(
			"updatedAt",
			"topicFiles.fileInfo.labels.updatedAt",
			normalizeDateText(item.updated_at),
		),
		field(
			"createdAt",
			"topicFiles.fileInfo.labels.createdAt",
			item.created_at ? normalizeDateText(item.created_at) : undefined,
		),
		!item.is_directory && extension
			? field("extension", "topicFiles.fileInfo.labels.extension", extension)
			: undefined,
	])

	const contentFields = item.is_directory
		? compact([
				field(
					"directChildren",
					"topicFiles.fileInfo.labels.directChildren",
					stats.directChildren,
				),
				field("fileCount", "topicFiles.fileInfo.labels.fileCount", stats.fileCount),
				field("folderCount", "topicFiles.fileInfo.labels.folderCount", stats.folderCount),
				field("hiddenCount", "topicFiles.fileInfo.labels.hiddenCount", stats.hiddenCount),
			])
		: []

	const technicalFields = compact([
		field("fileId", "topicFiles.fileInfo.labels.fileId", item.file_id, true),
		field("projectId", "topicFiles.fileInfo.labels.projectId", item.project_id, true),
		field("parentId", "topicFiles.fileInfo.labels.parentId", item.parent_id || undefined, true),
		field("fileKey", "topicFiles.fileInfo.labels.fileKey", item.file_key, true),
	])
	const slideCountField = specialSection?.fields.find((next) => next.key === "slideCount")

	return {
		item,
		displayName,
		path: resolvePath(item),
		iconType: iconTypeForItem(item, specialType),
		typeLabelKey: resolvedTypeLabelKey,
		typeLabelFallback: typeFallback,
		isDirectory: Boolean(item.is_directory),
		metrics: compact([
			item.is_directory
				? {
						key: "files",
						labelKey: "topicFiles.fileInfo.metrics.files",
						value: String(stats.fileCount),
					}
				: undefined,
			item.is_directory
				? {
						key: "folders",
						labelKey: "topicFiles.fileInfo.metrics.folders",
						value: String(stats.folderCount),
					}
				: undefined,
			specialType === "slide" && slideCountField
				? {
						key: "slides",
						labelKey: "topicFiles.fileInfo.metrics.slides",
						value: slideCountField.value,
					}
				: undefined,
			{
				key: "size",
				labelKey: "topicFiles.fileInfo.metrics.size",
				value: formatSizeValue(size),
			},
		]),
		generalFields,
		contentFields,
		specialSection,
		technicalFields,
	}
}
