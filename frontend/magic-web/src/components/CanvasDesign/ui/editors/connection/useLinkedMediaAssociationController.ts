import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import type { MessageEditorMentionChangeContext, MessageEditorRef } from "../message/MessageEditor"
import type { LinkedEditorMediaPolicy, LinkedEditorTargetKind } from "./linkedEditorInputs"
import { useLinkedEditorInputs } from "./useLinkedEditorInputs"
import { useLinkedMediaMentionSelection } from "./useLinkedMediaMentionSelection"
import { reconcileMentionPathsWithPersistedReferences } from "../message/mentionPathReconciliation"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import {
	resolveInitialLinkedEditorAssociation,
	type LinkedEditorMediaPolicyStatus,
} from "./resolveInitialLinkedEditorAssociation"
import type { ReferenceResourceMetadataCandidate } from "../message/reference-assets/referenceResourceDescriptor"

interface UseLinkedMediaAssociationControllerOptions {
	readOnly?: boolean
	targetElementId: string
	targetKind: LinkedEditorTargetKind
	mediaPolicy?: LinkedEditorMediaPolicy
	mediaPolicyStatus: LinkedEditorMediaPolicyStatus
	editorRef: RefObject<MessageEditorRef | null>
	onReadyMentionChange?: (
		paths: string[],
		currentPrompt: string,
		context: MessageEditorMentionChangeContext,
		metadataCandidates?: readonly ReferenceResourceMetadataCandidate[],
	) => void
	resolveResourceReference?: ResolveCanvasResourceReference
}

/** 图片与视频编辑器共用的 mention 驱动关联媒体 controller。 */
export function useLinkedMediaAssociationController(
	options: UseLinkedMediaAssociationControllerOptions,
) {
	const { canvas } = useCanvas()
	const {
		readOnly = false,
		targetElementId,
		targetKind,
		mediaPolicy,
		mediaPolicyStatus,
		editorRef,
		onReadyMentionChange,
		resolveResourceReference,
	} = options
	const [mentionedReferencePaths, setMentionedReferencePaths] = useState<string[]>([])
	const [mentionReadyTargetElementId, setMentionReadyTargetElementId] = useState<string | null>(
		null,
	)
	const pendingSyncRef = useRef<{ revision: number; token: number } | null>(null)
	const syncTokenRef = useRef(0)
	const acceptedSyncTokenRef = useRef(0)
	const linkedEditorInputs = useLinkedEditorInputs({
		targetElementId,
		targetKind,
		mediaPolicy,
		mentionedReferencePaths,
	})
	const {
		connectedSourceElementIds,
		mediaItems,
		activeMediaReferences = [],
		setTextConnectionSelected,
		textConnections,
		canSelectMediaConnection,
	} = linkedEditorInputs
	const handleLinkedMediaSelectionChange = useLinkedMediaMentionSelection({
		mediaItems,
		mentionedReferencePaths,
		canSelectMediaConnection,
		editorRef,
		resolveResourceReference,
	})
	const handleMentionChange = useCallback(
		(paths: string[], currentPrompt: string, context: MessageEditorMentionChangeContext) => {
			if (context.status === "pending") {
				if (context.source === "sync") {
					pendingSyncRef.current = {
						revision: context.revision,
						token: (syncTokenRef.current += 1),
					}
				}
				return false
			}
			if (context.source === "sync") {
				const pendingSync = pendingSyncRef.current
				if (
					!pendingSync ||
					pendingSync.revision !== context.revision ||
					pendingSync.token === acceptedSyncTokenRef.current
				) {
					return false
				}
				acceptedSyncTokenRef.current = pendingSync.token
			}
			// 编辑器组件可能复用于不同目标，ready 必须绑定当前元素，避免沿用上一个元素的状态。
			setMentionReadyTargetElementId(targetElementId)
			const persistedPaths =
				mediaPolicy?.manualReferences?.map((reference) => reference.path) ?? []
			const reconciledPaths = reconcileMentionPathsWithPersistedReferences({
				incomingPaths: paths,
				persistedPaths,
				source: context.source,
				resolveResourceReference,
			})
			// linked/mentioned 状态可用 sync reconcile 结果，避免同名路径在恢复期抖动。
			setMentionedReferencePaths(reconciledPaths)
			// A: sync 不得驱动 protected/参考图生命周期（空 mention 被 reconcile 补齐后会误 unprotect）。
			// B: 即便后续扩展 sync 回调，也只能传编辑器真实 mention paths，不能传 reconcile 补齐结果。
			if (context.source === "user") {
				const metadataCandidates = activeMediaReferences.map((reference) => ({
					path: reference.path,
					assetType: reference.kind,
				}))
				if (metadataCandidates.length > 0) {
					onReadyMentionChange?.(paths, currentPrompt, context, metadataCandidates)
				} else {
					onReadyMentionChange?.(paths, currentPrompt, context)
				}
			}
			return true
		},
		[
			mediaPolicy?.manualReferences,
			activeMediaReferences,
			onReadyMentionChange,
			resolveResourceReference,
			targetElementId,
			targetKind,
		],
	)
	const applyingSeedIdRef = useRef<string | null>(null)

	useEffect(() => {
		if (readOnly || !canvas || applyingSeedIdRef.current) return
		const seed = canvas.connectionAssociationSeedManager?.peek(targetElementId)
		if (!seed) return
		if (mentionReadyTargetElementId !== targetElementId) return

		const association = resolveInitialLinkedEditorAssociation({
			seed,
			targetKind,
			mediaPolicyStatus,
			connectedSourceElementIds,
			textConnections,
			mediaItems,
			mediaPolicy,
			resolveResourceReference,
		})
		if (association.status === "pending") return
		applyingSeedIdRef.current = seed.id
		try {
			association.selectedTextConnectionIds.forEach((connectionId) => {
				setTextConnectionSelected(connectionId, true)
			})
			const mediaApplied = association.selectedMediaConnectionIds.every((connectionId) => {
				return handleLinkedMediaSelectionChange(connectionId, true)
			})
			if (!mediaApplied) return

			// 种子包含参考媒体时，必须真正勾选成功后才消费；
			// 否则在 input_mode 尚未支持 reference_images 时会把空结果当成完成并丢掉种子。
			const expectsMediaSelection = seed.orderedSources.some(
				(source) => source.kind !== "text",
			)
			if (expectsMediaSelection && association.selectedMediaConnectionIds.length === 0) {
				return
			}

			canvas.connectionAssociationSeedManager.consume(targetElementId, seed.id)
		} finally {
			applyingSeedIdRef.current = null
		}
	}, [
		canvas,
		connectedSourceElementIds,
		handleLinkedMediaSelectionChange,
		mediaItems,
		setTextConnectionSelected,
		textConnections,
		mediaPolicy,
		mediaPolicyStatus,
		mentionReadyTargetElementId,
		resolveResourceReference,
		targetElementId,
		targetKind,
		readOnly,
	])

	return {
		linkedEditorInputs,
		mentionedReferencePaths,
		handleLinkedMediaSelectionChange,
		handleMentionChange,
	}
}
