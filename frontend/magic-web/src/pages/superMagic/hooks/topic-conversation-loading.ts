import { isObject } from "lodash-es"
import type { SuperMagicMessageItem } from "@/pages/superMagic/components/MessageList/type"
import type { SuperMagicStoreMessageNode } from "@/pages/superMagic/stores/types"
import { MessageStatus } from "@/pages/superMagic/pages/Workspace/types"
import { projectVisibleMessagesByRevokedTail } from "@/pages/superMagic/utils/project-visible-messages-by-revoked-tail"

interface MessageNodeSnapshot<TStatus = unknown> {
	status?: TStatus
	content?: unknown
	rich_text?: {
		content?: unknown
	}
	text?: {
		content?: unknown
	}
	[key: string]: unknown
}

interface ResolveTopicConversationLoadingStateParams {
	topicMessages: SuperMagicMessageItem[]
	getMessageNode: (superMessageId?: string) => SuperMagicStoreMessageNode | undefined
	getOptimisticStatus: (message?: SuperMagicMessageItem) => unknown
}

function toMessageNodeSnapshot<TStatus = unknown>(
	node: unknown,
): MessageNodeSnapshot<TStatus> | undefined {
	if (!node || !isObject(node)) return undefined
	return node as MessageNodeSnapshot<TStatus>
}

function isUnconfirmedOptimisticUserMessage(
	message: SuperMagicMessageItem | undefined,
	optimisticStatus: unknown,
) {
	return (
		message?.role === "user" &&
		(optimisticStatus === "sending" || optimisticStatus === "failed")
	)
}

function findLastNonUserMessage(topicMessages: SuperMagicMessageItem[]) {
	for (let index = topicMessages.length - 1; index >= 0; index -= 1) {
		const message = topicMessages[index]
		if (message?.role !== "user") return message
	}
	return undefined
}

export function resolveTopicConversationLoadingState<TStatus = unknown>({
	topicMessages,
	getMessageNode,
	getOptimisticStatus,
}: ResolveTopicConversationLoadingStateParams) {
	const visibleTopicMessages = projectVisibleMessagesByRevokedTail(topicMessages)
	const lastMessage = visibleTopicMessages[visibleTopicMessages.length - 1]
	const lastMessageWithRole = findLastNonUserMessage(visibleTopicMessages)
	const lastMessageNode = toMessageNodeSnapshot<TStatus>(
		getMessageNode(lastMessageWithRole?.super_message_id),
	)

	// Local optimistic user messages are transport state, not assistant generation.
	// Only after the sidecar disappears should the conversation enter the thinking/loading phase.
	if (isUnconfirmedOptimisticUserMessage(lastMessage, getOptimisticStatus(lastMessage))) {
		return {
			isLoading: false,
			lastMessage,
			lastMessageNode,
		}
	}

	if (visibleTopicMessages.length === 0) {
		return {
			isLoading: false,
			lastMessage,
			lastMessageNode,
		}
	}

	// An active revoked tail is an edit state, not an assistant generation state.
	if ((lastMessage?.imStatus ?? lastMessage?.status) === MessageStatus.REVOKED) {
		return {
			isLoading: false,
			lastMessage,
			lastMessageNode,
		}
	}

	if (visibleTopicMessages.length === 1) {
		return {
			isLoading: true,
			lastMessage,
			lastMessageNode,
		}
	}

	return {
		isLoading:
			lastMessageNode?.status === "running" ||
			lastMessageNode?.status === "waiting" ||
			lastMessage?.type === "rich_text" ||
			isObject(lastMessageNode?.content) ||
			Boolean(lastMessageNode?.rich_text?.content) ||
			Boolean(lastMessageNode?.text?.content),
		lastMessage,
		lastMessageNode,
	}
}
