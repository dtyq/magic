import type { CanvasDocument, LayerElement } from "@/components/CanvasDesign/canvas/types"
import { type ImageGenerationTaskMeta } from "@/components/CanvasDesign/types.magic"
import { normalizePath } from "./utils"
import { resolveDesignDslPathCandidatesToWorkspaceRelative } from "./designDslPathUtils"

interface ReplaceCanvasFilePathReferencesOptions {
	oldWorkspaceRelativePath: string
	newCanvasPath: string
	designProjectBasePath?: string
}

function asRecord(value: object): Record<string, unknown> {
	return value as unknown as Record<string, unknown>
}

function shouldReplacePath(
	value: unknown,
	oldWorkspaceRelativePath: string,
	designProjectBasePath?: string,
): value is string {
	if (typeof value !== "string" || !value.trim()) return false

	const oldPath = normalizePath(oldWorkspaceRelativePath)
	return resolveDesignDslPathCandidatesToWorkspaceRelative(value, designProjectBasePath).some(
		(resolvedPath) => normalizePath(resolvedPath) === oldPath,
	)
}

function replacePathField(
	target: Record<string, unknown>,
	key: string,
	oldWorkspaceRelativePath: string,
	newCanvasPath: string,
	designProjectBasePath?: string,
): boolean {
	if (!shouldReplacePath(target[key], oldWorkspaceRelativePath, designProjectBasePath)) {
		return false
	}

	target[key] = newCanvasPath
	return true
}

