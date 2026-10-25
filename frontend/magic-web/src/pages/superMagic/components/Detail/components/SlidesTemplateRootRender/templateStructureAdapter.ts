import { SuperMagicApi } from "@/apis"
import { getFileContentById } from "@/pages/superMagic/utils/api"
import type { FileApi } from "@/pages/superMagic/fileAccess/fileApi"
import { generateBlankSlideContent } from "../../contents/HTML/utils/magicProjectUpdater"
import type { PPTSlideStructureAdapter } from "../PPTRender/types"
import type { AttachmentItem } from "../../../TopicFilesButton/hooks/types"
import { stringifySlidesTemplateManifest } from "./templateProject"
import type {
	SlidesTemplateManifest,
	SlidesTemplateManifestSlide,
	SlidesTemplateProjectContext,
} from "./types"

interface CreateAdapterOptions {
	project: SlidesTemplateProjectContext
	projectId?: string
	getManifest?: () => SlidesTemplateManifest
	saveManifest?: (manifest: SlidesTemplateManifest) => Promise<void>
	onManifestChange?: (manifest: SlidesTemplateManifest) => void
	/** Bound file client for reading slide sources on read-only share previews. */
	fileApi?: FileApi
}

function getName(item: AttachmentItem): string {
	return item.file_name || item.filename || item.name || item.display_filename || ""
}

function getFileName(path: string): string {
	return path.split("/").pop() || path
}

function normalizeRenamedFileName(input: string): string {
	const baseName = input.trim().replace(/\.html?$/i, "")
	const normalized = baseName
		.replace(/[\\/]/g, "-")
		.replace(/[\s_]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "")
	if (!normalized) throw new Error("Invalid slide file name")
	return `${normalized}.html`
}

function getNextSlideFileName(paths: string[]): string {
	const used = new Set(paths.map(getFileName))
	let index = paths.length + 1
	while (used.has(`slide-${index}.html`)) index += 1
	return `slide-${index}.html`
}

function getNextDuplicateFileName(sourcePath: string, paths: string[]): string {
	const sourceFileName = getFileName(sourcePath)
	const extensionMatch = sourceFileName.match(/(\.html?)$/i)
	const extension = extensionMatch?.[1] || ".html"
	const baseName = sourceFileName.slice(0, sourceFileName.length - extension.length)
	const usedNames = new Set(paths.map(getFileName))
	let suffix = 1
	let fileName = `${baseName} (${suffix})${extension}`
	while (usedNames.has(fileName)) {
		suffix += 1
		fileName = `${baseName} (${suffix})${extension}`
	}
	return fileName
}

