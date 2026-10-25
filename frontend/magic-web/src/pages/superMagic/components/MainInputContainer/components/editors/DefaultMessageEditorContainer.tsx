import { useEffect, useMemo, useRef, useState, type RefObject, type MutableRefObject } from "react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { useLocaleText } from "../../panels/hooks/useLocaleText"
import MessageEditor, {
	type MessageEditorRef,
} from "@/pages/superMagic/components/MessageEditor/MessageEditor"
import { useIsMobile } from "@/hooks/useIsMobile"
import {
	createMessageSendService,
	type HandleSendParams,
} from "@/pages/superMagic/services/messageSendFlowService"
import {
	createTopicForMessageContext,
	ensureProjectForMessageContext,
	preparePanelSend,
	releaseHtmlScreenshotsAfterSend,
} from "@/pages/superMagic/services/messageSendPreparation"
import { roleStore } from "@/pages/superMagic/stores"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import useSharedProjectMode from "@/pages/superMagic/hooks/useSharedProjectMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import useSandboxPreWarm from "@/pages/superMagic/components/MessagePanel/hooks/useSandboxPreWarm"
import { useOfficialPromptsPayload } from "@/pages/superMagic/hooks/useOfficialPromptsPayload"
import useTopicExamplesPortal from "@/pages/superMagic/hooks/useTopicExamplesPortal"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import type { SceneEditorContext, SceneEditorNodes } from "./types"
import { useOptionalScenePanelVariant, useOptionalSceneStateStore } from "../../stores"
import { ScenePanelVariant } from "../LazyScenePanel/types"
import MessageEditorSkeleton from "../skeleton/MessageEditorSkeleton"
import { cn } from "@/utils/cn"
import { generateTextFromJSONContent } from "@/pages/superMagic/components/MessageEditor/utils"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import QueueDraftNotice from "../../../MessagePanel/components/MessageQueue/QueueDraftNotice"
import { buildQueueMessageInput } from "./messageParams"
import { resolveAgentSelection } from "@/services/superMagic/DefaultAgentSelectionService"
import { useConversationInputLayout } from "../../../ConversationInputResize/context"
import { analyticsService } from "@/services/analytics"
import { getConversationTopicModeOverride } from "@/pages/superMagic/services/conversationTopicModeOverride"

const ERR_QUEUE_ADD_FAILED = "queue_add_failed"

interface DefaultMessageEditorContainerProps {
	editorContext?: SceneEditorContext
	editorNodes?: SceneEditorNodes
	editorRef?: RefObject<MessageEditorRef | null>
}

