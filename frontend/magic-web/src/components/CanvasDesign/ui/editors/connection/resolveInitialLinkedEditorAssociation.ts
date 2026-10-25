import type { ResolveCanvasResourceReference } from "../../../public/resource-reference"
import type { ConnectionAssociationSeed } from "../../../runtime/interaction/connection/ConnectionAssociationSeedManager"
import {
	resolveLinkedMediaPolicySelection,
	type LinkedEditorMediaItem,
	type LinkedEditorMediaPolicy,
	type LinkedEditorTargetKind,
} from "./linkedEditorInputs"
import type { LinkedTextConnection } from "./linkedTextPrompt"

export type LinkedEditorMediaPolicyStatus = "loading" | "ready"

export type InitialLinkedEditorAssociation =
	| {
			status: "pending"
			reason: "media-policy" | "source-inputs"
	  }
	| {
			status: "ready"
			selectedTextConnectionIds: string[]
			selectedMediaConnectionIds: string[]
	  }

function matchesTargetKind(
	seed: ConnectionAssociationSeed,
	targetKind: LinkedEditorTargetKind,
): boolean {
	return (
		(seed.targetKind === "image-generator" && targetKind === "image") ||
		(seed.targetKind === "video-generator" && targetKind === "video")
	)
}

function orderConnectionsBySourceElementId<
	T extends { connectionId: string; sourceElementId: string },
>(orderedSourceElementIds: string[], items: T[]): T[] {
	const itemsBySourceElementId = new Map<string, T[]>()
	items.forEach((item) => {
		const current = itemsBySourceElementId.get(item.sourceElementId) ?? []
		current.push(item)
		itemsBySourceElementId.set(item.sourceElementId, current)
	})

	const result: T[] = []
	const seenConnectionIds = new Set<string>()
	orderedSourceElementIds.forEach((sourceElementId) => {
		for (const item of itemsBySourceElementId.get(sourceElementId) ?? []) {
			if (seenConnectionIds.has(item.connectionId)) continue
			seenConnectionIds.add(item.connectionId)
			result.push(item)
		}
	})
	return result
}

/**
 * Uses the editor's existing media policy as the single source of truth. Media
 * candidates are attempted in document order, so limits deterministically keep
 * the first N supported resources.
 */
export function resolveInitialLinkedEditorAssociation(options: {
	seed: ConnectionAssociationSeed
	targetKind: LinkedEditorTargetKind
	mediaPolicyStatus: LinkedEditorMediaPolicyStatus
	connectedSourceElementIds: string[]
	textConnections: LinkedTextConnection[]
	mediaItems: LinkedEditorMediaItem[]
	mediaPolicy?: LinkedEditorMediaPolicy
	resolveResourceReference?: ResolveCanvasResourceReference
}): InitialLinkedEditorAssociation {
	if (!matchesTargetKind(options.seed, options.targetKind)) {
		return {
			status: "ready",
			selectedTextConnectionIds: [],
			selectedMediaConnectionIds: [],
		}
	}

	const connectedSourceElementIdSet = new Set(options.connectedSourceElementIds)
	if (
		options.seed.orderedSources.some(
			(source) => !connectedSourceElementIdSet.has(source.elementId),
		)
	) {
		return { status: "pending", reason: "source-inputs" }
	}
	if (
		options.mediaPolicyStatus === "loading" &&
		options.seed.orderedSources.some((source) => source.kind !== "text")
	) {
		return { status: "pending", reason: "media-policy" }
	}

	const orderedSourceElementIds = options.seed.orderedSources.map((source) => source.elementId)

	const orderedTextConnections = orderConnectionsBySourceElementId(
		orderedSourceElementIds,
		options.textConnections,
	)
	const orderedMediaItems = orderConnectionsBySourceElementId(
		orderedSourceElementIds,
		options.mediaItems,
	)
	const selectedMediaConnectionIds = options.mediaItems
		.filter((item) => item.selected)
		.map((item) => item.connectionId)
	const initiallySelectedConnectionIds = new Set(selectedMediaConnectionIds)

	for (const candidate of orderedMediaItems) {
		if (initiallySelectedConnectionIds.has(candidate.connectionId)) continue
		const attemptedConnectionIds = [...selectedMediaConnectionIds, candidate.connectionId]
		const attempt = resolveLinkedMediaPolicySelection(
			options.mediaItems,
			attemptedConnectionIds,
			{
				targetKind: options.targetKind,
				mediaPolicy: options.mediaPolicy,
				resolveResourceReference: options.resolveResourceReference,
			},
		)
		const selectedAfterAttempt = new Set(
			attempt.items.filter((item) => item.selected).map((item) => item.connectionId),
		)
		if (
			selectedAfterAttempt.has(candidate.connectionId) &&
			selectedMediaConnectionIds.every((connectionId) =>
				selectedAfterAttempt.has(connectionId),
			)
		) {
			selectedMediaConnectionIds.push(candidate.connectionId)
		}
	}

	return {
		status: "ready",
		selectedTextConnectionIds: orderedTextConnections.map((item) => item.connectionId),
		selectedMediaConnectionIds: selectedMediaConnectionIds.filter(
			(connectionId) => !initiallySelectedConnectionIds.has(connectionId),
		),
	}
}
