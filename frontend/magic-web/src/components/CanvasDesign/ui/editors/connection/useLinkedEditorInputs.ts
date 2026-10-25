import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useCanvasEvent } from "../../../app/hooks/canvas"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import type { CropConfig } from "../../../runtime/document/types"
import {
	getLinkedMediaReferenceIdentity,
	resolveLinkedEditorInputs,
	resolveLinkedMediaAssociation,
	type LinkedEditorInputsResolution,
	type LinkedEditorMediaItem,
	type LinkedEditorMediaPolicy,
	type LinkedEditorMediaReference,
	type LinkedEditorTargetKind,
} from "./linkedEditorInputs"
import { getLinkedTextPromptText } from "./linkedTextPrompt"
import {
	clearLinkedEditorDraftFromStorage,
	createEmptyLinkedEditorDraft,
	getLinkedEditorDraftFromStorage,
	reconcileLinkedEditorDraft,
	saveLinkedEditorDraftToStorage,
} from "./linkedEditorDraft"
import type { StoredLinkedEditorDraft } from "../../../public/magic-types"
import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"

export interface LinkedEditorInputsState extends LinkedEditorInputsResolution {
	isTextConnectionSelected: (connectionId: string) => boolean
	setTextConnectionSelected: (connectionId: string, selected: boolean) => void
	canSelectMediaConnection: (connectionId: string) => boolean
	reorderTextConnections: (activeConnectionId: string, overConnectionId: string) => void
}

interface UseLinkedEditorInputsOptions {
	targetElementId: string
	targetKind: LinkedEditorTargetKind
	enabled?: boolean
	mediaPolicy?: LinkedEditorMediaPolicy
	mentionedReferencePaths?: string[]
}

function areCropConfigsEqual(a?: CropConfig, b?: CropConfig): boolean {
	if (a === b) return true
	if (!a || !b) return false
	return (
		a.x === b.x &&
		a.y === b.y &&
		a.width === b.width &&
		a.height === b.height &&
		a.displayWidth === b.displayWidth &&
		a.displayHeight === b.displayHeight
	)
}