export default function DefaultMessageEditorContainer(props: DefaultMessageEditorContainerProps) {
	const { editorContext, editorRef } = props
	const { t } = useTranslation("super")
	const lt = useLocaleText()
	const isMobile = useIsMobile()
	// The desktop project composer shell is already on screen when the lazy editor runtime starts
	// loading; keep the scene's loading skeleton in it until the editor arrives.
	const scenePanelVariant = useOptionalScenePanelVariant()
	const isDesktopProjectScene = !isMobile && scenePanelVariant === ScenePanelVariant.TopicPage
	const sceneStateStore = useOptionalSceneStateStore()
	const inputLayout = useConversationInputLayout()
	// Only fixed conversation panels ask the shared editor to occupy all available height.
	const shouldFillHeight = Boolean(inputLayout?.fillHeight)

	const internalEditorRef = useRef<MessageEditorRef>(null)
	const tiptapEditorRef = (editorRef ??
		editorContext?.editorRef ??
		internalEditorRef) as RefObject<MessageEditorRef>

	const [isSending, setIsSending] = useState(false)
	//fix:创建话题接口阶段的同步锁 解决弱网环境下isSending设置为true之前，用户再次触发创建话题接口导致重复创建话题的问题
	const isPreparingSendRef = useRef(false)
	//首页发送按钮loading状态
	const [isHomePreparingSend, setIsHomePreparingSend] = useState(false)
	const [, setFocused] = useState(false)
	const [, setIsFocused] = useState(false)

	const mentionPanelStore = editorContext?.mentionPanelStore ?? GlobalMentionPanelStore
	const onMessageSendReady = editorContext?.onMessageSendReady
	const _topicStore = editorContext?.topicStore ?? topicStore
	const scopedMessageSendService = useMemo(
		() =>
			createMessageSendService({
				mentionPanelStore,
			}),
		[mentionPanelStore],
	)

	const selectedProject =
		editorContext?.selectedProject !== undefined
			? editorContext.selectedProject
			: projectStore.selectedProject
	const selectedTopic =
		editorContext?.selectedTopic !== undefined
			? editorContext.selectedTopic
			: _topicStore.selectedTopic
	const effectiveTopicMode = editorContext?.topicMode ?? roleStore.currentRole
	const effectiveSetTopicMode = editorContext?.setTopicMode ?? roleStore.setCurrentRole
	const effectiveSetSelectedWorkspace =
		editorContext?.setSelectedWorkspace ?? workspaceStore.setSelectedWorkspace
	const queueContext = editorContext?.queueContext
	const showLoading = editorContext?.showLoading ?? false
	const isEmptyStatus = editorContext?.isEmptyStatus ?? true
	const isWaitingForUser = selectedTopic?.task_status === TaskStatus.WAITING_FOR_USER
	const effectiveIsTaskRunning = Boolean(
		editorContext?.isTaskRunning || showLoading || isWaitingForUser,
	)

	useSharedProjectMode({ setTopicMode: effectiveSetTopicMode })

	useEffect(() => {
		if (!editorContext?.autoFocus) return
		// 等编辑器真正挂载完成后再 focus，
		// 同时保留对 iOS 上过渡动画期间焦点错位或静默失败的兜底。
		let focusTimer: number | null = null
		let attemptCount = 0

		function focusEditor() {
			const editor = tiptapEditorRef.current?.editor
			if (editor && !editor.isDestroyed) {
				try {
					tiptapEditorRef.current?.focus?.({
						enableWhenIsMobile: true,
						// Desktop chat-home autofocus must not scroll the tabs out of position.
						preventScroll: !isMobile && editorContext?.deferProjectCreationUntilSend,
					})
					return
				} catch {
					// view not mounted yet, fall through to retry
				}
			}

			attemptCount += 1
			if (attemptCount >= 10) return
			focusTimer = window.setTimeout(focusEditor, 100)
		}

		focusTimer = window.setTimeout(focusEditor, 100)

		return () => {
			if (focusTimer != null) window.clearTimeout(focusTimer)
		}
	}, [
		editorContext?.autoFocus,
		editorContext?.deferProjectCreationUntilSend,
		isMobile,
		tiptapEditorRef,
	])

	useEffect(() => {
		if (!editorContext?.initialContent) return
		// initialContent 仅用于编辑器首次挂载时的内容回填，
		// 后续父组件重渲染不应再次覆盖用户手动编辑过的内容。
		tiptapEditorRef.current?.restoreContent?.(
			editorContext.initialContent,
			editorContext.initialMentionItems,
		)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (!editorContext?.onContentChange) return
		const handleContentChange = editorContext.onContentChange
		// 等待 MessageEditor 内部 TipTap 实例就绪后订阅 update 事件，
		// 将编辑器内容变化实时同步给调用方（如移动端底部输入栏）
		let offUpdate: (() => void) | null = null
		const timer = setTimeout(() => {
			const editor = tiptapEditorRef.current?.editor
			if (!editor || editor.isDestroyed) return
			const handleUpdate = () => {
				const e = tiptapEditorRef.current?.editor
				if (e && !e.isDestroyed) handleContentChange(e.getJSON())
			}
			editor.on("update", handleUpdate)
			offUpdate = () => editor.off("update", handleUpdate)
		}, 250)
		return () => {
			clearTimeout(timer)
			offUpdate?.()
		}
	}, [editorContext?.onContentChange, tiptapEditorRef])

	useEffect(() => {
		if (editorContext?.selectedModel === undefined) return
		const timer = setTimeout(() => {
			tiptapEditorRef.current?.setModels?.({
				languageModel: editorContext.selectedModel ?? null,
			})
		}, 0)
		return () => clearTimeout(timer)
	}, [editorContext?.selectedModel, tiptapEditorRef])

	const bindEditorRef = useMemoizedFn((editor: MessageEditorRef | null) => {
		;(tiptapEditorRef as MutableRefObject<MessageEditorRef | null>).current = editor
		if (queueContext?.editorRef)
			(queueContext.editorRef as MutableRefObject<MessageEditorRef | null>).current = editor
		if (editorContext?.editorRef)
			(editorContext.editorRef as MutableRefObject<MessageEditorRef | null>).current = editor
	})
	const appliedDraftModeRef = useRef<string>()
	const recoverTopicMode = editorContext?.recoverTopicMode
	const setTopicMode = editorContext?.setTopicMode
	useEffect(() => {
		const metadata = queueContext?.queueDraft?.queueDraft
		if (!metadata) {
			appliedDraftModeRef.current = undefined
			return
		}
		if (appliedDraftModeRef.current === metadata.clientSyncId) return
		appliedDraftModeRef.current = metadata.clientSyncId
		if (metadata.topicMode) {
			if (recoverTopicMode) {
				recoverTopicMode(metadata.topicMode, metadata.agentCode)
			} else {
				setTopicMode?.(metadata.topicMode)
			}
		}
	}, [queueContext?.queueDraft, recoverTopicMode, setTopicMode])

	const handleEditorReady = useMemoizedFn(() => {
		queueContext?.onEditorReady()
		editorContext?.onReady?.()
	})

	const handleSend = useMemoizedFn(async (params: HandleSendParams): Promise<boolean> => {
		const isModelRecovery = params.origin === "model_recovery"
		if (params.canSend && !params.canSend()) return false
		// 恢复沿用发送准备，但不能改写队列草稿，也不能在新运行开始后自动入队。
		if (
			isModelRecovery &&
			(showLoading ||
				isWaitingForUser ||
				editorContext?.isTaskRunning ||
				queueContext?.isQueueOperationPending ||
				params.targetTopic?.id !== selectedTopic?.id)
		)
			return false
		let hasStartedSend = false
		let sendResult:
			| {
					currentProject: typeof selectedProject
					currentTopic: typeof selectedTopic
			  }
			| undefined
		let shouldShowHomeSendLoading = false

		const nextValue = isModelRecovery
			? params.value
			: appendPresetSuffixContent(params.value, sceneStateStore?.presetSuffixContent)
		const sendSelection = resolveAgentSelection(effectiveTopicMode, editorContext?.agentCode)
		const extra = { ...(params.extra ?? {}) }
		delete extra.agent_code
		const normalizedParams: HandleSendParams = {
			...params,
			topicMode: sendSelection.topicPattern,
			extra: sendSelection.agentCode
				? { ...extra, agent_code: sendSelection.agentCode }
				: Object.keys(extra).length > 0
					? extra
					: undefined,
		}

		// isPreparingSendRef 用于拦截弱网下的并发请求创建话题接口：
		// isSending 基于 useState，赋值异步，无法在创建话题接口响应回来之前生效；
		// isPreparingSendRef 基于 useRef，赋值同步立即生效，覆盖从发起创建话题到发送消息完成的完整阶段
		if (!params.value || isSending || isPreparingSendRef.current) {
			return false
		}

		// 队列发送和直接发送必须使用同一份业务参数。微应用、Skill、员工等场景会通过
		// mergeSendParams 修正 topicMode / extra；如果在加入队列后才合并，队列消息会退回默认模式。
		const defaultParams: HandleSendParams = {
			...normalizedParams,
			value: nextValue ?? params.value,
		}
		const customParamsPatch = editorContext?.mergeSendParams?.({
			defaultParams,
		})
		const mergedParams = customParamsPatch
			? { ...defaultParams, ...customParamsPatch }
			: defaultParams
		const finalParams: HandleSendParams = mergedParams

		if (
			!isModelRecovery &&
			params.shouldClearEditorAfterSend !== false &&
			queueContext &&
			tiptapEditorRef.current?.getQueueDraft()
		) {
			isPreparingSendRef.current = true
			setIsSending(true)
			try {
				const shouldClear = await queueContext.finishEditQueueItem(
					buildQueueMessageInput(finalParams, params.value),
				)
				if (shouldClear) {
					tiptapEditorRef.current?.clearContentAfterSend()
					setFocused(false)
				}
				return shouldClear
			} finally {
				isPreparingSendRef.current = false
				setIsSending(false)
			}
		}

		const shouldQueue =
			!isModelRecovery &&
			effectiveIsTaskRunning &&
			!isWaitingForUser &&
			!params.isFromQueue &&
			queueContext

		if (shouldQueue) {
			// Programmatic requests have their own content and must preserve the current draft.
			const shouldClearDraft = params.shouldClearEditorAfterSend !== false
			if (shouldClearDraft) tiptapEditorRef.current?.clearContentAfterSend()
			try {
				const workspace =
					editorContext?.selectedWorkspace ??
					workspaceStore.selectedWorkspace ??
					workspaceStore.firstWorkspace
				analyticsService.report("conversation_message_send_attempted", {
					topicId: selectedTopic?.id,
					projectId: selectedProject?.id,
					workspaceId: workspace?.id ?? selectedProject?.workspace_id,
					topicMode:
						getConversationTopicModeOverride(selectedTopic?.id) ??
						effectiveTopicMode ??
						selectedTopic?.topic_mode,
					workspaceType: workspace?.workspace_type,
				})
			} catch {
				// Analytics must never fail the queue path.
			}
			const queueId = await queueContext.addToQueue(
				buildQueueMessageInput(finalParams, params.value),
			)
			if (!queueId) {
				// Queue add failed — restore editor content so the user can retry
				if (shouldClearDraft && (finalParams.value ?? params.value)) {
					tiptapEditorRef.current?.setContent?.(finalParams.value ?? params.value)
				}
				if (params.throwOnError) throw new Error(ERR_QUEUE_ADD_FAILED)
				return false
			}
			sceneStateStore?.incrementSendCount()
			setFocused(false)
			return true
		}

		const selectedWorkspace =
			editorContext?.selectedWorkspace !== undefined
				? editorContext.selectedWorkspace
				: (workspaceStore.selectedWorkspace ?? workspaceStore.firstWorkspace)

		if (
			editorContext?.selectedWorkspace === undefined &&
			!workspaceStore.selectedWorkspace &&
			selectedWorkspace
		) {
			effectiveSetSelectedWorkspace(selectedWorkspace)
		}

		try {
			shouldShowHomeSendLoading = !selectedTopic?.id && !params.isFromQueue
			hasStartedSend = true
			isPreparingSendRef.current = true
			if (shouldShowHomeSendLoading) {
				setIsHomePreparingSend(true)
			}
			editorContext?.onSendStart?.({
				content: finalParams.value,
				mentionItems: finalParams.mentionItems,
			})
			const preparedSend = await preparePanelSend({
				params: finalParams,
				context: {
					selectedProject,
					selectedTopic,
					selectedWorkspace,
					creationScene: editorContext?.creationScene,
					setSelectedProject: editorContext?.setSelectedProject,
					setSelectedTopic: editorContext?.setSelectedTopic,
					refreshProjectAfterTopicRename: editorContext?.refreshProjectAfterTopicRename,
					setSelectedWorkspace: editorContext?.setSelectedWorkspace,
					// 与 _topicStore 回退一致，保证 smartRename 写入 topicStore.topics（历史列表合并依赖）。
					topicStore: _topicStore,
					createProject: editorContext?.createProject,
					createTopic: editorContext?.createTopic,
					getImplicitMentionItems: editorContext?.getImplicitMentionItems,
				},
				tabPattern: effectiveTopicMode,
				editorRef: tiptapEditorRef.current,
				messagesLength: editorContext?.messagesLength ?? 0,
			})

			if (!preparedSend || (params.canSend && !params.canSend())) {
				return false
			}

			sendResult = await scopedMessageSendService.sendPanelMessage({
				params: preparedSend.params,
				context: preparedSend.context,
				currentProject: preparedSend.currentProject,
				currentTopic: preparedSend.currentTopic,
				isSending,
				setIsSending,
				showLoading,
				isMobile,
				isEmptyStatus,
				tabPattern: effectiveTopicMode,
				editorRef: tiptapEditorRef.current,
				setFocused,
				messagesLength: editorContext?.messagesLength ?? 0,
			})

			if (sendResult) {
				releaseHtmlScreenshotsAfterSend(finalParams.mentionItems)
				editorContext?.onSendSuccess?.({
					currentProject: sendResult.currentProject ?? null,
					currentTopic: sendResult.currentTopic ?? null,
				})
				sceneStateStore?.incrementSendCount()
			}
			return Boolean(sendResult)
		} finally {
			// 无论成功、失败、接口报错，都释放锁，保证下次发送可以正常进入
			isPreparingSendRef.current = false
			if (shouldShowHomeSendLoading) {
				setIsHomePreparingSend(false)
			}
			if (hasStartedSend) {
				editorContext?.onSendComplete?.({
					success: Boolean(sendResult),
					currentProject: sendResult?.currentProject ?? null,
					currentTopic: sendResult?.currentTopic ?? null,
				})
			}
		}
	})

	useEffect(() => {
		// 这里只是把稳定的发送函数暴露给外层 ref 桥接；
		// effect 只依赖注册回调本身，避免 editorContext 整体重建时重复清空/重注册。
		onMessageSendReady?.(handleSend)
		return () => {
			onMessageSendReady?.(undefined, handleSend)
		}
	}, [handleSend, onMessageSendReady])

	const handleFocus = useMemoizedFn(() => {
		setIsFocused(true)
		editorContext?.onEditorFocus?.()
	})

	const handleBlur = useMemoizedFn(() => {
		setIsFocused(false)
		editorContext?.onEditorBlur?.()
	})

	const selectedWorkspace =
		editorContext?.selectedWorkspace !== undefined
			? editorContext.selectedWorkspace
			: (workspaceStore.selectedWorkspace ?? workspaceStore.firstWorkspace)

	const handleEnsureProject = useMemoizedFn(async () => {
		// Long pasted text uses the same temporary upload flow as normal attachments here.
		if (editorContext?.deferProjectCreationUntilSend) return selectedProject ?? null
		const ensuredProject = await ensureProjectForMessageContext({
			context: {
				selectedProject,
				selectedTopic,
				selectedWorkspace,
				setSelectedProject: editorContext?.setSelectedProject,
				setSelectedTopic: editorContext?.setSelectedTopic,
				setSelectedWorkspace: editorContext?.setSelectedWorkspace,
				topicStore: editorContext?.topicStore,
			},
			tabPattern: effectiveTopicMode,
		})

		return ensuredProject?.currentProject ?? null
	})

	useSandboxPreWarm({
		selectedTopic,
		selectedWorkspace,
		projectId: selectedProject?.id,
		editorRef: tiptapEditorRef.current?.editor,
	})

	useOfficialPromptsPayload({
		editorRef: tiptapEditorRef,
		setTopicMode: effectiveSetTopicMode,
		setIsFocused,
	})

	const topicExamplesPortalNode = useTopicExamplesPortal({
		editorRef: tiptapEditorRef,
		topicMode: editorContext?.topicExamplesMode ?? effectiveTopicMode,
	})

	const configPlaceholder = lt(editorContext?.placeholder)
	const placeholder = showLoading
		? t("messageEditor.placeholderLoading")
		: (configPlaceholder ??
			(superMagicModeService.getModePlaceholderWithLegacy(
				effectiveTopicMode,
				t,
				isMobile,
				selectedTopic?.agent_code,
			) ||
				t("messageEditor.placeholderTask")))
	const draftKey = editorContext?.draftKey

	const editorStyleProps = useMemo(
		() =>
			editorContext
				? {
						className: cn(
							editorContext.className,
							shouldFillHeight && "h-full min-h-0",
						),
						containerClassName: cn(
							editorContext.containerClassName,
							shouldFillHeight && "h-full min-h-0",
							// Let the shared resize controller own the desktop editor ceiling.
							shouldFillHeight && "!max-h-none",
							"border border-border",
						),
					}
				: {},
		[editorContext, shouldFillHeight],
	)

	return (
		<div className={cn("flex min-h-0 flex-col gap-1", shouldFillHeight && "h-full")}>
			<QueueDraftNotice context={queueContext} variant="warning" />
			<div className={cn("min-h-0", shouldFillHeight && "flex-1")}>
				<MessageEditor
					ref={bindEditorRef}
					loadingFallback={isDesktopProjectScene ? <MessageEditorSkeleton /> : null}
					headerContent={<QueueDraftNotice context={queueContext} />}
					{...editorStyleProps}
					placeholder={placeholder}
					promptCarousel={editorContext?.promptCarousel}
					onSend={handleSend}
					isTaskRunning={effectiveIsTaskRunning}
					onInterrupt={editorContext?.handleInterrupt}
					stopEventLoading={editorContext?.stopEventLoading}
					selectedTopic={selectedTopic}
					selectedProject={selectedProject}
					selectedWorkspace={selectedWorkspace}
					draftKey={draftKey}
					topicMode={effectiveTopicMode}
					modelTopicMode={editorContext?.modelTopicMode}
					agentCode={editorContext?.agentCode}
					size={editorContext?.size ?? "default"}
					modules={editorContext?.modules}
					isSending={isSending}
					sendButtonLoading={isHomePreparingSend}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onReady={handleEditorReady}
					onFileClick={editorContext?.onFileClick}
					onEnsureProject={handleEnsureProject}
					attachments={editorContext?.attachments}
					projectFilesStore={editorContext?.projectFilesStore}
					topicModelStore={editorContext?.topicModelStore}
					isEditingQueueItem={!!queueContext?.editingQueueItem}
					onCreateTopic={() =>
						createTopicForMessageContext({
							selectedProject,
							selectedTopic,
							selectedWorkspace,
							setSelectedProject: editorContext?.setSelectedProject,
							setSelectedTopic: editorContext?.setSelectedTopic,
							setSelectedWorkspace: editorContext?.setSelectedWorkspace,
							topicStore: editorContext?.topicStore,
						})
					}
					showLoading={showLoading}
					editorModeSwitch={editorContext?.editorModeSwitch}
					modelSwitch={editorContext?.modelSwitch}
					mentionPanelStore={mentionPanelStore}
					isAllowedMention={editorContext?.isAllowedMention}
					layoutConfig={editorContext?.layoutConfig}
					enableMessageSendByContent={editorContext?.enableMessageSendByContent ?? false}
					skipInitialDraftRestore={editorContext?.skipInitialDraftRestore}
				/>
			</div>
			{editorContext?.showTopicExamplesPortal ? topicExamplesPortalNode : null}
		</div>
	)
}

function appendPresetSuffixContent(
	value: JSONContent | undefined,
	presetSuffixContent: JSONContent | undefined,
): JSONContent | undefined {
	if (!value) return value
	if (!presetSuffixContent?.content?.length) return value

	const normalizedSuffixContent = generateTextFromJSONContent(presetSuffixContent).trim()
	if (!normalizedSuffixContent) return value
	const currentText = generateTextFromJSONContent(value).trimEnd()
	if (currentText.endsWith(normalizedSuffixContent)) return value

	const baseContent = value.type === "doc" ? (value.content ?? []) : [value]

	return {
		type: "doc",
		content: [...baseContent, ...(presetSuffixContent.content ?? [])],
	}
}
