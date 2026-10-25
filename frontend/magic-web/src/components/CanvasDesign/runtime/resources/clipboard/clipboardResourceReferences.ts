import type {
	AudioElement,
	ImageElement,
	ImageElementContent,
	LayerElement,
	VideoElement,
	VideoElementContent,
} from "../../document/types"
import { ElementTypeEnum } from "../../document/types"
import { getCanvasResourceReferenceIdentity } from "../../shared/path/canvasResourcePath"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"

export interface ClipboardResourceReference {
	path: string
	identity: string
	aliases: string[]
	isSelfReferenceOnly?: boolean
}

type MutableRecord = Record<string, unknown>

const REMOTE_OR_SPECIAL_PATH_PATTERN =
	/^(https?:|data:|blob:|file:|mailto:|tel:|about:|javascript:)/i

function asRecord(value: unknown): MutableRecord | null {
	return value && typeof value === "object" ? (value as MutableRecord) : null
}

function normalizeResourcePath(value: unknown): string | null {
	if (typeof value !== "string") return null
	const path = value.trim()
	if (!path || REMOTE_OR_SPECIAL_PATH_PATTERN.test(path)) return null
	return path
}

export function getClipboardResourcePathKey(
	value: unknown,
	resolveResourceReference?: ResolveCanvasResourceReference,
): string | null {
	const path = normalizeResourcePath(value)
	if (!path) return null
	return getCanvasResourceReferenceIdentity(path, resolveResourceReference)
}

function addPath(
	refs: ClipboardResourceReference[],
	seen: Map<string, ClipboardResourceReference>,
	value: unknown,
	ownerSourcePath?: string | null,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	const path = normalizeResourcePath(value)
	if (!path) return

	const pathKey = getClipboardResourcePathKey(path, resolveResourceReference)
	if (!pathKey) return

	const isSelfReference =
		getClipboardResourcePathKey(ownerSourcePath, resolveResourceReference) === pathKey
	const existing = seen.get(pathKey)
	if (existing) {
		if (!existing.aliases.includes(path)) existing.aliases.push(path)
		if (!isSelfReference) {
			if (existing.isSelfReferenceOnly) {
				existing.path = path
			}
			existing.isSelfReferenceOnly = false
		}
		return
	}

	const ref: ClipboardResourceReference = {
		path,
		identity: pathKey,
		aliases: [path],
		isSelfReferenceOnly: isSelfReference,
	}
	seen.set(pathKey, ref)
	refs.push(ref)
}

function collectPathArray(
	refs: ClipboardResourceReference[],
	seen: Map<string, ClipboardResourceReference>,
	value: unknown,
	ownerSourcePath?: string | null,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	if (!Array.isArray(value)) return
	for (const item of value) {
		addPath(refs, seen, item, ownerSourcePath, resolveResourceReference)
	}
}

function collectPathFieldArray(
	refs: ClipboardResourceReference[],
	seen: Map<string, ClipboardResourceReference>,
	value: unknown,
	field: string,
	ownerSourcePath?: string | null,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	if (!Array.isArray(value)) return
	for (const item of value) {
		addPath(refs, seen, asRecord(item)?.[field], ownerSourcePath, resolveResourceReference)
	}
}

function collectImageContentResourceReferences(
	content: ImageElementContent,
	refs: ClipboardResourceReference[],
	seen: Map<string, ClipboardResourceReference>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	const ownerSourcePath = normalizeResourcePath(content.src)
	addPath(refs, seen, content.src, ownerSourcePath, resolveResourceReference)
	const generateImageRequest = asRecord(content.generateImageRequest)
	if (generateImageRequest) {
		collectPathArray(
			refs,
			seen,
			generateImageRequest.reference_images,
			ownerSourcePath,
			resolveResourceReference,
		)
		collectPathFieldArray(
			refs,
			seen,
			generateImageRequest.reference_image_options,
			"path",
			ownerSourcePath,
			resolveResourceReference,
		)
	}

	const imageGenerationTaskMeta = asRecord(content.imageGenerationTaskMeta)
	if (imageGenerationTaskMeta) {
		addPath(
			refs,
			seen,
			imageGenerationTaskMeta.file_path,
			ownerSourcePath,
			resolveResourceReference,
		)
		// 生成辅助图属于 private upload，不是可复制的工作区资源引用。
		collectPathFieldArray(
			refs,
			seen,
			imageGenerationTaskMeta.reference_image_options,
			"path",
			ownerSourcePath,
			resolveResourceReference,
		)
	}
}