function areLinkedMediaItemsEqual(
	prev: LinkedEditorMediaItem[],
	next: LinkedEditorMediaItem[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	if (prev.length !== next.length) return false
	for (let index = 0; index < prev.length; index += 1) {
		const prevItem = prev[index]
		const nextItem = next[index]
		if (!prevItem || !nextItem) return false
		if (prevItem.connectionId !== nextItem.connectionId) return false
		if (prevItem.sourceElementId !== nextItem.sourceElementId) return false
		if (prevItem.kind !== nextItem.kind) return false
		if (
			getLinkedMediaReferenceIdentity(prevItem.path, resolveResourceReference) !==
			getLinkedMediaReferenceIdentity(nextItem.path, resolveResourceReference)
		) {
			return false
		}
		if (prevItem.fileName !== nextItem.fileName) return false
		if (!areCropConfigsEqual(prevItem.sourceCrop, nextItem.sourceCrop)) return false
		if (prevItem.sourceContentId !== nextItem.sourceContentId) return false
		if (prevItem.status !== nextItem.status) return false
		if (prevItem.reason !== nextItem.reason) return false
		if (prevItem.selected !== nextItem.selected) return false
		if (prevItem.selectionDisabledReason !== nextItem.selectionDisabledReason) return false
	}
	return true
}

function areLinkedMediaReferencesEqual(
	prev: LinkedEditorMediaReference[],
	next: LinkedEditorMediaReference[],
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	if (prev.length !== next.length) return false
	for (let index = 0; index < prev.length; index += 1) {
		const prevItem = prev[index]
		const nextItem = next[index]
		if (!prevItem || !nextItem) return false
		if (prevItem.kind !== nextItem.kind) return false
		if (
			getLinkedMediaReferenceIdentity(prevItem.path, resolveResourceReference) !==
			getLinkedMediaReferenceIdentity(nextItem.path, resolveResourceReference)
		) {
			return false
		}
		if (!areCropConfigsEqual(prevItem.sourceCrop, nextItem.sourceCrop)) return false
		if (prevItem.sourceContentId !== nextItem.sourceContentId) return false
	}
	return true
}

function areLinkedEditorInputsEqual(
	prev: LinkedEditorInputsResolution,
	next: LinkedEditorInputsResolution,
	resolveResourceReference?: ResolveCanvasResourceReference,
): boolean {
	if (prev.connectedSourceElementIds.length !== next.connectedSourceElementIds.length)
		return false
	for (let index = 0; index < prev.connectedSourceElementIds.length; index += 1) {
		if (prev.connectedSourceElementIds[index] !== next.connectedSourceElementIds[index])
			return false
	}
	if (prev.textPrompt !== next.textPrompt) return false
	if (prev.textConnections.length !== next.textConnections.length) return false
	for (let index = 0; index < prev.textConnections.length; index += 1) {
		const prevItem = prev.textConnections[index]
		const nextItem = next.textConnections[index]
		if (!prevItem || !nextItem) return false
		if (prevItem.connectionId !== nextItem.connectionId) return false
		if (prevItem.sourceElementId !== nextItem.sourceElementId) return false
		if (prevItem.text !== nextItem.text) return false
	}
	return (
		areLinkedMediaItemsEqual(prev.mediaItems, next.mediaItems, resolveResourceReference) &&
		areLinkedMediaReferencesEqual(
			prev.activeMediaReferences,
			next.activeMediaReferences,
			resolveResourceReference,
		)
	)
}

export function useLinkedEditorInputs(
	options: UseLinkedEditorInputsOptions,
): LinkedEditorInputsState {
	const { targetElementId, targetKind, enabled = true, mediaPolicy } = options
	const mentionedReferencePaths = useMemo(
		() => options.mentionedReferencePaths ?? [],
		[options.mentionedReferencePaths],
	)
	const { canvas } = useCanvas()
	const [resolution, setResolution] = useState<LinkedEditorInputsResolution>(() =>
		resolveLinkedEditorInputs({
			canvas,
			targetElementId,
			targetKind,
			enabled,
			mediaPolicy,
		}),
	)
	const [editorDraft, setEditorDraft] = useState<StoredLinkedEditorDraft>(() =>
		canvas
			? getLinkedEditorDraftFromStorage(canvas, targetElementId)
			: createEmptyLinkedEditorDraft(),
	)
	const editorDraftRef = useRef(editorDraft)
	const updateEditorDraft = useCallback(
		(
			updater:
				| StoredLinkedEditorDraft
				| ((previousDraft: StoredLinkedEditorDraft) => StoredLinkedEditorDraft),
		): StoredLinkedEditorDraft => {
			const previousDraft = editorDraftRef.current
			const nextDraft = typeof updater === "function" ? updater(previousDraft) : updater
			editorDraftRef.current = nextDraft
			setEditorDraft(nextDraft)
			return nextDraft
		},
		[],
	)
	const [hydratedDraftContext, setHydratedDraftContext] = useState<{
		canvas: NonNullable<typeof canvas>
		targetElementId: string
	} | null>(() => (canvas ? { canvas, targetElementId } : null))
	const currentTextConnectionIds = useMemo(
		() => resolution.textConnections.map((connection) => connection.connectionId),
		[resolution.textConnections],
	)
	const reconcileDraftForCurrentInputs = useCallback(
		(draft: StoredLinkedEditorDraft) =>
			reconcileLinkedEditorDraft(draft, {
				textConnectionIds: currentTextConnectionIds,
			}),
		[currentTextConnectionIds],
	)
	const reconciledEditorDraft = useMemo(
		() => reconcileDraftForCurrentInputs(editorDraft),
		[editorDraft, reconcileDraftForCurrentInputs],
	)
	const selectedTextConnectionIds = useMemo(
		() => new Set(reconciledEditorDraft.selectedTextConnectionIds),
		[reconciledEditorDraft.selectedTextConnectionIds],
	)
	const orderedTextConnectionIds = reconciledEditorDraft.orderedTextConnectionIds

	const refreshInputs = useCallback(() => {
		const resolveResourceReference =
			canvas?.magicConfigManager?.config?.methods?.resolveResourceReference
		const nextResolution = resolveLinkedEditorInputs({
			canvas,
			targetElementId,
			targetKind,
			enabled,
			mediaPolicy,
		})
		setResolution((prevResolution) =>
			areLinkedEditorInputsEqual(prevResolution, nextResolution, resolveResourceReference)
				? prevResolution
				: nextResolution,
		)
	}, [canvas, enabled, mediaPolicy, targetElementId, targetKind])

	useEffect(() => {
		if (!canvas) {
			setHydratedDraftContext(null)
			return
		}
		updateEditorDraft(getLinkedEditorDraftFromStorage(canvas, targetElementId))
		setHydratedDraftContext({ canvas, targetElementId })
	}, [canvas, targetElementId, updateEditorDraft])

	useEffect(() => {
		refreshInputs()
	}, [refreshInputs])

	useCanvasEvent("connection:change", refreshInputs, [refreshInputs])
	useCanvasEvent("element:created", refreshInputs, [refreshInputs])
	useCanvasEvent("element:updated", refreshInputs, [refreshInputs])
	useCanvasEvent("element:deleted", refreshInputs, [refreshInputs])
	useCanvasEvent("element:batchupdated", refreshInputs, [refreshInputs])
	useCanvasEvent("element:batchdeleted", refreshInputs, [refreshInputs])

	useEffect(() => {
		if (
			!canvas ||
			hydratedDraftContext?.canvas !== canvas ||
			hydratedDraftContext.targetElementId !== targetElementId
		) {
			return
		}
		updateEditorDraft((previousDraft) => reconcileDraftForCurrentInputs(previousDraft))
	}, [
		canvas,
		hydratedDraftContext,
		reconcileDraftForCurrentInputs,
		targetElementId,
		updateEditorDraft,
	])

	const mediaSelectionResolution = useMemo(
		() =>
			resolveLinkedMediaAssociation({
				candidates: resolution.mediaItems,
				mentionedPaths: mentionedReferencePaths,
				manualReferences: mediaPolicy?.manualReferences,
				targetKind,
				mediaPolicy,
				resolveResourceReference:
					canvas?.magicConfigManager?.config?.methods?.resolveResourceReference,
			}),
		[canvas, mediaPolicy, mentionedReferencePaths, resolution.mediaItems, targetKind],
	)

	useEffect(() => {
		if (
			!canvas ||
			hydratedDraftContext?.canvas !== canvas ||
			hydratedDraftContext.targetElementId !== targetElementId
		) {
			return
		}
		saveLinkedEditorDraftToStorage(canvas, targetElementId, reconciledEditorDraft)
	}, [canvas, hydratedDraftContext, reconciledEditorDraft, targetElementId])

	useCanvasEvent(
		"element:deleted",
		(event) => {
			if (!canvas || event.data.elementId !== targetElementId) return
			clearLinkedEditorDraftFromStorage(canvas, targetElementId)
		},
		[canvas, targetElementId],
	)

	const orderedTextConnections = useMemo(() => {
		const connectionById = new Map(
			resolution.textConnections.map((connection) => [connection.connectionId, connection]),
		)
		const orderedIds = [
			...orderedTextConnectionIds,
			...resolution.textConnections.map((connection) => connection.connectionId),
		]
		const seenIds = new Set<string>()
		return orderedIds.flatMap((connectionId) => {
			if (seenIds.has(connectionId)) return []
			const connection = connectionById.get(connectionId)
			if (!connection) return []
			seenIds.add(connectionId)
			return [connection]
		})
	}, [orderedTextConnectionIds, resolution.textConnections])

	const isTextConnectionSelected = useCallback(
		(connectionId: string) => selectedTextConnectionIds.has(connectionId),
		[selectedTextConnectionIds],
	)

	const setTextConnectionSelected = useCallback(
		(connectionId: string, selected: boolean) => {
			updateEditorDraft((previousDraft) => {
				const currentDraft = reconcileDraftForCurrentInputs(previousDraft)
				const previousIds = currentDraft.selectedTextConnectionIds
				const wasSelected = previousIds.includes(connectionId)
				if (wasSelected === selected) return currentDraft
				return {
					...currentDraft,
					selectedTextConnectionIds: selected
						? [...previousIds, connectionId]
						: previousIds.filter((id) => id !== connectionId),
				}
			})
		},
		[reconcileDraftForCurrentInputs, updateEditorDraft],
	)

	const canSelectMediaConnection = useCallback(
		(connectionId: string): boolean => {
			const item = mediaSelectionResolution.items.find(
				(candidate) => candidate.connectionId === connectionId,
			)
			return Boolean(item && !item.selectionDisabledReason)
		},
		[mediaSelectionResolution.items],
	)

	const reorderTextConnections = useCallback(
		(activeConnectionId: string, overConnectionId: string) => {
			if (activeConnectionId === overConnectionId) return
			updateEditorDraft((previousDraft) => {
				const currentDraft = reconcileDraftForCurrentInputs(previousDraft)
				const previousIds = currentDraft.orderedTextConnectionIds
				const activeIndex = previousIds.indexOf(activeConnectionId)
				const overIndex = previousIds.indexOf(overConnectionId)
				if (activeIndex < 0 || overIndex < 0) return currentDraft

				const nextIds = [...previousIds]
				const [activeId] = nextIds.splice(activeIndex, 1)
				if (!activeId) return currentDraft
				nextIds.splice(overIndex, 0, activeId)
				return { ...currentDraft, orderedTextConnectionIds: nextIds }
			})
		},
		[reconcileDraftForCurrentInputs, updateEditorDraft],
	)

	const textPrompt = useMemo(
		() =>
			getLinkedTextPromptText(
				orderedTextConnections.filter((connection) =>
					isTextConnectionSelected(connection.connectionId),
				),
			),
		[isTextConnectionSelected, orderedTextConnections],
	)

	return useMemo(
		() => ({
			...resolution,
			textConnections: orderedTextConnections,
			textPrompt,
			mediaItems: mediaSelectionResolution.items,
			activeMediaReferences: mediaSelectionResolution.activeMediaReferences,
			isTextConnectionSelected,
			setTextConnectionSelected,
			canSelectMediaConnection,
			reorderTextConnections,
		}),
		[
			canSelectMediaConnection,
			isTextConnectionSelected,
			mediaSelectionResolution,
			reorderTextConnections,
			resolution,
			orderedTextConnections,
			setTextConnectionSelected,
			textPrompt,
		],
	)
}
