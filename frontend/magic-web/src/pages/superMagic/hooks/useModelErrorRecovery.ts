import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { MODEL_TYPE_LLM } from "@/apis/modules/org-ai-model-provider"
import { AddModelStore } from "../components/MessageEditor/components/ModelSwitch/components/AddModel/store"
import type { ModelItem } from "../components/MessageEditor/components/ModelSwitch/types"
import { isModelDisabled } from "../components/MessageEditor/components/ModelSwitch/utils"
import { serviceProviderModelToModelItem } from "@/services/superMagic/SuperMagicCustomModelService"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import type { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import { superMagicStore } from "../stores"
import { TaskStatus, type Topic, type ProjectListItem } from "../pages/Workspace/types"
import type { HandleSendParams } from "../services/messageSendFlowService"
import { canEditProject } from "../utils/permission"
import { getModelRecoveryMessage, type ModelRecoveryMessage } from "../utils/model-error-recovery"
import type { ErrorRecoveryAction } from "@/types/chat/conversation_message"

const MODEL_RECOVERY_ACTION_RULES = {
	switch_model_and_retry: (failed: string, selected: string) => failed !== selected,
	retry: (failed: string, selected: string) => failed === selected,
} satisfies Record<ErrorRecoveryAction["type"], (failed: string, selected: string) => boolean>

interface ModelErrorRecoveryOptions {
	selectedProject: ProjectListItem | null
	selectedTopic: Topic | null
	topicModelStore: ReturnType<typeof createSuperMagicTopicModelStore>
	sendMessageRef: MutableRefObject<((params: HandleSendParams) => Promise<boolean>) | undefined>
	showLoading: boolean
	isMessagesLoading?: boolean
}

/** 一个会话只拥有一个恢复入口；消息行消费能力，不借用其它页面的发送器。 */
export function useModelErrorRecovery({
	selectedProject,
	selectedTopic,
	topicModelStore,
	sendMessageRef,
	showLoading,
	isMessagesLoading,
}: ModelErrorRecoveryOptions) {
	const { t } = useTranslation("super")
	const addModelStore = useMemo(() => new AddModelStore(), [])
	const mountedRef = useRef(true)
	const submittingRef = useRef(false)
	const [submitting, setSubmitting] = useState(false)
	const [sendReady, setSendReady] = useState(false)
	const onMessageSendReady = useMemoizedFn(
		(
			sendMessage?: (params: HandleSendParams) => Promise<boolean>,
			prevSendMessage?: (params: HandleSendParams) => Promise<boolean>,
		) => {
			// Only update ref if it still points to the old instance (or is a new registration); prevents stale cleanup from clearing newly registered functions.
			if (prevSendMessage !== undefined && sendMessageRef.current !== prevSendMessage) return
			sendMessageRef.current = sendMessage
			if (mountedRef.current) setSendReady(Boolean(sendMessage))
		},
	)
	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
		}
	}, [])
	const getLatestError = useMemoizedFn(() => {
		const messages = superMagicStore.messages.get(selectedTopic?.chat_topic_id ?? "")
		return getModelRecoveryMessage(
			superMagicStore.getMessageNode(messages?.at(-1)?.super_message_id),
		)
	})
	const latestErrorId = getLatestError()?.messageId
	useEffect(() => {
		if (latestErrorId && canEditProject(selectedProject?.user_role))
			void addModelStore.loadMyModels(false)
	}, [addModelStore, latestErrorId, selectedProject?.user_role])

	const modelList =
		superMagicModeService.getModelGroupsByMode(
			topicModelStore.currentTopicMode,
			topicModelStore.currentAgentCode,
		) ?? []
	const getModel = useMemoizedFn((modelId: string): ModelItem | undefined => {
		const groups =
			superMagicModeService.getModelGroupsByMode(
				topicModelStore.currentTopicMode,
				topicModelStore.currentAgentCode,
			) ?? []
		const official = groups
			.flatMap((group) => group.models ?? [])
			.find((model) => model.model_id === modelId)
		if (official) return isModelDisabled(official) ? undefined : official
		const custom = addModelStore.myModels.find(
			(model) => model.model_type === MODEL_TYPE_LLM && model.model_id === modelId,
		)
		return custom ? serviceProviderModelToModelItem(custom) : undefined
	})
	const canUseModel = useMemoizedFn(
		(message: ModelRecoveryMessage, action: ErrorRecoveryAction["type"], modelId: string) =>
			message.error.actions.some((item) => item.type === action) &&
			MODEL_RECOVERY_ACTION_RULES[action](message.error.subject.model_id, modelId) &&
			Boolean(getModel(modelId)),
	)
	const hasAlternative = (message: ModelRecoveryMessage) =>
		[
			...modelList.flatMap((group) => group.models ?? []),
			...addModelStore.myModels
				.filter((model) => model.model_type === MODEL_TYPE_LLM)
				.map(serviceProviderModelToModelItem),
		].some((model) => canUseModel(message, "switch_model_and_retry", model.model_id))
	const canRecover = useMemoizedFn((message: ModelRecoveryMessage) => {
		if (
			!mountedRef.current ||
			!sendReady ||
			!selectedProject ||
			!selectedTopic ||
			!sendMessageRef.current
		)
			return false
		if (
			!canEditProject(selectedProject.user_role) ||
			showLoading ||
			isMessagesLoading ||
			topicModelStore.isLoading
		)
			return false
		if (
			selectedTopic.task_status !== TaskStatus.ERROR ||
			selectedTopic.project_id !== selectedProject.id
		)
			return false
		if (
			topicModelStore.currentTopicId !== selectedTopic.id ||
			topicModelStore.currentProjectId !== selectedProject.id
		)
			return false
		const meta = superMagicStore.topicMeta.get(selectedTopic.chat_topic_id)
		if (
			meta?.syncState === "syncing" ||
			meta?.isStreamLoading ||
			(meta?.pendingExecutionCount ?? 0) > 0
		)
			return false
		const latest = getLatestError()
		return Boolean(
			message.messageId &&
			message.taskId &&
			message.topicId === selectedTopic.id &&
			latest?.messageId === message.messageId &&
			latest.taskId === message.taskId,
		)
	})
	const submit = useMemoizedFn(
		async (
			message: ModelRecoveryMessage,
			action: ErrorRecoveryAction["type"],
			modelId: string,
		): Promise<boolean> => {
			if (submittingRef.current || !canRecover(message)) return false
			if (!canUseModel(message, action, modelId)) return false
			const model = getModel(modelId)
			const topic = selectedTopic
			const project = selectedProject
			const sendMessage = sendMessageRef.current
			if (!model || !topic || !project || !sendMessage) return false
			submittingRef.current = true
			setSubmitting(true)
			try {
				// 保存沿用话题＋项目偏好。每次 await 后重查当前会话，发送始终显式携带模型。
				await superMagicTopicModelService.saveModel(
					topic.id,
					project.id,
					model,
					undefined,
					undefined,
					topicModelStore,
				)
				const canSend = () =>
					canRecover(message) &&
					sendMessageRef.current === sendMessage &&
					Boolean(getModel(modelId))
				if (!canSend()) {
					magicToast.info(t("modelRecovery.stale"))
					return false
				}
				const dispatched = await sendMessage({
					origin: "model_recovery",
					canSend,
					value: {
						type: "doc",
						content: [
							{
								type: "paragraph",
								content: [{ type: "text", text: t("common.continue") }],
							},
						],
					},
					mentionItems: [],
					selectedModel: getModel(modelId),
					selectedImageModel: topicModelStore.selectedImageModel,
					selectedVideoModel: topicModelStore.selectedVideoModel,
					topicMode: topicModelStore.currentTopicMode,
					shouldClearEditorAfterSend: false,
					targetTopic: topic,
				})
				if (!dispatched && mountedRef.current) magicToast.info(t("modelRecovery.notSent"))
				return dispatched
			} catch {
				if (mountedRef.current) magicToast.error(t("modelRecovery.notSent"))
				return false
			} finally {
				submittingRef.current = false
				if (mountedRef.current) setSubmitting(false)
			}
		},
	)
	return {
		modelList,
		topicModelStore,
		addModelStore,
		submitting,
		canRecover,
		canUseModel,
		hasAlternative,
		getModel,
		submit,
		onMessageSendReady,
	}
}

export type ModelErrorRecoveryCapability = ReturnType<typeof useModelErrorRecovery>