export function createSlidesTemplateStructureAdapter({
	project,
	projectId,
	getManifest,
	saveManifest: saveManifestFromRoot,
	onManifestChange,
	fileApi,
}: CreateAdapterOptions): PPTSlideStructureAdapter {
	let manifest = project.manifest
	const slideFiles = new Map(project.slideFiles)

	const readSlideContent = (fileId: string) =>
		fileApi
			? fileApi.getFileContentById(fileId, { responseType: "text" })
			: getFileContentById(fileId, { responseType: "text" })

	const saveManifest = async (nextManifest: SlidesTemplateManifest) => {
		if (saveManifestFromRoot) {
			await saveManifestFromRoot(nextManifest)
		} else {
			await SuperMagicApi.saveFileContent([
				{
					file_id: project.manifestFileId,
					content: stringifySlidesTemplateManifest(nextManifest),
					enable_shadow: true,
				},
			])
		}
		manifest = nextManifest
		onManifestChange?.(nextManifest)
	}
	const currentManifest = () => getManifest?.() ?? manifest

	const requireProjectId = () => {
		if (!projectId) throw new Error("Missing project ID")
		return projectId
	}

	return {
		getFileId(slidePath) {
			const fileId = slideFiles.get(slidePath)?.file_id
			return fileId ? String(fileId) : undefined
		},

		async reorder(slidePaths) {
			const latestManifest = currentManifest()
			const entries = new Map(latestManifest.slides.map((slide) => [slide.file, slide]))
			if (
				slidePaths.length !== latestManifest.slides.length ||
				slidePaths.some((path) => !entries.has(path))
			) {
				throw new Error("Slide order does not match template manifest")
			}
			await saveManifest({
				...latestManifest,
				slides: slidePaths.map((path) => entries.get(path) as SlidesTemplateManifestSlide),
			})
		},

		async insert({ position, direction }) {
			const latestManifest = currentManifest()
			const resolvedProjectId = requireProjectId()
			const fileName = getNextSlideFileName(latestManifest.slides.map((slide) => slide.file))
			const filePath = `slides/${fileName}`
			const insertIndex = Math.min(
				Math.max(0, direction === "before" ? position : position + 1),
				latestManifest.slides.length,
			)
			const content = generateBlankSlideContent({
				slideTitle: fileName,
			})
			const newFile = (await SuperMagicApi.createFile({
				project_id: resolvedProjectId,
				parent_id: project.slidesDirectory.file_id,
				file_name: fileName,
				is_directory: false,
			})) as AttachmentItem
			if (!newFile?.file_id) throw new Error("Failed to create slide file")

			try {
				await SuperMagicApi.saveFileContent([
					{ file_id: String(newFile.file_id), content, enable_shadow: true },
				])
				const slides = [...latestManifest.slides]
				slides.splice(insertIndex, 0, {
					file: filePath,
					title: fileName,
					layout: "blank",
					description: "Blank slide",
				})
				await saveManifest({ ...latestManifest, slides })
			} catch (error) {
				try {
					await SuperMagicApi.deleteFile(String(newFile.file_id))
				} catch (cleanupError) {
					console.error("Failed to clean up inserted template slide:", cleanupError)
				}
				throw error
			}

			const normalizedFile: AttachmentItem = {
				...newFile,
				file_name: getName(newFile) || fileName,
				file_extension: newFile.file_extension || "html",
				parent_id: String(project.slidesDirectory.file_id),
				relative_file_path: `${project.rootPath}/${filePath}`.replace(/^\//, ""),
			}
			slideFiles.set(filePath, normalizedFile)
			return {
				filePath,
				fileId: String(newFile.file_id),
				content,
			}
		},

		async duplicate({ slidePath, position }) {
			const latestManifest = currentManifest()
			const resolvedProjectId = requireProjectId()
			const sourceFile = slideFiles.get(slidePath)
			const sourceEntry = latestManifest.slides.find((slide) => slide.file === slidePath)
			if (!sourceFile?.file_id || !sourceEntry) throw new Error("Slide file not found")

			const sourceContent = await readSlideContent(String(sourceFile.file_id))
			if (typeof sourceContent !== "string") throw new Error("Failed to load source slide")

			const fileName = getNextDuplicateFileName(slidePath, [
				...latestManifest.slides.map((slide) => slide.file),
				...slideFiles.keys(),
			])
			const filePath = `slides/${fileName}`
			const insertIndex = Math.min(Math.max(0, position + 1), latestManifest.slides.length)
			const newFile = (await SuperMagicApi.createFile({
				project_id: resolvedProjectId,
				parent_id: project.slidesDirectory.file_id,
				file_name: fileName,
				is_directory: false,
			})) as AttachmentItem
			if (!newFile?.file_id) throw new Error("Failed to create duplicated slide file")

			try {
				await SuperMagicApi.saveFileContent([
					{
						file_id: String(newFile.file_id),
						content: sourceContent,
						enable_shadow: true,
					},
				])
				const slides = [...latestManifest.slides]
				slides.splice(insertIndex, 0, { ...sourceEntry, file: filePath })
				await saveManifest({ ...latestManifest, slides })
			} catch (error) {
				try {
					await SuperMagicApi.deleteFile(String(newFile.file_id))
				} catch (cleanupError) {
					console.error("Failed to clean up duplicated template slide:", cleanupError)
				}
				throw error
			}

			const normalizedFile: AttachmentItem = {
				...newFile,
				file_name: getName(newFile) || fileName,
				file_extension: newFile.file_extension || "html",
				parent_id: String(project.slidesDirectory.file_id),
				relative_file_path: `${project.rootPath}/${filePath}`.replace(/^\//, ""),
			}
			slideFiles.set(filePath, normalizedFile)
			return {
				filePath,
				fileId: String(newFile.file_id),
				content: sourceContent,
			}
		},

		async remove(slidePath) {
			const latestManifest = currentManifest()
			if (latestManifest.slides.length <= 1) throw new Error("Cannot delete the last slide")
			const resolvedProjectId = requireProjectId()
			const file = slideFiles.get(slidePath)
			if (!file?.file_id) throw new Error("Slide file not found")
			const fileId = String(file.file_id)
			const originalContent = await readSlideContent(fileId)
			await SuperMagicApi.deleteFile(fileId)

			try {
				await saveManifest({
					...latestManifest,
					slides: latestManifest.slides.filter((slide) => slide.file !== slidePath),
				})
				slideFiles.delete(slidePath)
			} catch (error) {
				if (typeof originalContent === "string") {
					const restored = (await SuperMagicApi.createFile({
						project_id: resolvedProjectId,
						parent_id: project.slidesDirectory.file_id,
						file_name: getFileName(slidePath),
						is_directory: false,
					})) as AttachmentItem
					if (restored?.file_id) {
						await SuperMagicApi.saveFileContent([
							{
								file_id: String(restored.file_id),
								content: originalContent,
								enable_shadow: true,
							},
						])
						slideFiles.set(slidePath, restored)
					}
				}
				throw error
			}
		},

		async rename(oldPath, newFileName) {
			const latestManifest = currentManifest()
			const normalizedFileName = normalizeRenamedFileName(newFileName)
			const nextPath = `slides/${normalizedFileName}`
			if (nextPath === oldPath) return oldPath
			if (latestManifest.slides.some((slide) => slide.file === nextPath)) {
				throw new Error("Slide file already exists")
			}
			const fileId = String(slideFiles.get(oldPath)?.file_id || "")
			if (!fileId) throw new Error("Slide file not found")

			await SuperMagicApi.renameFile({ file_id: fileId, target_name: normalizedFileName })
			try {
				await saveManifest({
					...latestManifest,
					slides: latestManifest.slides.map((slide) =>
						slide.file === oldPath ? { ...slide, file: nextPath } : slide,
					),
				})
			} catch (error) {
				try {
					await SuperMagicApi.renameFile({
						file_id: fileId,
						target_name: getFileName(oldPath),
					})
				} catch (rollbackError) {
					console.error("Failed to roll back template slide rename:", rollbackError)
				}
				throw error
			}

			const previousFile = slideFiles.get(oldPath)
			slideFiles.delete(oldPath)
			if (previousFile) {
				slideFiles.set(nextPath, {
					...previousFile,
					file_name: normalizedFileName,
					relative_file_path: `${project.rootPath}/${nextPath}`.replace(/^\//, ""),
				})
			}
			return nextPath
		},
	}
}
