import type { Canvas } from "../../../runtime/core/Canvas"
import {
	type CropConfig,
	ElementTypeEnum,
	type TextElementContent,
} from "../../../runtime/document/types"
import {
	extractPlainTextFromRichText,
	extractPromptTextFromRichText,
} from "../../../runtime/text/richText"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import { getDownstreamContent } from "../../../runtime/document/elementContent"
import {
	getLinkedMediaReferenceIdentity,
	mergeLinkedMediaReferences,
	type LinkedMediaKind,
	type LinkedMediaReference,
} from "../../../runtime/shared/linkedMedia"
import { getLinkedTextPromptText, type LinkedTextConnection } from "./linkedTextPrompt"
import {
	collectConnectedSourceElements,
	type ConnectedInputSourceElement,
	type ConnectedSourceCollectionConfig,
} from "../../../runtime/interaction/connection/connectedInputSources"
import { resolveConnectedMediaCandidatesFromSources } from "../../../runtime/interaction/connection/connectedMediaInputs"

export {
	getLinkedMediaReferenceIdentity,
	mergeLinkedMediaPathsWithResolver,
	mergeLinkedMediaReferences,
} from "../../../runtime/shared/linkedMedia"

export {
	collectConnectedFrameSourceElements as collectLinkedFrameSourceElements,
	collectConnectedSourceElements as collectLinkedEditorSourceElements,
	collectConnectedUpstreamSourceElements as collectLinkedEditorUpstreamSourceElements,
	createConnectedFrameSourceId as createLinkedFrameSourceId,
	createConnectedUpstreamSourceId as createLinkedUpstreamSourceId,
} from "../../../runtime/interaction/connection/connectedInputSources"

export type LinkedEditorTargetKind = "image" | "video"
export type LinkedEditorMediaKind = LinkedMediaKind
export type LinkedEditorMediaStatus = "active" | "inactive"
export type LinkedEditorMediaInactiveReason =
	"unsupported-type" | "unsupported-mode" | "over-limit" | "missing-resource" | "duplicate"

export type LinkedEditorMediaReference = LinkedMediaReference

export interface LinkedEditorMediaPolicy {
	supportedKinds: LinkedEditorMediaKind[]
	manualReferences?: LinkedEditorMediaReference[]
	maxTotalCount?: number
	maxCountByKind?: Partial<Record<LinkedEditorMediaKind, number>>
	validateActiveReferences?: (
		references: LinkedEditorMediaReference[],
	) => LinkedEditorMediaInactiveReason | null
}

export interface LinkedEditorMediaCandidate {
	/**
	 * 关联输入的稳定 ID。一级直接元素等于真实连线 ID；多级元素与画框子元素使用派生 ID。
	 * 选择、排序和首尾帧绑定均以此 ID 为准。
	 */
	connectionId: string
	sourceElementId: string
	kind: LinkedEditorMediaKind
	path?: string
	fileName?: string
	sourceCrop?: CropConfig
	/** 本次关联解析命中的图片 Content；仅为运行时快照，不改变连接 DSL。 */
	sourceContentId?: string
	/** 直接连接根节点，用于将 Frame 子媒体归并到同一组。 */
	rootConnectionId?: string
	rootSourceElementId?: string
	origin?: ConnectedInputSourceElement["origin"]
	depth?: number
}

export interface LinkedEditorMediaItem extends LinkedEditorMediaCandidate {
	status: LinkedEditorMediaStatus
	reason?: LinkedEditorMediaInactiveReason
	/** 是否对应当前编辑器中的 mention；不代表一定通过媒体策略进入提交 */
	selected?: boolean
	/** 未选择项不可勾选时的动态原因（不作为媒体状态展示） */
	selectionDisabledReason?: LinkedEditorMediaInactiveReason
}