function collectVideoContentResourceReferences(
	content: VideoElementContent,
	refs: ClipboardResourceReference[],
	seen: Map<string, ClipboardResourceReference>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	const ownerSourcePath = normalizeResourcePath(content.src)
	addPath(refs, seen, content.src, ownerSourcePath, resolveResourceReference)
	const generateVideoRequest = asRecord(content.generateVideoRequest)
	const inputs = asRecord(generateVideoRequest?.inputs)
	if (!inputs) return

	collectPathFieldArray(
		refs,
		seen,
		inputs.frames,
		"uri",
		ownerSourcePath,
		resolveResourceReference,
	)
	collectPathFieldArray(
		refs,
		seen,
		inputs.reference_images,
		"uri",
		ownerSourcePath,
		resolveResourceReference,
	)
	collectPathFieldArray(
		refs,
		seen,
		inputs.reference_videos,
		"uri",
		ownerSourcePath,
		resolveResourceReference,
	)
	collectPathFieldArray(
		refs,
		seen,
		inputs.reference_audios,
		"uri",
		ownerSourcePath,
		resolveResourceReference,
	)
	collectPathFieldArray(
		refs,
		seen,
		inputs.audio,
		"uri",
		ownerSourcePath,
		resolveResourceReference,
	)
	addPath(refs, seen, asRecord(inputs.video)?.uri, ownerSourcePath, resolveResourceReference)
	addPath(refs, seen, asRecord(inputs.mask)?.uri, ownerSourcePath, resolveResourceReference)
	addPath(refs, seen, asRecord(inputs.draft_task)?.uri, ownerSourcePath, resolveResourceReference)
}

function collectElementReferences(
	element: LayerElement,
	refs: ClipboardResourceReference[],
	seen: Map<string, ClipboardResourceReference>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): void {
	if (element.type === ElementTypeEnum.Image) {
		for (const content of element.contents) {
			collectImageContentResourceReferences(content, refs, seen, resolveResourceReference)
		}
	}

	if (element.type === ElementTypeEnum.Video) {
		for (const content of element.contents) {
			collectVideoContentResourceReferences(content, refs, seen, resolveResourceReference)
		}
	}

	if (element.type === ElementTypeEnum.Audio) {
		for (const content of (element as AudioElement).contents) {
			addPath(refs, seen, content.src, content.src, resolveResourceReference)
		}
	}

	if ("children" in element && Array.isArray(element.children)) {
		for (const child of element.children) {
			collectElementReferences(child, refs, seen, resolveResourceReference)
		}
	}
}

