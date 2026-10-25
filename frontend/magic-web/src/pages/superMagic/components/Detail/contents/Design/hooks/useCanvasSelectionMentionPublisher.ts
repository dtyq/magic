import { useCallback, useEffect, useRef, type RefObject } from "react"
import type { CanvasDesignRef } from "@/components/CanvasDesign/public/props"
import type { CanvasDocument } from "@/components/CanvasDesign/runtime/document/types"
import {
	CANVAS_SELECTION_PENDING_MENTION_LIMIT,
	collectCanvasElementMentionItems,
	type CanvasElementResolvedFile,
} from "@/components/business/MentionPanel/runtime/builtin/domains/canvas-elements"
import { getProjectFileResourceIdentity } from "@/components/business/MentionPanel/utils/projectReferenceMention"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import { MentionItemType } from "@/components/business/MentionPanel/types"
import {
	createCanvasSelectionMentionScopeKey,
	type CanvasSelectionMentionScope,
} from "@/pages/superMagic/events/message"
import pubsub, { PubSubEvents } from "@/utils/pubsub"

interface UseCanvasSelectionMentionPublisherOptions {
	canvasDesignRef: RefObject<CanvasDesignRef | null>
	designProjectId: string
	enabled: boolean
	scope: CanvasSelectionMentionScope
	getFallbackDocument: () => CanvasDocument | null | undefined
	resolveFileBySrc: (src: string) => CanvasElementResolvedFile | null
}

interface SelectionSnapshot {
	scopeKey: string
	signature: string
	active: boolean
}

/** Publishes the active Canvas media selection into the shared MessageEditor scope. */
export function useCanvasSelectionMentionPublisher({
	canvasDesignRef,
	designProjectId,
	enabled,
	scope,
	getFallbackDocument,
	resolveFileBySrc,
}: UseCanvasSelectionMentionPublisherOptions) {
	const revisionRef = useRef(0)
	const snapshotRef = useRef<SelectionSnapshot | null>(null)
	const activeRef = useRef(false)
	const scopeKey = createCanvasSelectionMentionScopeKey(scope)

	const publishSelection = useCallback(
		(selectedElementIds: string[]) => {
			let items: TiptapMentionAttributes[] = []
			if (enabled && designProjectId) {
				const document =
					canvasDesignRef.current?.exportCurrentDocument?.() ?? getFallbackDocument()
				items = collectCanvasElementMentionItems({
					document,
					selectedElementIds,
					designProjectId,
					resolveFileBySrc,
					maxItems: CANVAS_SELECTION_PENDING_MENTION_LIMIT,
				}).flatMap((item) =>
					item.type === MentionItemType.PROJECT_FILE && item.data
						? [{ type: item.type, data: item.data }]
						: [],
				)
			}

			// Identity-only signature avoids serializing full mention payloads on every selection change.
			const signature = items
				.map((item) => getProjectFileResourceIdentity(item.data) || `${item.type}`)
				.join("|")
			if (
				snapshotRef.current?.scopeKey === scopeKey &&
				snapshotRef.current.signature === signature &&
				snapshotRef.current.active === enabled
			) {
				return
			}

			snapshotRef.current = { scopeKey, signature, active: enabled }
			pubsub.publish(PubSubEvents.Super_Magic_Canvas_Selection_Mentions, {
				scopeKey,
				selectionRevision: String(++revisionRef.current),
				active: enabled,
				items,
			})
		},
		[
			canvasDesignRef,
			designProjectId,
			enabled,
			getFallbackDocument,
			resolveFileBySrc,
			scopeKey,
		],
	)

	useEffect(() => {
		const wasActive = activeRef.current
		activeRef.current = enabled

		if (!enabled && wasActive) {
			publishSelection([])
			return
		}
		if (enabled && !wasActive) {
			const selectedIds =
				canvasDesignRef.current?.getCanvasInstance()?.selectionManager.getSelectedIds() ??
				[]
			publishSelection(selectedIds)
		}
	}, [canvasDesignRef, enabled, publishSelection])

	useEffect(
		() => () => {
			if (!activeRef.current) return
			activeRef.current = false
			snapshotRef.current = { scopeKey, signature: "[]", active: false }
			pubsub.publish(PubSubEvents.Super_Magic_Canvas_Selection_Mentions, {
				scopeKey,
				selectionRevision: String(++revisionRef.current),
				active: false,
				items: [],
			})
		},
		[scopeKey],
	)

	return publishSelection
}
