import { getFileContentById } from "@/pages/superMagic/utils/api"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"
import type {
	SlidesTemplateManifest,
	SlidesTemplateManifestSlide,
	SlidesTemplateProjectContext,
} from "./types"

const SLIDE_PATH_PATTERN = /^slides\/[^/]+\.html$/i

function getName(item: AttachmentItem): string {
	return item.file_name || item.filename || item.name || item.display_filename || ""
}

function normalizePath(path: string): string {
	return path
		.replace(/^\.\//, "")
		.replace(/^\/+/, "")
		.replace(/\/{2,}/g, "/")
}

function joinPath(...parts: string[]): string {
	return normalizePath(parts.filter(Boolean).join("/"))
}

function assertRecord(value: unknown, message: string): asserts value is Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message)
}

function requireNonEmptyString(value: unknown, message: string): string {
	if (typeof value !== "string" || !value.trim()) throw new Error(message)
	return value
}

export function parseSlidesTemplateManifest(content: string): SlidesTemplateManifest {
	let parsed: unknown
	try {
		parsed = JSON.parse(content)
	} catch {
		throw new Error("Invalid template.json")
	}

	assertRecord(parsed, "Invalid template.json")
	if (parsed.schema_version !== "1.0") throw new Error("Unsupported template schema")
	assertRecord(parsed.files, "Missing template files config")
	if (parsed.files.slides_dir !== "slides") throw new Error("Invalid slides directory")
	if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
		throw new Error("Template must contain at least one slide")
	}

	const slidePaths = new Set<string>()
	const slides = parsed.slides.map((slide, index) => {
		assertRecord(slide, `Invalid slide at index ${index}`)
		const file = typeof slide.file === "string" ? normalizePath(slide.file) : ""
		if (!SLIDE_PATH_PATTERN.test(file)) {
			throw new Error(`Invalid slide file at index ${index}`)
		}
		if (slidePaths.has(file)) throw new Error(`Duplicate slide file: ${file}`)
		slidePaths.add(file)
		return {
			...slide,
			file,
			title: requireNonEmptyString(slide.title, `Invalid slide title at index ${index}`),
			layout: requireNonEmptyString(slide.layout, `Invalid slide layout at index ${index}`),
			description: requireNonEmptyString(
				slide.description,
				`Invalid slide description at index ${index}`,
			),
		} satisfies SlidesTemplateManifestSlide
	})

	return {
		...parsed,
		schema_version: "1.0",
		files: parsed.files,
		slides,
	} as SlidesTemplateManifest
}

function collectTemplateFiles(root: AttachmentItem): {
	byPath: Map<string, AttachmentItem>
	rootPath: string
} {
	const rootPath = normalizePath(root.relative_file_path || getName(root))
	const byPath = new Map<string, AttachmentItem>()

	const visit = (items: AttachmentItem[] | undefined, parentRelativePath: string) => {
		for (const item of items || []) {
			const absolutePath = normalizePath(
				item.relative_file_path || joinPath(rootPath, parentRelativePath, getName(item)),
			)
			const relativePath =
				rootPath && absolutePath.startsWith(`${rootPath}/`)
					? absolutePath.slice(rootPath.length + 1)
					: joinPath(parentRelativePath, getName(item))
			byPath.set(normalizePath(relativePath), item)
			visit(item.children, relativePath)
		}
	}

	visit(root.children, "")
	return { byPath, rootPath }
}

export function buildSlidesTemplateProject(
	root: AttachmentItem,
	manifest: SlidesTemplateManifest,
): SlidesTemplateProjectContext {
	const rootFileId = String(root.file_id || "")
	if (!rootFileId) throw new Error("Missing template folder ID")

	const { byPath, rootPath } = collectTemplateFiles(root)
	const manifestFile = byPath.get("template.json")
	const slidesDirectory = byPath.get("slides")
	const visualSpecFile = byPath.get("visual-spec.md")
	const themeFile = byPath.get("theme.css")
	if (!manifestFile?.file_id) throw new Error("Missing template.json")
	if (!visualSpecFile?.file_id) throw new Error("Missing visual-spec.md")
	if (!themeFile?.file_id) throw new Error("Missing theme.css")
	if (!slidesDirectory?.is_directory || !slidesDirectory.file_id) {
		throw new Error("Missing slides directory")
	}

	const slideFiles = new Map<string, AttachmentItem>()
	const slidePaths = manifest.slides.map((slide) => {
		const path = normalizePath(slide.file)
		const file = byPath.get(path)
		if (!file?.file_id || file.is_directory) throw new Error(`Missing slide file: ${path}`)
		slideFiles.set(path, file)
		return path
	})

	return {
		root,
		rootFileId,
		rootPath,
		manifestFile,
		manifestFileId: String(manifestFile.file_id),
		slidesDirectory,
		slideFiles,
		slidePaths,
		manifest,
		displayConfig: { type: "slide", slides: slidePaths },
	}
}

export async function loadSlidesTemplateProject(
	root: AttachmentItem,
	fileApi?: FileApi,
): Promise<SlidesTemplateProjectContext> {
	const manifestFile = root.children?.find(
		(item) => !item.is_directory && getName(item) === "template.json",
	)
	if (!manifestFile?.file_id) throw new Error("Missing template.json")
	// Share template directories must carry their share identity or the manifest
	// read is blocked by the leaf guard and the preview hangs on loading.
	const content = fileApi
		? await fileApi.getFileContentById(String(manifestFile.file_id), {
				responseType: "text",
			})
		: await getFileContentById(String(manifestFile.file_id), { responseType: "text" })
	if (typeof content !== "string") throw new Error("Invalid template.json content")
	return buildSlidesTemplateProject(root, parseSlidesTemplateManifest(content))
}

export function stringifySlidesTemplateManifest(manifest: SlidesTemplateManifest): string {
	return `${JSON.stringify(manifest, null, 2)}\n`
}
