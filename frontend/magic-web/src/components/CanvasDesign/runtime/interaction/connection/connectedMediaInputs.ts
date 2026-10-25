import type { Canvas } from "../../core/Canvas"
import {
	getDownstreamContent,
	getUsableDownstreamImageContent,
	isImageContentUsableDownstream,
} from "../../document/elementContent"
import {
	type AudioElementContent,
	type CropConfig,
	ElementTypeEnum,
	type ImageElement,
	type ImageElementContent,
	type LayerElement,
	type VideoElementContent,
} from "../../document/types"
import { getCanvasResourceFileName } from "../../shared/path/canvasResourcePath"
import {
	mergeLinkedMediaReferences,
	type LinkedMediaKind,
	type LinkedMediaReference,
} from "../../shared/linkedMedia"
import {
	collectConnectedSourceElements,
	type ConnectedInputSourceElement,
	type ConnectedSourceCollectionConfig,
} from "./connectedInputSources"

export interface ConnectedMediaCandidate {
	/** Stable candidate identity; direct candidates use the persisted edge ID. */
	connectionId: string
	sourceElementId: string
	/** Source snapshot; needed when a Frame/Group descendant is not registered as a top-level element. */
	element?: LayerElement
	kind: LinkedMediaKind
	path?: string
	fileName?: string
	sourceCrop?: CropConfig
	sourceContentId?: string
	rootConnectionId?: string
	rootSourceElementId?: string
	origin?: ConnectedInputSourceElement["origin"]
	depth?: number
}

export interface ConnectedMediaResolverOptions {
	resolveImageContent?: (element: ImageElement) => ImageElementContent | undefined
}

function getFileName(path: string): string {
	return getCanvasResourceFileName(path) || path
}

function createCandidate(
	source: ConnectedInputSourceElement,
	media: Omit<ConnectedMediaCandidate, "connectionId" | "sourceElementId" | "element">,
): ConnectedMediaCandidate {
	return {
		connectionId: source.connectionId,
		sourceElementId: source.sourceElementId,
		element: source.element,
		rootConnectionId: source.rootConnectionId,
		rootSourceElementId: source.rootSourceElementId,
		origin: source.origin,
		depth: source.depth,
		...media,
	}
}

export function resolveConnectedMediaCandidatesFromSources(
	sources: ConnectedInputSourceElement[],
	options?: ConnectedMediaResolverOptions,
): ConnectedMediaCandidate[] {
	return sources.flatMap((source) => {
		const sourceElement: LayerElement = source.element
		if (sourceElement.type === ElementTypeEnum.Image) {
			const resolvedContent =
				options?.resolveImageContent?.(sourceElement) ??
				getUsableDownstreamImageContent(sourceElement)
			const content = isImageContentUsableDownstream(resolvedContent)
				? resolvedContent
				: undefined
			const path = content?.src
			return [
				createCandidate(source, {
					kind: "image",
					path,
					fileName: path ? getFileName(path) : undefined,
					sourceCrop: content?.crop,
					sourceContentId: content?.contentId,
				}),
			]
		}

		if (sourceElement.type === ElementTypeEnum.Video) {
			const content = getDownstreamContent<VideoElementContent>(sourceElement)
			const path = content?.src
			return [
				createCandidate(source, {
					kind: "video",
					path,
					fileName: path ? getFileName(path) : undefined,
					sourceContentId: content?.contentId,
				}),
			]
		}

		if (sourceElement.type === ElementTypeEnum.Audio) {
			const content = getDownstreamContent<AudioElementContent>(sourceElement)
			const path = content?.src
			return [
				createCandidate(source, {
					kind: "audio",
					path,
					fileName: path ? getFileName(path) : undefined,
					sourceContentId: content?.contentId,
				}),
			]
		}

		return []
	})
}

export function resolveConnectedMediaCandidates(
	canvas: Canvas,
	targetElementId: string,
	config?: ConnectedSourceCollectionConfig,
	options?: ConnectedMediaResolverOptions,
): ConnectedMediaCandidate[] {
	return resolveConnectedMediaCandidatesFromSources(
		collectConnectedSourceElements(canvas, targetElementId, config),
		options,
	)
}

export interface ConnectedImageReferencesResolution {
	candidates: ConnectedMediaCandidate[]
	references: LinkedMediaReference[]
}

/** Resolve all connected image references with the same path identity rules. */
export function resolveConnectedImageReferences(
	canvas: Canvas,
	targetElementId: string,
	options?: {
		collection?: ConnectedSourceCollectionConfig
		resolveResourceReference?: Parameters<typeof mergeLinkedMediaReferences>[2]
	} & ConnectedMediaResolverOptions,
): ConnectedImageReferencesResolution {
	const candidates = resolveConnectedMediaCandidates(
		canvas,
		targetElementId,
		options?.collection,
		options,
	).filter((candidate) => candidate.kind === "image")
	const linkedReferences = candidates.flatMap((candidate) =>
		candidate.path
			? [
					{
						kind: "image" as const,
						path: candidate.path,
						sourceCrop: candidate.sourceCrop,
						sourceContentId: candidate.sourceContentId,
					},
				]
			: [],
	)

	return {
		candidates,
		references: mergeLinkedMediaReferences(
			[],
			linkedReferences,
			options?.resolveResourceReference,
		),
	}
}
