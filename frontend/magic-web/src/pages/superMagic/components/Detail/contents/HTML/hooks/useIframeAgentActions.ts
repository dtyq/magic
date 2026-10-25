/**
 * useIframeAgentActions
 *
 * 封装 iframe agent 相关的业务逻辑：获取 agent 列表、创建话题并发送消息、在当前话题发送消息。
 * 返回值可直接传入 useIframeAgent。
 */

import { useMemoizedFn } from "ahooks"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	AgentType,
	TaskStatus,
	type ProjectListItem,
	type Topic,
} from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { SuperMagicApi } from "@/apis"
import type { TopicStore } from "@/pages/superMagic/stores/core/topic"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import type { AgentInfo, TiptapJSONContent } from "../iframe-api/types"
import { serializeMessageContent } from "@/pages/superMagic/services/messageQueueSerialization"
import { resolveTopicConversationLoadingState } from "@/pages/superMagic/hooks/topic-conversation-loading"
import { superMagicStore } from "@/pages/superMagic/stores"
import { optimisticMessageStore } from "@/pages/superMagic/stores/optimisticMessageStore"
import { messageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import {
	processMessageMentions,
	releaseHtmlScreenshotsAfterSend,
	resolveMessageSendContext,
} from "@/pages/superMagic/services/messageSendPreparation"
import { collectMentionItemsFromContent } from "@/pages/superMagic/components/MessageEditor/services/uploadMentionService"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import {
	isSingleTopicHostProject,
	resolveIframeHostTopicMode,
} from "@/pages/superMagic/utils/isSingleTopicHostProject"
import { notifySpecifiedAgentUnavailable } from "@/pages/superMagic/utils/notifySpecifiedAgentUnavailable"
import { prependMicroAppMention, type MicroAppMessageContext } from "./microAppMessageMention"

/**
 * @param projectId 原项目（origin）：文件/库所在项目，用于 mention 解析
 * @param topicStore 调用方传入的会话 store；未传则会话类 API 不可用
 * @param selectedProject 宿主项目（host）：用户当前所在项目，用于建话题和发送
 * @param microAppContext 已发布微应用的可信身份；存在时自动添加 @micro_app mention
 */
export function useIframeAgentActions(
	projectId?: string,
	topicStore?: TopicStore,
	selectedProject?: ProjectListItem | null,
	microAppContext?: MicroAppMessageContext,
	ensureConversation?: () => Promise<{
		selectedProject: ProjectListItem
		topicStore: TopicStore
	} | null>,
) {
	// origin：发布预览嵌在别的项目时，仍指向微应用原项目
	const originProjectId = projectId
	// host：消息必须发到用户当前所在项目，不能回落到 origin
	const ensureHostConversation = useMemoizedFn(async () => {
		if (ensureConversation) {
			const conversation = await ensureConversation()
			if (!conversation) throw new Error("No project selected")
			return conversation
		}
		if (!selectedProject) throw new Error("No project selected")
		if (!topicStore) throw new Error("No topic store")
		return { selectedProject, topicStore }
	})
	const notifyMicroAppMessageStarted = useMemoizedFn((project?: ProjectListItem | null) => {
		// 微应用发起对话时先展示消息面板；开发预览可能尚未注入发布身份。
		if (microAppContext?.microAppId || project?.project_mode === TopicMode.MicroApp) {
			pubsub.publish(PubSubEvents.Expand_Topic_Conversation_Panel)
		}
	})
	/**
	 * 将 message 参数转换为 tiptap jsonContent。
	 * - string: 包装为简单的 doc > paragraph > text 结构
	 * - object (TiptapJSONContent): 直接使用（已包含 mention 等节点）
	 */
	const toJsonContent = (message: string | TiptapJSONContent) => {
		if (typeof message === "string") {
			return {
				type: "doc" as const,
				content: [{ type: "paragraph", content: [{ type: "text", text: message }] }],
			}
		}
		return message
	}

	const dispatchScopedMessage = useMemoizedFn(
		async ({
			jsonContent,
			model,
			extra,
			topicMode,
			targetTopic,
			conversation,
		}: {
			jsonContent: TiptapJSONContent
			model?: string
			extra?: Record<string, unknown>
			topicMode?: TopicMode
			targetTopic?: Topic | null
			conversation?: { selectedProject: ProjectListItem; topicStore: TopicStore }
		}) => {
			const activeTopicStore = conversation?.topicStore ?? topicStore
			const activeProject = conversation?.selectedProject ?? selectedProject
			const activeHostProjectId = activeProject?.id
			if (!activeTopicStore || !activeHostProjectId) return false

			// Capture before any async work; all preparation and delivery use this topic.
			const capturedTopic = targetTopic ?? activeTopicStore.selectedTopic
			const messageContent = prependMicroAppMention(jsonContent, microAppContext)
			const screenshotMentions = collectMentionItemsFromContent(messageContent as JSONContent)
			// mention / 截图解析走 origin：文件仍在原微应用项目
			const processedJsonContent = (await processMessageMentions(
				messageContent as JSONContent,
				originProjectId ?? activeHostProjectId,
				capturedTopic?.id,
			)) as TiptapJSONContent
			const superAgentExtra = {
				mentions: [],
				chat_mode: "normal",
				...(extra?.super_agent && typeof extra.super_agent === "object"
					? (extra.super_agent as Record<string, unknown>)
					: {}),
				...(typeof extra?.agent_code === "string" ? { agent_code: extra.agent_code } : {}),
				...(model ? { model: { model_id: model } } : {}),
				...(topicMode ? { topic_pattern: topicMode } : {}),
			}

			// Re-read only the captured topic after async mention preparation. Switching the
			// visible topic must never redirect this request to a different conversation.
			const latestTopic =
				activeTopicStore.selectedTopic?.id === capturedTopic?.id
					? activeTopicStore.selectedTopic
					: (activeTopicStore.topics.find((topic) => topic.id === capturedTopic?.id) ??
						capturedTopic)
			const status = latestTopic?.task_status ?? latestTopic?.status
			const chatTopicId = capturedTopic?.chat_topic_id
			const isLoading = chatTopicId
				? resolveTopicConversationLoadingState({
						topicMessages: superMagicStore.messages.get(chatTopicId) ?? [],
						getMessageNode: (id) => superMagicStore.getMessageNode(id),
						getOptimisticStatus: (message) =>
							optimisticMessageStore.getStatus(chatTopicId, message?.app_message_id),
					}).isLoading
				: false
			if (
				capturedTopic?.id &&
				status !== TaskStatus.WAITING_FOR_USER &&
				(status === TaskStatus.RUNNING || isLoading)
			) {
				const queuedContent = serializeMessageContent(
					processedJsonContent as JSONContent,
					collectMentionItemsFromContent(processedJsonContent as JSONContent),
					undefined,
					undefined,
					undefined,
					topicMode ?? capturedTopic.topic_mode,
					capturedTopic.agent_code,
				)
				// An omitted model keeps the host topic's default, just like a direct send.
				const queued = await SuperMagicApi.addMessageToQueue({
					project_id: activeHostProjectId,
					topic_id: capturedTopic.id,
					message_type: "rich_text",
					message_content: {
						...queuedContent,
						extra: {
							super_agent: {
								...queuedContent.extra.super_agent,
								model: model ? { model_id: model } : undefined,
							},
						},
					},
				})
				if (!queued?.queue_id) throw new Error("Failed to queue message")
				// Existing queue subscribers refresh from the server on this update event.
				pubsub.publish(PubSubEvents.SuperMagicMessageQueueConsumed)
				releaseHtmlScreenshotsAfterSend(screenshotMentions)
				return true
			}

			// 用传入的 store 直发，不走全局输入框 pubsub，避免发到错误会话
			const success = await messageSendService.dispatchMessage({
				jsonContent: processedJsonContent,
				showLoading: false,
				options: { extra: { super_agent: superAgentExtra } } as any,
				context: resolveMessageSendContext({
					selectedProject:
						activeProject ?? ({ id: activeHostProjectId } as ProjectListItem),
					selectedTopic: capturedTopic,
					topicStore: activeTopicStore,
				}),
			})

			if (!success) throw new Error("Failed to send message")
			releaseHtmlScreenshotsAfterSend(screenshotMentions)
			return true
		},
	)

	const getAgentList = useMemoizedFn((): AgentInfo[] => {
		return superMagicModeService._modeList.map((item) => ({
			id: item.mode.identifier,
			name: item.mode.name,
			icon: item.mode.icon_url || item.mode.icon,
			color: item.mode.color,
			type:
				item.agent.type === AgentType.Official
					? "official"
					: item.agent.type === AgentType.Custom
						? "custom"
						: "public",
		}))
	})

	const sendMessage = useMemoizedFn(
		async (params: { message: string | TiptapJSONContent; model?: string }): Promise<void> => {
			const conversation = await ensureHostConversation()
			notifyMicroAppMessageStarted(conversation.selectedProject)
			const activeProjectId = conversation.selectedProject.id
			const activeTopicStore = conversation.topicStore

			const targetTopic = activeTopicStore.selectedTopic
			if (params.model && targetTopic?.id) {
				await superMagicTopicModelService.saveModel(targetTopic.id, activeProjectId, {
					model_id: params.model,
				} as any)
			}

			const jsonContent = toJsonContent(params.message)
			const sent = await dispatchScopedMessage({
				jsonContent,
				model: params.model,
				targetTopic,
				topicMode: resolveIframeHostTopicMode(conversation.selectedProject),
				conversation,
			})
			if (!sent) throw new Error("Failed to send message")
		},
	)

	/**
	 * 发送消息。多话题宿主会新建话题；单话题宿主（龙虾/对话）复用当前话题。
	 * 单话题路径忽略 agentId，始终由当前 claw/chat 自己的 agent 发送。
	 */
	const createTopicAndSend = useMemoizedFn(
		async (params: {
			message: string | TiptapJSONContent
			agentId?: string
			model?: string
		}): Promise<{ topicId: string }> => {
			const conversation = await ensureHostConversation()
			const activeProject = conversation.selectedProject
			const activeTopicStore = conversation.topicStore
			const activeHostProjectId = activeProject.id

			if (isSingleTopicHostProject(activeProject)) {
				const currentTopic = activeTopicStore.selectedTopic
				if (!currentTopic?.id) throw new Error("No topic selected")
				notifySpecifiedAgentUnavailable(params.agentId, activeProject)
				await sendMessage({ message: params.message, model: params.model })
				return { topicId: currentTopic.id }
			}
			notifyMicroAppMessageStarted(activeProject)

			const requestedAgentId = params.agentId

			// 官方 agent 走内置 topicMode，自定义 agent 需要带 agent_code
			let isCustomAgent = false
			if (requestedAgentId) {
				const agentMode = superMagicModeService._modeList.find(
					(item) => item.mode.identifier === requestedAgentId,
				)
				if (agentMode) {
					isCustomAgent = agentMode.agent.type !== AgentType.Official
				}
			}

			// 话题建在 host：发布预览时用户当前项目，而不是微应用原项目
			const createdTopic = await SuperMagicApi.createTopic({
				project_id: activeHostProjectId,
				topic_name: "",
			})
			if (!createdTopic?.id) throw new Error("Failed to create topic")

			// 直发需要完整会话上下文，创建接口可能不含 chat_topic_id
			const newTopic = await SuperMagicApi.getTopicDetail({ id: createdTopic.id })
			if (!newTopic?.id) throw new Error("Failed to load created topic")
			if (!newTopic.chat_topic_id || !newTopic.chat_conversation_id) {
				throw new Error("Created topic is missing conversation context")
			}

			// Detail is still an empty topic. The selector reads topic_mode.
			const topicWithAgent = requestedAgentId
				? {
						...newTopic,
						topic_mode: isCustomAgent
							? TopicMode.CustomAgent
							: (requestedAgentId as TopicMode),
						agent_code: isCustomAgent ? requestedAgentId : undefined,
					}
				: newTopic
			activeTopicStore.setTopics([
				topicWithAgent,
				...activeTopicStore.topics.filter((item) => item.id !== topicWithAgent.id),
			])
			activeTopicStore.setSelectedTopic(topicWithAgent)

			const jsonContent = toJsonContent(params.message)

			// 等 store 选中项生效后再发，避免并发时绑到旧话题
			await new Promise((resolve) => setTimeout(resolve, 300))

			if (params.model) {
				await superMagicTopicModelService.saveModel(newTopic.id, activeHostProjectId, {
					model_id: params.model,
				} as any)
			}

			// extra：自定义 agent 带 agent_code，指定模型走 super_agent.model
			const extra: Record<string, unknown> = {}
			if (isCustomAgent && requestedAgentId) {
				extra.agent_code = requestedAgentId
			}
			if (params.model) {
				extra.super_agent = { model: { model_id: params.model } }
			}

			const sent = await dispatchScopedMessage({
				jsonContent,
				model: params.model,
				extra,
				targetTopic: topicWithAgent,
				// 未指定 agent 时遵循普通项目约定，使用通用模式；微应用只是消息来源，
				// 不应限制宿主话题只能使用 micro-app agent。
				topicMode: requestedAgentId
					? isCustomAgent
						? TopicMode.CustomAgent
						: (requestedAgentId as TopicMode)
					: TopicMode.General,
				conversation,
			})
			if (!sent) throw new Error("Failed to send message")

			return { topicId: newTopic.id }
		},
	)

	return { getAgentList, createTopicAndSend, sendMessage }
}