export function collectElementResourceReferences(
	elements: LayerElement[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): ClipboardResourceReference[] {
	const refs: ClipboardResourceReference[] = []
	const seen = new Map<string, ClipboardResourceReference>()
	for (const element of elements) {
		collectElementReferences(element, refs, seen, resolveResourceReference)
	}
	return refs
}

export function addClipboardResourceAliasMappings(
	pathMap: Map<string, string>,
	resourcePath: string,
	aliases: readonly string[] | undefined,
	replacement: string,
): void {
	pathMap.set(resourcePath, replacement)
	aliases?.forEach((alias) => {
		const normalizedAlias = normalizeResourcePath(alias)
		if (normalizedAlias) pathMap.set(normalizedAlias, replacement)
	})
}

function resolveReplacement(
	value: unknown,
	pathMap: ReadonlyMap<string, string>,
	replacementByIdentity: ReadonlyMap<string, string>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): string | null {
	const path = normalizeResourcePath(value)
	if (!path) return null
	const exactReplacement = pathMap.get(path)
	if (exactReplacement) return exactReplacement

	const pathKey = getClipboardResourcePathKey(path, resolveResourceReference)
	if (!pathKey) return null
	return replacementByIdentity.get(pathKey) ?? null
}

function createReplacementIdentityIndex(
	pathMap: ReadonlyMap<string, string>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): ReadonlyMap<string, string> {
	const replacementByIdentity = new Map<string, string>()
	for (const [sourcePath, replacement] of pathMap.entries()) {
		const identity = getClipboardResourcePathKey(sourcePath, resolveResourceReference)
		if (identity && !replacementByIdentity.has(identity)) {
			replacementByIdentity.set(identity, replacement)
		}
	}
	return replacementByIdentity
}

function rewritePathField(
	target: MutableRecord | null,
	field: string,
	pathMap: ReadonlyMap<string, string>,
	replacementByIdentity: ReadonlyMap<string, string>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	if (!target) return false
	const replacement = resolveReplacement(
		target[field],
		pathMap,
		replacementByIdentity,
		resolveResourceReference,
	)
	if (!replacement) return false
	target[field] = replacement
	return true
}

function rewritePathArray(
	value: unknown,
	pathMap: ReadonlyMap<string, string>,
	replacementByIdentity: ReadonlyMap<string, string>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	if (!Array.isArray(value)) return false

	let hasChanged = false
	for (let index = 0; index < value.length; index += 1) {
		const replacement = resolveReplacement(
			value[index],
			pathMap,
			replacementByIdentity,
			resolveResourceReference,
		)
		if (!replacement) continue
		value[index] = replacement
		hasChanged = true
	}
	return hasChanged
}

function rewritePathFieldArray(
	value: unknown,
	field: string,
	pathMap: ReadonlyMap<string, string>,
	replacementByIdentity: ReadonlyMap<string, string>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	if (!Array.isArray(value)) return false

	let hasChanged = false
	for (const item of value) {
		if (
			rewritePathField(
				asRecord(item),
				field,
				pathMap,
				replacementByIdentity,
				resolveResourceReference,
			)
		) {
			hasChanged = true
		}
	}
	return hasChanged
}

function rewriteImageResourceReferences(
	element: ImageElement,
	pathMap: ReadonlyMap<string, string>,
	replacementByIdentity: ReadonlyMap<string, string>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	let hasChanged = false
	for (const content of Array.isArray(element.contents) ? element.contents : []) {
		const contentRecord = content as unknown as MutableRecord
		hasChanged =
			rewritePathField(
				contentRecord,
				"src",
				pathMap,
				replacementByIdentity,
				resolveResourceReference,
			) || hasChanged
		const generateImageRequest = asRecord(content.generateImageRequest)
		if (generateImageRequest) {
			if (
				rewritePathArray(
					generateImageRequest.reference_images,
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			)
				hasChanged = true
			if (
				rewritePathFieldArray(
					generateImageRequest.reference_image_options,
					"path",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			) {
				hasChanged = true
			}
			delete generateImageRequest.project_id
			delete generateImageRequest.file_dir
			delete generateImageRequest.file_name
		}

		const imageGenerationTaskMeta = asRecord(content.imageGenerationTaskMeta)
		if (imageGenerationTaskMeta) {
			if (
				rewritePathField(
					imageGenerationTaskMeta,
					"file_path",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			)
				hasChanged = true
			// private-upload 字段保留原值，不进入工作区 identity / rewrite 管道。
			if (
				rewritePathFieldArray(
					imageGenerationTaskMeta.reference_image_options,
					"path",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			) {
				hasChanged = true
			}
			delete imageGenerationTaskMeta.project_id
			delete imageGenerationTaskMeta.file_dir
			delete imageGenerationTaskMeta.file_name
		}
	}

	return hasChanged
}

function rewriteVideoResourceReferences(
	element: VideoElement,
	pathMap: ReadonlyMap<string, string>,
	replacementByIdentity: ReadonlyMap<string, string>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	let hasChanged = false
	for (const content of Array.isArray(element.contents) ? element.contents : []) {
		hasChanged =
			rewritePathField(
				content as unknown as MutableRecord,
				"src",
				pathMap,
				replacementByIdentity,
				resolveResourceReference,
			) || hasChanged
		const generateVideoRequest = asRecord(content.generateVideoRequest)
		const inputs = asRecord(generateVideoRequest?.inputs)
		if (inputs) {
			if (
				rewritePathFieldArray(
					inputs.frames,
					"uri",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			)
				hasChanged = true
			if (
				rewritePathFieldArray(
					inputs.reference_images,
					"uri",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			)
				hasChanged = true
			if (
				rewritePathFieldArray(
					inputs.reference_videos,
					"uri",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			)
				hasChanged = true
			if (
				rewritePathFieldArray(
					inputs.reference_audios,
					"uri",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			)
				hasChanged = true
			if (
				rewritePathFieldArray(
					inputs.audio,
					"uri",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			)
				hasChanged = true
			if (
				rewritePathField(
					asRecord(inputs.video),
					"uri",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			)
				hasChanged = true
			if (
				rewritePathField(
					asRecord(inputs.mask),
					"uri",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			)
				hasChanged = true
			if (
				rewritePathField(
					asRecord(inputs.draft_task),
					"uri",
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				)
			)
				hasChanged = true
		}

		if (generateVideoRequest) {
			delete generateVideoRequest.project_id
			delete generateVideoRequest.file_dir
			delete generateVideoRequest.file_name
		}
	}

	const rootGenerateVideoRequest = asRecord(
		(element as unknown as { generateVideoRequest?: unknown }).generateVideoRequest,
	)
	const rootInputs = asRecord(rootGenerateVideoRequest?.inputs)
	if (rootInputs) {
		if (
			rewritePathFieldArray(
				rootInputs.reference_videos,
				"uri",
				pathMap,
				replacementByIdentity,
				resolveResourceReference,
			)
		) {
			hasChanged = true
		}
	}
	if (rootGenerateVideoRequest) {
		delete rootGenerateVideoRequest.project_id
		delete rootGenerateVideoRequest.file_dir
		delete rootGenerateVideoRequest.file_name
	}

	return hasChanged
}

function rewriteAudioResourceReferences(
	element: AudioElement,
	pathMap: ReadonlyMap<string, string>,
	replacementByIdentity: ReadonlyMap<string, string>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	return element.contents.reduce(
		(hasChanged, content) =>
			rewritePathField(
				content as unknown as MutableRecord,
				"src",
				pathMap,
				replacementByIdentity,
				resolveResourceReference,
			) || hasChanged,
		false,
	)
}

function rewriteElementResourceReferencesWithIndex(
	element: LayerElement,
	pathMap: ReadonlyMap<string, string>,
	replacementByIdentity: ReadonlyMap<string, string>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	let hasChanged = false

	if (element.type === ElementTypeEnum.Image) {
		hasChanged =
			rewriteImageResourceReferences(
				element,
				pathMap,
				replacementByIdentity,
				resolveResourceReference,
			) || hasChanged
	}

	if (element.type === ElementTypeEnum.Video) {
		hasChanged =
			rewriteVideoResourceReferences(
				element,
				pathMap,
				replacementByIdentity,
				resolveResourceReference,
			) || hasChanged
	}

	if (element.type === ElementTypeEnum.Audio) {
		hasChanged =
			rewriteAudioResourceReferences(
				element,
				pathMap,
				replacementByIdentity,
				resolveResourceReference,
			) || hasChanged
	}

	if ("children" in element && Array.isArray(element.children)) {
		for (const child of element.children) {
			hasChanged =
				rewriteElementResourceReferencesWithIndex(
					child,
					pathMap,
					replacementByIdentity,
					resolveResourceReference,
				) || hasChanged
		}
	}

	return hasChanged
}

export function rewriteElementResourceReferences(
	element: LayerElement,
	pathMap: ReadonlyMap<string, string>,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	return rewriteElementResourceReferencesWithIndex(
		element,
		pathMap,
		createReplacementIdentityIndex(pathMap, resolveResourceReference),
		resolveResourceReference,
	)
}
