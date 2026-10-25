import type { CanvasDocument, LayerElement } from "@/components/CanvasDesign/runtime/document/types"
import { type ImageGenerationTaskMeta } from "@/components/CanvasDesign/public/magic-types"
import type { ResolveCanvasResourceReference } from "@/components/CanvasDesign/public/resource-reference"
import { isLegacyBareDesignResourcePath } from "./designPath"
import { isOpaqueAssetReference } from "@/components/CanvasDesign/runtime/shared/path/canvasResourcePath"

interface ReplaceCanvasFilePathReferencesOptions {
	oldWorkspaceRelativePath: string
	newCanvasPath: string
	resolveResourceReference: ResolveCanvasResourceReference
	/** 文件改名不改变 asset 身份；保持稳定引用，不将它转换成路径。 */
	preserveAssetReferences?: boolean
}

interface PathReplacementContext {
	oldIdentity: string
	newCanvasPath: string
	resolveResourceReference: ResolveCanvasResourceReference
	unsafeReferenceFound: boolean
	preserveAssetReferences?: boolean
}

export interface CanvasFilePathReplacementResult {
	status: "replaced" | "unchanged" | "unsafe"
	canvasData: CanvasDocument
}

function asRecord(value: object): Record<string, unknown> {
	return value as unknown as Record<string, unknown>
}

function shouldReplacePath(value: unknown, context: PathReplacementContext): value is string {
	if (typeof value !== "string" || !value.trim()) return false
	if (context.preserveAssetReferences && isOpaqueAssetReference(value)) return false
	const mode = isLegacyBareDesignResourcePath(value) ? "legacy-recovery" : "strict-current-canvas"

	const resolution = context.resolveResourceReference(
		{
			namespace: "canvas-storage",
			path: value,
			mode,
		},
		{ requireAttachment: true },
	)
	if (
		mode === "legacy-recovery" &&
		resolution.status !== "resolved" &&
		resolution.candidates.some((candidate) => `workspace:${candidate}` === context.oldIdentity)
	) {
		context.unsafeReferenceFound = true
	}
	return resolution.status === "resolved" && resolution.identity === context.oldIdentity
}

function replacePathField(
	target: Record<string, unknown>,
	key: string,
	context: PathReplacementContext,
): boolean {
	if (!shouldReplacePath(target[key], context)) {
		return false
	}

	target[key] = context.newCanvasPath
	return true
}

function replaceReferenceImageOptionsPaths(
	value: unknown,
	context: PathReplacementContext,
): boolean {
	if (!Array.isArray(value) || value.length === 0) return false

	let hasChanged = false
	for (const item of value) {
		if (!item || typeof item !== "object") continue
		if (replacePathField(item as Record<string, unknown>, "path", context)) {
			hasChanged = true
		}
	}

	return hasChanged
}

function replaceUriItems(value: unknown, context: PathReplacementContext): boolean {
	if (!Array.isArray(value) || value.length === 0) return false

	let hasChanged = false
	for (const item of value) {
		if (!item || typeof item !== "object") continue
		if (replacePathField(item as Record<string, unknown>, "uri", context)) {
			hasChanged = true
		}
	}

	return hasChanged
}

function replaceImageContentPaths(
	content: Record<string, unknown>,
	context: PathReplacementContext,
): boolean {
	let hasChanged = false
	if (replacePathField(content, "src", context)) {
		hasChanged = true
	}

	const generateImageRequest = content.generateImageRequest as
		| {
				reference_images?: string[]
				reference_image_options?: Array<{ path?: string }>
		  }
		| undefined

	if (generateImageRequest && typeof generateImageRequest === "object") {
		if (Array.isArray(generateImageRequest.reference_images)) {
			const nextReferenceImages = generateImageRequest.reference_images.map((path) => {
				if (!shouldReplacePath(path, context)) {
					return path
				}

				hasChanged = true
				return context.newCanvasPath
			})
			generateImageRequest.reference_images = nextReferenceImages
		}

		if (
			replaceReferenceImageOptionsPaths(generateImageRequest.reference_image_options, context)
		) {
			hasChanged = true
		}
	}

	const imageGenerationTaskMeta = content.imageGenerationTaskMeta as
		ImageGenerationTaskMeta | undefined
	if (imageGenerationTaskMeta && typeof imageGenerationTaskMeta === "object") {
		const imageGenerationTaskMetaRecord = asRecord(imageGenerationTaskMeta)

		if (replacePathField(imageGenerationTaskMetaRecord, "file_path", context)) {
			hasChanged = true
		}
		// canvas_path / mask_path / mark_path 属于 private upload，不随工作区附件重命名。
		if (
			replaceReferenceImageOptionsPaths(
				imageGenerationTaskMeta.reference_image_options,
				context,
			)
		) {
			hasChanged = true
		}
	}

	return hasChanged
}

