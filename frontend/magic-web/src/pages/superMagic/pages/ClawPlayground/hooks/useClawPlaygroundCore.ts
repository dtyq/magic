import { useCallback, useEffect, useRef } from "react"
import { useDeepCompareEffect, useDebounceFn, useMemoizedFn } from "ahooks"
import { useParams } from "react-router"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import { useAttachmentsPolling } from "@/pages/superMagic/hooks/useAttachmentsPolling"
import { useProjectAttachmentsChangeRealtime } from "@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime"
import { useRefreshTopicDetailOnTaskComplete } from "@/pages/superMagic/hooks/useRefreshTopicDetailOnTaskComplete"
import { AttachmentDataProcessor } from "@/pages/superMagic/utils/attachmentDataProcessor"
import SuperMagicService, { loadProjectAttachments } from "@/pages/superMagic/services"
import {
	normalizeUpdateAttachmentsPayload,
	releaseAttachmentsRefreshWaitersWithoutFetch,
	type SuperMagicUpdateAttachmentsRequest,
	withAttachmentsRefreshWaitersResolved,
} from "@/pages/superMagic/services/attachmentsTopicSync"
import { useClawPlaygroundStore } from "../context"
import { useClawPlaygroundInitErrorRedirect } from "./useClawPlaygroundInitErrorRedirect"

/**
 * Shared business logic for ClawPlayground (desktop & mobile).
 * Handles store initialization, attachment fetching / polling, and pubsub wiring.
 */
export function useClawPlaygroundCore() {
	const { code } = useParams<{ code?: string }>()
	const store = useClawPlaygroundStore()
	const visitScope = useRef({})

	useClawPlaygroundInitErrorRedirect(store)

	const selectedProject = store.selectedProject
	const selectedTopic = store.selectedTopic
	const attachments = store.projectFilesStore.workspaceFileTree
	const attachmentList = store.projectFilesStore.workspaceFilesList

	useRefreshTopicDetailOnTaskComplete({
		selectedTopic,
		onTopicDetailLoaded: store.topicStore.updateTopic,
	})

	// -- init store when code changes --
	useEffect(() => {
		if (!code) return
		void store.init(code)
	}, [code, store])

	useEffect(() => {
		if (!selectedProject || store.loading || store.error || store.currentClawCode !== code)
			return
		SuperMagicService.project.recordProjectVisit(
			{ ...selectedProject, claw_code: code },
			visitScope.current,
		)
	}, [code, selectedProject, store, store.loading, store.error, store.currentClawCode])

	// -- debounced attachment fetcher --
	const updateAttachments = useDebounceFn(
		(projectId?: string, callback?: () => void) => {
			if (!projectId) {
				store.projectFilesStore.setWorkspaceFileTree([])
				releaseAttachmentsRefreshWaitersWithoutFetch()
				callback?.()
				return
			}

			pubsub.publish(PubSubEvents.Update_Attachments_Loading, true)
			withAttachmentsRefreshWaitersResolved(
				projectId,
				loadProjectAttachments({
					projectId,
				})
					.then((res) => {
						store.projectFilesStore.setWorkspaceFileTree(res.tree)
						store.mentionPanelStore.finishLoadAttachmentsPromise(projectId)
					})
					.catch((error) => {
						console.error("Failed to fetch claw playground attachments:", error)
						store.projectFilesStore.setWorkspaceFileTree([])
					})
					.finally(() => {
						pubsub.publish(PubSubEvents.Update_Attachments_Loading, false)
						callback?.()
					}),
			)
		},
		{ wait: 500 },
	).run

	// -- attachment polling --
	const { checkNowDebounced: checkAttachmentsNowDebounced } = useAttachmentsPolling({
		projectId: selectedProject?.id,
		store: store.projectFilesStore,
		autoStart: false,
		onAttachmentsChange: useCallback(
			({ tree, list }: { tree: AttachmentItem[]; list: AttachmentItem[] }) => {
				const processedData = AttachmentDataProcessor.processAttachmentData({ tree, list })
				store.projectFilesStore.setWorkspaceFileTree(processedData.tree)
			},
			[store.projectFilesStore],
		),
		onError: useMemoizedFn((error: unknown) => {
			console.error("Failed to poll claw playground attachments:", error)
		}),
	})

	useProjectAttachmentsChangeRealtime({
		projectId: selectedProject?.id,
		store: store.projectFilesStore,
		onFallbackError: useMemoizedFn((error: unknown) => {
			console.error("Failed to refresh realtime claw playground attachments:", error)
		}),
	})

	// -- init mention panel when project changes --
	useDeepCompareEffect(() => {
		const projectId = selectedProject?.id
		if (!projectId) return

		store.mentionPanelStore.initLoadAttachments(projectId)
		updateAttachments(projectId)

		return () => {
			store.mentionPanelStore.clearInitLoadAttachmentsPromise(projectId)
		}
	}, [selectedProject?.id])

	// -- subscribe to attachment updates via pubsub --
	useEffect(() => {
		const handleUpdateAttachments = (
			payloadOrCallback?: SuperMagicUpdateAttachmentsRequest,
		) => {
			const payload = normalizeUpdateAttachmentsPayload(payloadOrCallback)
			const pid = selectedProject?.id
			if (!pid) {
				payload?.callback?.()
				releaseAttachmentsRefreshWaitersWithoutFetch()
				return
			}
			updateAttachments(pid, payload?.callback)
		}

		pubsub.subscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Update_Attachments, handleUpdateAttachments)
		}
	}, [selectedProject?.id, updateAttachments])

	return {
		code,
		store,
		selectedProject,
		attachments,
		attachmentList,
		updateAttachments,
		checkAttachmentsNowDebounced,
	}
}