/** 按资源身份折叠连线媒体；同一路径存在多个连接时优先保留已选择项。 */
export function dedupeLinkedMediaItemsByPath<T extends LinkedEditorMediaItem>(
	items: T[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): T[] {
	const deduped: T[] = []
	const indexByIdentity = new Map<string, number>()
	for (const item of items) {
		const identity = getLinkedMediaReferenceIdentity(item.path, resolveResourceReference)
		if (!identity) continue
		const existingIndex = indexByIdentity.get(identity)
		if (existingIndex === undefined) {
			indexByIdentity.set(identity, deduped.length)
			deduped.push(item)
			continue
		}
		if (item.selected && !deduped[existingIndex]?.selected) {
			deduped[existingIndex] = item
		}
	}
	return deduped
}

export interface LinkedMediaDisplayResolution<TManual, TLinked extends LinkedEditorMediaItem> {
	manualItems: TManual[]
	linkedItems: Array<TLinked & { path: string }>
}

/**
 * 同一路径存在受支持的画布连接时，由关联卡片统一承载展示。
 * 类型或当前模式不支持的候选保留在关联解析中，但不进入 SourceList。
 */
export function resolveLinkedMediaDisplay<TManual, TLinked extends LinkedEditorMediaItem>(
	manualItems: TManual[],
	getManualPath: (item: TManual) => string,
	linkedItems: TLinked[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): LinkedMediaDisplayResolution<TManual, TLinked> {
	const visibleLinkedItems = dedupeLinkedMediaItemsByPath(
		linkedItems.filter(
			(item): item is TLinked & { path: string } =>
				Boolean(item.path) &&
				item.reason !== "unsupported-type" &&
				item.reason !== "unsupported-mode",
		),
		resolveResourceReference,
	)
	const linkedPathIdentities = new Set(
		visibleLinkedItems.map((item) =>
			getLinkedMediaReferenceIdentity(item.path, resolveResourceReference),
		),
	)

	return {
		manualItems: manualItems.filter(
			(item) =>
				!linkedPathIdentities.has(
					getLinkedMediaReferenceIdentity(getManualPath(item), resolveResourceReference),
				),
		),
		linkedItems: visibleLinkedItems,
	}
}

/** 关联卡片的勾选状态直接来自 mention 驱动的媒体解析结果。 */
export function resolveLinkedMediaSelectionDisplay(
	item: Pick<LinkedEditorMediaItem, "selected" | "selectionDisabledReason">,
): { checked: boolean; disabled: boolean } {
	const selected = item.selected === true
	return {
		checked: selected,
		disabled: !selected && Boolean(item.selectionDisabledReason),
	}
}

export interface LinkedEditorInputsResolution {
	connectedSourceElementIds: string[]
	textConnections: LinkedTextConnection[]
	textPrompt: string
	mediaItems: LinkedEditorMediaItem[]
	activeMediaReferences: LinkedEditorMediaReference[]
}

interface ResolveLinkedEditorInputsOptions {
	canvas: Canvas | null
	targetElementId: string
	targetKind: LinkedEditorTargetKind
	enabled?: boolean
	mediaPolicy?: LinkedEditorMediaPolicy
}

export type LinkedEditorSourceElement = ConnectedInputSourceElement
export type LinkedEditorSourceCollectionConfig = ConnectedSourceCollectionConfig

function getMediaSourceTypeUnsupportedReason(
	targetKind: LinkedEditorTargetKind,
	mediaKind: LinkedEditorMediaKind,
): LinkedEditorMediaInactiveReason | null {
	if (targetKind === "image" && mediaKind !== "image") return "unsupported-type"
	return null
}

function getFiniteLimit(value: number | undefined): number {
	return Number.isFinite(value) ? Math.max(0, Number(value)) : Infinity
}

export function resolveLinkedMediaItems(
	candidates: LinkedEditorMediaCandidate[],
	options: {
		targetKind: LinkedEditorTargetKind
		mediaPolicy?: LinkedEditorMediaPolicy
		resolveResourceReference?: ResolveCanvasResourceReference
	},
): LinkedEditorMediaItem[] {
	const { targetKind, mediaPolicy, resolveResourceReference } = options
	const supportedKindSet = new Set(mediaPolicy?.supportedKinds ?? [])
	const activePathSet = new Set<string>()
	const manualReferences = mediaPolicy?.manualReferences ?? []
	const activeReferences: LinkedEditorMediaReference[] = []

	const totalLimit = getFiniteLimit(mediaPolicy?.maxTotalCount)
	const activeCountByKind: Record<LinkedEditorMediaKind, number> = {
		image: 0,
		video: 0,
		audio: 0,
	}
	manualReferences.forEach((reference) => {
		const identity = getLinkedMediaReferenceIdentity(reference.path, resolveResourceReference)
		if (!identity || activePathSet.has(identity)) return
		activePathSet.add(identity)
		activeReferences.push(reference)
		activeCountByKind[reference.kind] += 1
	})
	const maxCountByKind = mediaPolicy?.maxCountByKind ?? {}

	return candidates.map((candidate) => {
		const targetUnsupportedReason = getMediaSourceTypeUnsupportedReason(
			targetKind,
			candidate.kind,
		)
		if (targetUnsupportedReason) {
			return { ...candidate, status: "inactive", reason: targetUnsupportedReason }
		}
		if (!candidate.path) {
			return { ...candidate, status: "inactive", reason: "missing-resource" }
		}
		if (!supportedKindSet.has(candidate.kind)) {
			return { ...candidate, status: "inactive", reason: "unsupported-mode" }
		}
		if (
			activePathSet.has(
				getLinkedMediaReferenceIdentity(candidate.path, resolveResourceReference),
			)
		) {
			return { ...candidate, status: "inactive", reason: "duplicate" }
		}
		if (activePathSet.size >= totalLimit) {
			return { ...candidate, status: "inactive", reason: "over-limit" }
		}

		const kindLimit = getFiniteLimit(maxCountByKind[candidate.kind])
		if (activeCountByKind[candidate.kind] >= kindLimit) {
			return { ...candidate, status: "inactive", reason: "over-limit" }
		}

		const nextReference = {
			kind: candidate.kind,
			path: candidate.path,
			sourceCrop: candidate.sourceCrop,
			sourceContentId: candidate.sourceContentId,
		}
		const validationReason = mediaPolicy?.validateActiveReferences?.([
			...activeReferences,
			nextReference,
		])
		if (validationReason) {
			return { ...candidate, status: "inactive", reason: validationReason }
		}

		activePathSet.add(getLinkedMediaReferenceIdentity(candidate.path, resolveResourceReference))
		activeReferences.push(nextReference)
		activeCountByKind[candidate.kind] += 1
		return { ...candidate, status: "active" }
	})
}

export interface LinkedEditorMediaSelectionResolution {
	items: LinkedEditorMediaItem[]
	activeMediaReferences: LinkedEditorMediaReference[]
}

export interface LinkedEditorMediaAssociationResolution extends LinkedEditorMediaSelectionResolution {
	mentionedReferencePaths: string[]
	unmatchedManualReferences: LinkedEditorMediaReference[]
}

export interface ResolveLinkedMediaAssociationOptions {
	candidates: LinkedEditorMediaCandidate[]
	mentionedPaths: string[]
	manualReferences?: LinkedEditorMediaReference[]
	targetKind: LinkedEditorTargetKind
	mediaPolicy?: LinkedEditorMediaPolicy
	resolveResourceReference?: ResolveCanvasResourceReference
}

/**
 * 以编辑器 mention 为唯一媒体选择状态，将画布连接媒体解析为候选展示与提交输入。
 * 同一路径最多绑定一个稳定候选；连接本身不参与状态持久化。
 */
export function resolveLinkedMediaAssociation(
	options: ResolveLinkedMediaAssociationOptions,
): LinkedEditorMediaAssociationResolution {
	const {
		candidates,
		mentionedPaths: mentionedReferencePaths,
		manualReferences = options.mediaPolicy?.manualReferences ?? [],
		targetKind,
		mediaPolicy,
		resolveResourceReference,
	} = options
	const effectiveMediaPolicy = mediaPolicy
		? { ...mediaPolicy, manualReferences }
		: manualReferences.length > 0
			? { supportedKinds: [], manualReferences }
			: undefined
	const selectionOptions = {
		targetKind,
		mediaPolicy: effectiveMediaPolicy,
		resolveResourceReference,
	}
	const stableCandidates: LinkedEditorMediaCandidate[] = []
	const candidateIdentities = new Set<string>()
	for (const candidate of candidates) {
		const identity = getLinkedMediaReferenceIdentity(candidate.path, resolveResourceReference)
		if (identity) {
			if (candidateIdentities.has(identity)) continue
			candidateIdentities.add(identity)
		}
		stableCandidates.push(candidate)
	}
	const mentionedPaths: string[] = []
	const mentionedIdentities = new Set<string>()
	mentionedReferencePaths.forEach((path) => {
		const identity = getLinkedMediaReferenceIdentity(path, resolveResourceReference)
		if (!identity || mentionedIdentities.has(identity)) return
		mentionedIdentities.add(identity)
		mentionedPaths.push(path)
	})

	const associatedConnectionIds = stableCandidates.flatMap((candidate) => {
		const identity = getLinkedMediaReferenceIdentity(candidate.path, resolveResourceReference)
		return identity && mentionedIdentities.has(identity) ? [candidate.connectionId] : []
	})
	const associatedConnectionIdSet = new Set(associatedConnectionIds)

	const selectionResolution = resolveLinkedMediaPolicySelection(
		stableCandidates,
		associatedConnectionIds,
		selectionOptions,
	)
	const items = selectionResolution.items.map((item) =>
		associatedConnectionIdSet.has(item.connectionId)
			? { ...item, selected: true, selectionDisabledReason: undefined }
			: item,
	)
	const unmatchedManualReferences = manualReferences.filter(
		(reference) =>
			!candidateIdentities.has(
				getLinkedMediaReferenceIdentity(reference.path, resolveResourceReference),
			),
	)
	const activeMediaReferences = mergeLinkedMediaReferences(
		manualReferences,
		selectionResolution.activeMediaReferences,
		resolveResourceReference,
	)

	return {
		items,
		activeMediaReferences,
		mentionedReferencePaths: mentionedPaths,
		unmatchedManualReferences,
	}
}

/**
 * 根据 mention 已匹配出的临时连接 ID 计算媒体策略结果。
 * 连接 ID 仅用于在一次纯函数计算中定位候选，不作为业务状态持久化或恢复。
 */
export function resolveLinkedMediaPolicySelection(
	candidates: LinkedEditorMediaCandidate[],
	mentionedConnectionIds: string[],
	options: {
		targetKind: LinkedEditorTargetKind
		mediaPolicy?: LinkedEditorMediaPolicy
		resolveResourceReference?: ResolveCanvasResourceReference
	},
): LinkedEditorMediaSelectionResolution {
	const { resolveResourceReference } = options
	const normalizedCandidates = candidates.map((candidate): LinkedEditorMediaCandidate => ({
		connectionId: candidate.connectionId,
		sourceElementId: candidate.sourceElementId,
		kind: candidate.kind,
		path: candidate.path,
		fileName: candidate.fileName,
		sourceCrop: candidate.sourceCrop,
		sourceContentId: candidate.sourceContentId,
		rootConnectionId: candidate.rootConnectionId,
		rootSourceElementId: candidate.rootSourceElementId,
		origin: candidate.origin,
		depth: candidate.depth,
	}))
	const selectedConnectionIdSet = new Set(mentionedConnectionIds)
	const selectedCandidates = normalizedCandidates.filter((candidate) =>
		selectedConnectionIdSet.has(candidate.connectionId),
	)
	const selectedPathIdentities = new Set(
		selectedCandidates.map((candidate) =>
			getLinkedMediaReferenceIdentity(candidate.path, resolveResourceReference),
		),
	)
	const selectedMediaPolicy = options.mediaPolicy
		? {
				...options.mediaPolicy,
				manualReferences: options.mediaPolicy.manualReferences?.filter(
					(reference) =>
						!selectedPathIdentities.has(
							getLinkedMediaReferenceIdentity(
								reference.path,
								resolveResourceReference,
							),
						),
				),
			}
		: undefined
	const selectedResolutionOptions = {
		targetKind: options.targetKind,
		mediaPolicy: selectedMediaPolicy,
		resolveResourceReference,
	}
	const selectedItems = resolveLinkedMediaItems(selectedCandidates, selectedResolutionOptions)
	const selectedItemById = new Map(selectedItems.map((item) => [item.connectionId, item]))

	const items = normalizedCandidates.map((candidate) => {
		const selectedItem = selectedItemById.get(candidate.connectionId)
		if (selectedItem?.status === "active") {
			return {
				...selectedItem,
				selected: true,
			}
		}

		const standaloneItem = resolveLinkedMediaItems([candidate], options)[0]
		const candidateIdentity = getLinkedMediaReferenceIdentity(
			candidate.path,
			resolveResourceReference,
		)
		const candidateSelectionOptions = {
			targetKind: options.targetKind,
			resolveResourceReference,
			mediaPolicy: options.mediaPolicy
				? {
						...options.mediaPolicy,
						manualReferences: options.mediaPolicy.manualReferences?.filter(
							(reference) =>
								getLinkedMediaReferenceIdentity(
									reference.path,
									resolveResourceReference,
								) !== candidateIdentity,
						),
					}
				: undefined,
		}
		const attemptItem = resolveLinkedMediaItems(
			[...selectedCandidates, candidate],
			candidateSelectionOptions,
		).find((item) => item.connectionId === candidate.connectionId)
		const standaloneReason = standaloneItem?.reason
		const selectionDisabledReason =
			standaloneReason &&
			standaloneReason !== "over-limit" &&
			standaloneReason !== "duplicate"
				? standaloneReason
				: attemptItem?.reason

		return {
			...candidate,
			status: "inactive" as const,
			reason:
				standaloneReason && standaloneReason !== "over-limit"
					? standaloneReason
					: undefined,
			selected: false,
			selectionDisabledReason,
		}
	})

	const activeMediaReferences = selectedItems
		.filter(
			(item): item is LinkedEditorMediaItem & { path: string } =>
				item.status === "active" && Boolean(item.path),
		)
		.map((item) => ({
			kind: item.kind,
			path: item.path,
			sourceCrop: item.sourceCrop,
			sourceContentId: item.sourceContentId,
		}))

	return { items, activeMediaReferences }
}

export function resolveLinkedEditorInputs(
	options: ResolveLinkedEditorInputsOptions,
): LinkedEditorInputsResolution {
	const { canvas, targetElementId, targetKind, enabled = true, mediaPolicy } = options
	const connectedSourceElementIds: string[] = []
	const textConnections: LinkedTextConnection[] = []
	const mediaCandidates: LinkedEditorMediaCandidate[] = []

	if (canvas && enabled) {
		const sourceElements = collectConnectedSourceElements(canvas, targetElementId)
		connectedSourceElementIds.push(...sourceElements.map((source) => source.sourceElementId))
		mediaCandidates.push(...resolveConnectedMediaCandidatesFromSources(sourceElements))
		sourceElements.forEach(({ connectionId, sourceElementId, element: sourceElement }) => {
			if (sourceElement.type === ElementTypeEnum.Text) {
				const content = getDownstreamContent<TextElementContent>(sourceElement)?.content
				if (!extractPlainTextFromRichText(content).trim()) return
				textConnections.push({
					connectionId,
					sourceElementId,
					text: extractPromptTextFromRichText(content),
				})
			}
		})
	}

	const mediaSelection = resolveLinkedMediaPolicySelection(mediaCandidates, [], {
		targetKind,
		mediaPolicy,
		resolveResourceReference:
			canvas?.magicConfigManager?.config?.methods?.resolveResourceReference,
	})
	return {
		connectedSourceElementIds,
		textConnections,
		textPrompt: getLinkedTextPromptText(textConnections),
		mediaItems: mediaSelection.items,
		activeMediaReferences: mediaSelection.activeMediaReferences,
	}
}