function replaceReferenceImageOptionsPaths(
	value: unknown,
	oldWorkspaceRelativePath: string,
	newCanvasPath: string,
	designProjectBasePath?: string,
): boolean {
	if (!Array.isArray(value) || value.length === 0) return false

	let hasChanged = false
	for (const item of value) {
		if (!item || typeof item !== "object") continue
		if (
			replacePathField(
				item as Record<string, unknown>,
				"path",
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
	}

	return hasChanged
}

function replaceUriItems(
	value: unknown,
	oldWorkspaceRelativePath: string,
	newCanvasPath: string,
	designProjectBasePath?: string,
): boolean {
	if (!Array.isArray(value) || value.length === 0) return false

	let hasChanged = false
	for (const item of value) {
		if (!item || typeof item !== "object") continue
		if (
			replacePathField(
				item as Record<string, unknown>,
				"uri",
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
	}

	return hasChanged
}

function replaceImageElementPaths(
	element: Record<string, unknown>,
	oldWorkspaceRelativePath: string,
	newCanvasPath: string,
	designProjectBasePath?: string,
): boolean {
	let hasChanged = false

	if (
		replacePathField(
			element,
			"src",
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	) {
		hasChanged = true
	}

	const generateImageRequest = element.generateImageRequest as
		| {
				reference_images?: string[]
				reference_image_options?: Array<{ path?: string }>
		  }
		| undefined

	if (generateImageRequest && typeof generateImageRequest === "object") {
		if (Array.isArray(generateImageRequest.reference_images)) {
			const nextReferenceImages = generateImageRequest.reference_images.map((path) => {
				if (!shouldReplacePath(path, oldWorkspaceRelativePath, designProjectBasePath)) {
					return path
				}

				hasChanged = true
				return newCanvasPath
			})
			generateImageRequest.reference_images = nextReferenceImages
		}

		if (
			replaceReferenceImageOptionsPaths(
				generateImageRequest.reference_image_options,
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
	}

	const imageGenerationTaskMeta = element.imageGenerationTaskMeta as
		| ImageGenerationTaskMeta
		| undefined
	if (imageGenerationTaskMeta && typeof imageGenerationTaskMeta === "object") {
		const imageGenerationTaskMetaRecord = asRecord(imageGenerationTaskMeta)

		if (
			replacePathField(
				imageGenerationTaskMetaRecord,
				"file_path",
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
		if (
			replacePathField(
				imageGenerationTaskMetaRecord,
				"mask_path",
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
		if (
			replacePathField(
				imageGenerationTaskMetaRecord,
				"mark_path",
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
		if (
			replacePathField(
				imageGenerationTaskMetaRecord,
				"canvas_path",
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
		if (
			replaceReferenceImageOptionsPaths(
				imageGenerationTaskMeta.reference_image_options,
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
	}

	const generateHightImageRequest = element.generateHightImageRequest as
		| {
				file_path?: string
				reference_image_options?: Array<{ path?: string }>
		  }
		| undefined
	if (generateHightImageRequest && typeof generateHightImageRequest === "object") {
		if (
			replacePathField(
				generateHightImageRequest as Record<string, unknown>,
				"file_path",
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
		if (
			replaceReferenceImageOptionsPaths(
				generateHightImageRequest.reference_image_options,
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
	}

	return hasChanged
}

function replaceVideoElementPaths(
	element: Record<string, unknown>,
	oldWorkspaceRelativePath: string,
	newCanvasPath: string,
	designProjectBasePath?: string,
): boolean {
	let hasChanged = false

	if (
		replacePathField(
			element,
			"src",
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	) {
		hasChanged = true
	}

	const generateVideoRequest = element.generateVideoRequest as
		| {
				inputs?: {
					frames?: Array<{ uri?: string }>
					reference_images?: Array<{ uri?: string }>
					reference_videos?: Array<{ uri?: string }>
					reference_audios?: Array<{ uri?: string }>
					video?: { uri?: string }
					mask?: { uri?: string }
					audio?: Array<{ uri?: string }>
				}
		  }
		| undefined

	if (!generateVideoRequest || typeof generateVideoRequest !== "object") {
		return hasChanged
	}

	if (
		replaceUriItems(
			generateVideoRequest.inputs?.frames,
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	) {
		hasChanged = true
	}
	if (
		replaceUriItems(
			generateVideoRequest.inputs?.reference_images,
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	) {
		hasChanged = true
	}
	if (
		replaceUriItems(
			generateVideoRequest.inputs?.reference_videos,
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	) {
		hasChanged = true
	}
	if (
		replaceUriItems(
			generateVideoRequest.inputs?.reference_audios,
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	) {
		hasChanged = true
	}
	if (
		replaceUriItems(
			generateVideoRequest.inputs?.audio,
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	) {
		hasChanged = true
	}
	if (
		replacePathField(
			(generateVideoRequest.inputs?.video ?? {}) as Record<string, unknown>,
			"uri",
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	) {
		hasChanged = true
	}
	if (
		replacePathField(
			(generateVideoRequest.inputs?.mask ?? {}) as Record<string, unknown>,
			"uri",
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	) {
		hasChanged = true
	}

	return hasChanged
}

function replaceElementPaths(
	element: LayerElement,
	oldWorkspaceRelativePath: string,
	newCanvasPath: string,
	designProjectBasePath?: string,
): boolean {
	const elementRecord = element as unknown as Record<string, unknown>
	let hasChanged = false

	if (element.type === "image") {
		hasChanged = replaceImageElementPaths(
			elementRecord,
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	}

	if (element.type === "video") {
		hasChanged = replaceVideoElementPaths(
			elementRecord,
			oldWorkspaceRelativePath,
			newCanvasPath,
			designProjectBasePath,
		)
	}

	if ("children" in element && Array.isArray(element.children)) {
		for (const child of element.children) {
			if (
				replaceElementPaths(
					child,
					oldWorkspaceRelativePath,
					newCanvasPath,
					designProjectBasePath,
				)
			) {
				hasChanged = true
			}
		}
	}

	return hasChanged
}

export function replaceCanvasFilePathReferences(
	canvasData: CanvasDocument,
	options: ReplaceCanvasFilePathReferencesOptions,
): CanvasDocument {
	const { oldWorkspaceRelativePath, newCanvasPath, designProjectBasePath } = options
	if (!canvasData?.elements?.length || !oldWorkspaceRelativePath || !newCanvasPath) {
		return canvasData
	}

	const nextCanvasData = JSON.parse(JSON.stringify(canvasData)) as CanvasDocument
	const nextElements = nextCanvasData.elements
	let hasChanged = false

	if (!nextElements?.length) {
		return canvasData
	}

	for (const element of nextElements) {
		if (
			replaceElementPaths(
				element,
				oldWorkspaceRelativePath,
				newCanvasPath,
				designProjectBasePath,
			)
		) {
			hasChanged = true
		}
	}

	return hasChanged ? nextCanvasData : canvasData
}