function replaceVideoContentPaths(
	content: Record<string, unknown>,
	context: PathReplacementContext,
): boolean {
	let hasChanged = false

	if (replacePathField(content, "src", context)) {
		hasChanged = true
	}

	const generateVideoRequest = content.generateVideoRequest as
		| {
				inputs?: {
					frames?: Array<{ uri?: string }>
					reference_images?: Array<{ uri?: string }>
					reference_videos?: Array<{ uri?: string }>
					reference_audios?: Array<{ uri?: string }>
					video?: { uri?: string }
					mask?: { uri?: string }
					draft_task?: { video_id?: string; uri?: string }
					audio?: Array<{ uri?: string }>
				}
		  }
		| undefined

	if (!generateVideoRequest || typeof generateVideoRequest !== "object") {
		return hasChanged
	}

	if (replaceUriItems(generateVideoRequest.inputs?.frames, context)) {
		hasChanged = true
	}
	if (replaceUriItems(generateVideoRequest.inputs?.reference_images, context)) {
		hasChanged = true
	}
	if (replaceUriItems(generateVideoRequest.inputs?.reference_videos, context)) {
		hasChanged = true
	}
	if (replaceUriItems(generateVideoRequest.inputs?.reference_audios, context)) {
		hasChanged = true
	}
	if (replaceUriItems(generateVideoRequest.inputs?.audio, context)) {
		hasChanged = true
	}
	if (
		replacePathField(
			(generateVideoRequest.inputs?.video ?? {}) as Record<string, unknown>,
			"uri",
			context,
		)
	) {
		hasChanged = true
	}
	if (
		replacePathField(
			(generateVideoRequest.inputs?.mask ?? {}) as Record<string, unknown>,
			"uri",
			context,
		)
	) {
		hasChanged = true
	}
	if (
		replacePathField(
			(generateVideoRequest.inputs?.draft_task ?? {}) as Record<string, unknown>,
			"uri",
			context,
		)
	) {
		hasChanged = true
	}

	return hasChanged
}

function replaceElementPaths(element: LayerElement, context: PathReplacementContext): boolean {
	let hasChanged = false

	if (element.type === "image") {
		for (const content of element.contents) {
			if (content && typeof content === "object") {
				hasChanged =
					replaceImageContentPaths(
						content as unknown as Record<string, unknown>,
						context,
					) || hasChanged
			}
		}
	}

	if (element.type === "video") {
		for (const content of element.contents) {
			if (content && typeof content === "object") {
				hasChanged =
					replaceVideoContentPaths(
						content as unknown as Record<string, unknown>,
						context,
					) || hasChanged
			}
		}
	}

	if (element.type === "audio") {
		for (const content of element.contents) {
			if (content && typeof content === "object") {
				hasChanged =
					replacePathField(
						content as unknown as Record<string, unknown>,
						"src",
						context,
					) || hasChanged
			}
		}
	}

	if ("children" in element && Array.isArray(element.children)) {
		for (const child of element.children) {
			if (replaceElementPaths(child, context)) {
				hasChanged = true
			}
		}
	}

	return hasChanged
}

export function getCanvasFilePathReplacementResult(
	canvasData: CanvasDocument,
	options: ReplaceCanvasFilePathReferencesOptions,
): CanvasFilePathReplacementResult {
	const { oldWorkspaceRelativePath, newCanvasPath, resolveResourceReference } = options
	if (!canvasData?.elements?.length || !oldWorkspaceRelativePath || !newCanvasPath) {
		return { status: "unchanged", canvasData }
	}
	const oldResolution = resolveResourceReference({
		namespace: "workspace-path",
		path: oldWorkspaceRelativePath,
	})
	if (oldResolution.status !== "resolved" || oldResolution.resourceKind !== "workspace-file") {
		return { status: "unchanged", canvasData }
	}
	const context: PathReplacementContext = {
		oldIdentity: oldResolution.identity,
		newCanvasPath,
		resolveResourceReference,
		unsafeReferenceFound: false,
		preserveAssetReferences: options.preserveAssetReferences,
	}

	const nextCanvasData = JSON.parse(JSON.stringify(canvasData)) as CanvasDocument
	const nextElements = nextCanvasData.elements
	let hasChanged = false

	if (!nextElements?.length) {
		return { status: "unchanged", canvasData }
	}

	for (const element of nextElements) {
		if (replaceElementPaths(element, context)) {
			hasChanged = true
		}
	}

	if (context.unsafeReferenceFound) return { status: "unsafe", canvasData }
	return hasChanged
		? { status: "replaced", canvasData: nextCanvasData }
		: { status: "unchanged", canvasData }
}

export function replaceCanvasFilePathReferences(
	canvasData: CanvasDocument,
	options: ReplaceCanvasFilePathReferencesOptions,
): CanvasDocument {
	return getCanvasFilePathReplacementResult(canvasData, options).canvasData
}
