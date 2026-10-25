import type { AttachmentItem } from "../hooks/types"

const REQUIRED_FILES = new Set(["template.json", "visual-spec.md", "theme.css"])
const CONVERTIBLE_PRESENTATION_EXTENSIONS = new Set(["ppt", "pptx", "potx"])

function getName(item: AttachmentItem): string {
	return item.file_name || item.filename || item.name || item.display_filename || ""
}

function normalizeExtension(value?: string): string {
	return (value || "").replace(/^\./, "").toLowerCase()
}

function getExtensionFromName(name: string): string {
	const baseName = name.replace(/\\/g, "/").split("/").pop() || ""
	const separatorIndex = baseName.lastIndexOf(".")
	if (separatorIndex <= 0) return ""
	return normalizeExtension(baseName.slice(separatorIndex + 1))
}

/** PPT / PPTX / POTX files can reuse the convert-to-template flow. */
export function isConvertiblePresentationFile(item: AttachmentItem | undefined): boolean {
	if (!item || item.is_directory) return false
	const explicit = normalizeExtension(item.file_extension)
	if (CONVERTIBLE_PRESENTATION_EXTENSIONS.has(explicit)) return true
	return CONVERTIBLE_PRESENTATION_EXTENSIONS.has(getExtensionFromName(getName(item)))
}

/** 只识别模板根目录的直接结构，不把普通文件夹误判为模板。 */
export function isSlidesTemplateFolder(item: AttachmentItem | undefined): boolean {
	if (!item?.is_directory || !Array.isArray(item.children)) return false

	let hasSlidesDirectory = false
	const files = new Set<string>()
	for (const child of item.children) {
		const name = getName(child)
		if (child.is_directory && name === "slides") {
			hasSlidesDirectory = true
			continue
		}
		if (!child.is_directory && REQUIRED_FILES.has(name)) files.add(name)
	}
	return hasSlidesDirectory && files.size === REQUIRED_FILES.size
}

export function toSlidesTemplatePreviewItem(item: AttachmentItem): AttachmentItem {
	return {
		...item,
		display_config: {
			type: "slide-template",
			source: "project-template",
		},
	}
}
