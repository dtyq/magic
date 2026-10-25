import { useRef } from "react"
import { useMemoizedFn } from "ahooks"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/types"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import type { SendMessageOptions } from "@/pages/superMagic/components/MessagePanel/types"
import type { HandleSendParams } from "@/pages/superMagic/services/messageSendFlowService"
import { superMagicStore } from "@/pages/superMagic/stores"
import {
	OptimisticMessage,
	optimisticMessageStore,
} from "@/pages/superMagic/stores/optimisticMessageStore"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { getNetworkMonitor } from "@/services/recordSummary/NetworkMonitor"

interface RetryMessageNode {
	content?: string
	extra?: SendMessageOptions["extra"]
}

interface RetrySendSuperAgentExtra {
	mentions?: MentionListItem[]
	model?: ModelItem | null
	image_model?: ModelItem | null
	video_model?: ModelItem | null
	topic_pattern?: TopicMode
}

function isRetryJSONContent(content: unknown): content is JSONContent {
	return Boolean(content) && typeof content === "object"
}

/** Recovers original content and send params from the v2 main store rich_text node; no body copy is kept in sidecar. */
function resolveRetryMessagePayload(messageNode: unknown) {
	const node = messageNode as RetryMessageNode
	if (!node?.content) return undefined

	let parsedContent: unknown
	try {
		// Historical rich_text may be corrupted by stale or abnormal writes; JSON.parse must not break the page flow during retry recovery.
		parsedContent = JSON.parse(node.content)
	} catch {
		return undefined
	}
	if (!isRetryJSONContent(parsedContent)) return undefined

	return {
		content: parsedContent,
		options: node.extra ? ({ extra: node.extra } as SendMessageOptions) : undefined,
	}
}

function resolveRetrySendParams(
	retryPayload: NonNullable<ReturnType<typeof resolveRetryMessagePayload>>,
): HandleSendParams {
	// Failed retry must go through the first-layer send entry, so we restore rich_text extra back to editor send params.
	const superAgent = retryPayload.options?.extra?.super_agent as
		RetrySendSuperAgentExtra | undefined

	return {
		value: retryPayload.content,
		mentionItems: superAgent?.mentions ?? [],
		selectedModel: superAgent?.model,
		selectedImageModel: superAgent?.image_model,
		selectedVideoModel: superAgent?.video_model,
		topicMode: superAgent?.topic_pattern,
		extra: retryPayload.options?.extra,
	}
}

interface UseRetryOptimisticMessageParams {
	chatTopicId?: string
	/** Returns the composer's current first-layer send entry (registered via onMessageSendReady); may be unavailable. */
	getSendMessage: () => ((params: HandleSendParams) => Promise<boolean>) | undefined
	/** Called after the retry send started and the old failed message was removed. */
	onRetryStarted?: () => void
}

/**
 * Shared retry entry for failed optimistic user messages, used by every chat surface that renders
 * the message list (topic page, persona research). The failed bubble's icon is only clickable when
 * the surface provides this handler through MessageListProvider.onRetryOptimisticMessage.
 */
export function useRetryOptimisticMessage({
	chatTopicId,
	getSendMessage,
	onRetryStarted,
}: UseRetryOptimisticMessageParams) {
	const retryingIdsRef = useRef<Set<string>>(new Set())

	return useMemoizedFn(async (message: SuperMagicMessageItem) => {
		const appMessageId = message?.app_message_id
		if (!chatTopicId || !appMessageId) return

		const retryingKey = `${chatTopicId}:${appMessageId}`
		if (retryingIdsRef.current.has(retryingKey)) return

		// Retry entry only handles failed optimistic messages in the current topic to prevent accidental sends after state changes.
		if (message?.topic_id && `${message.topic_id}` !== chatTopicId) return
		if (
			optimisticMessageStore.getStatus(chatTopicId, appMessageId) !==
			OptimisticMessage.Status.Failed
		)
			return
		if (getNetworkMonitor().isNetworkOffline()) {
			// Offline retry keeps the original failed node intact to avoid generating a new failed message after deletion.
			return
		}

		const retryPayload = resolveRetryMessagePayload(
			superMagicStore.getMessageNode(message.super_message_id),
		)
		if (!retryPayload) return
		const sendMessage = getSendMessage()
		if (!sendMessage) return

		retryingIdsRef.current.add(retryingKey)
		// Retry reuses the first-layer editor send entry; normal send logic decides between direct send or queue.
		let didStartRetry = false
		try {
			didStartRetry = await sendMessage({ ...resolveRetrySendParams(retryPayload) })
		} catch {
			return
		} finally {
			retryingIdsRef.current.delete(retryingKey)
		}
		if (!didStartRetry) return

		// Before deleting the old failed message, re-anchor subsequent failed messages to the previous anchor point.
		optimisticMessageStore.reanchorDependentsBeforeMessageRemoval({
			chat_topic_id: chatTopicId,
			app_message_id: appMessageId,
		})
		optimisticMessageStore.remove({
			chat_topic_id: chatTopicId,
			app_message_id: appMessageId,
		})
		superMagicStore.removeUserMessage(chatTopicId, appMessageId)

		onRetryStarted?.()
	})
}
