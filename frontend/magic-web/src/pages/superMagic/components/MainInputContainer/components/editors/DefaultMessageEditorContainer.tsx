import { useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { JSONContent } from "@tiptap/core"
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
	preparePanelSend,
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
import { useOptionalSceneStateStore } from "../../stores"
import { cn } from "@/lib/utils"
import {
	buildPlainTextJSONContent,
	generateTextFromJSONContent,
} from "@/pages/superMagic/components/MessageEditor/utils"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"

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
	const sceneStateStore = useOptionalSceneStateStore()

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
	const _topicStore = editorContext?.topicStore ?? topicStore
	const scopedMessageSendService = useMemo(
		() =>
			createMessageSendService({
				mentionPanelStore,
			}),
		[mentionPanelStore],
	)

	const selectedProject = editorContext?.selectedProject ?? projectStore.selectedProject
	const selectedTopic = editorContext?.selectedTopic ?? _topicStore.selectedTopic
	const effectiveTopicMode = editorContext?.topicMode ?? roleStore.currentRole
	const effectiveSetTopicMode = editorContext?.setTopicMode ?? roleStore.setCurrentRole
	const effectiveSetSelectedWorkspace =
		editorContext?.setSelectedWorkspace ?? workspaceStore.setSelectedWorkspace
	const queueContext = editorContext?.queueContext
	const showLoading = editorContext?.showLoading ?? false
	const isEmptyStatus = editorContext?.isEmptyStatus ?? true

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
					tiptapEditorRef.current?.focus?.({ enableWhenIsMobile: true })
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
	}, [editorContext?.autoFocus, tiptapEditorRef])

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

	const prevEditingQueueItemRef = useRef(queueContext?.editingQueueItem ?? null)

	useEffect(() => {
		const currentEditingItem = queueContext?.editingQueueItem ?? null
		const prevEditingItem = prevEditingQueueItemRef.current
		const currentEditingId = currentEditingItem?.id
		const prevEditingId = prevEditingItem?.id

		if (currentEditingItem && tiptapEditorRef.current) {
			if (!prevEditingId || currentEditingId !== prevEditingId) {
				setTimeout(() => {
					tiptapEditorRef.current?.setContent?.(currentEditingItem.content)
					const ed = tiptapEditorRef.current?.editor
					if (ed && !ed.isDestroyed) {
						try {
							ed.commands.focus()
						} catch {
							// view may not be mounted yet
						}
					}
				}, 100)
			}
		} else if (!currentEditingItem && prevEditingItem && tiptapEditorRef.current) {
			tiptapEditorRef.current?.clearContent()
			setFocused(false)
		}

		prevEditingQueueItemRef.current = currentEditingItem
	}, [queueContext?.editingQueueItem, tiptapEditorRef, setFocused])

	const handleSend = useMemoizedFn(async (params: HandleSendParams) => {
		let hasStartedSend = false
		let sendResult:
			| {
					currentProject: typeof selectedProject
					currentTopic: typeof selectedTopic
			  }
			| undefined
		let shouldShowHomeSendLoading = false

		const nextValue = appendPresetSuffixContent(
			params.value,
			sceneStateStore?.presetSuffixContent,
		)

		if (queueContext?.editingQueueItem) {
			if (!params.queueId || params.queueId === queueContext.editingQueueItem.id) {
				queueContext.finishEditQueueItem(nextValue, params.mentionItems)
				tiptapEditorRef.current?.clearContentAfterSend()
				setFocused(false)
				return
			}
		}

		// isPreparingSendRef 用于拦截弱网下的并发请求创建话题接口：
		// isSending 基于 useState，赋值异步，无法在创建话题接口响应回来之前生效；
		// isPreparingSendRef 基于 useRef，赋值同步立即生效，覆盖从发起创建话题到发送消息完成的完整阶段
		if (!params.value || isSending || isPreparingSendRef.current) {
			return
		}

		/**
		 * IMPORTANT:
		 * waiting_for_user 是 AskUser 独有状态，表示当前轮到用户输入。
		 * 此时用户的输入应当直接发送，不应进入消息队列排队。
		 */
		const isWaitingForUser = selectedTopic?.task_status === TaskStatus.WAITING_FOR_USER

		if (showLoading && !isWaitingForUser && !params.isFromQueue && queueContext) {
			queueContext.addToQueue({
				content: nextValue ?? params.value,
				mentionItems: params.mentionItems,
				selectedModel: params.selectedModel,
				selectedImageModel: params.selectedImageModel,
				selectedVideoModel: params.selectedVideoModel,
				topicMode: params.topicMode,
			})
			tiptapEditorRef.current?.clearContentAfterSend()
			setFocused(false)
			return
		}

		const selectedWorkspace =
			editorContext?.selectedWorkspace ??
			workspaceStore.selectedWorkspace ??
			workspaceStore.firstWorkspace

		if (
			!editorContext?.selectedWorkspace &&
			!workspaceStore.selectedWorkspace &&
			selectedWorkspace
		) {
			effectiveSetSelectedWorkspace(selectedWorkspace)
		}

		try {
			const defaultParams: HandleSendParams = {
				...params,
				value: nextValue ?? params.value,
				extra:
					effectiveTopicMode === TopicMode.CustomAgent && editorContext?.agentCode
						? {
								...params.extra,
								agent_code: editorContext.agentCode,
							}
						: params.extra,
			}
			const customParamsPatch = editorContext?.mergeSendParams?.({
				defaultParams,
			})

			const finalParams = customParamsPatch
				? { ...defaultParams, ...customParamsPatch }
				: defaultParams
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
					setSelectedProject: editorContext?.setSelectedProject,
					setSelectedTopic: editorContext?.setSelectedTopic,
					setSelectedWorkspace: editorContext?.setSelectedWorkspace,
					// 与 _topicStore 回退一致，保证 smartRename 写入 topicStore.topics（历史列表合并依赖）。
					topicStore: _topicStore,
					createProject: editorContext?.createProject,
					createTopic: editorContext?.createTopic,
				},
				tabPattern: effectiveTopicMode,
				editorRef: tiptapEditorRef.current,
				messagesLength: editorContext?.messagesLength ?? 0,
			})

			if (!preparedSend) {
				return
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
				editorContext?.onSendSuccess?.({
					currentProject: sendResult.currentProject ?? null,
					currentTopic: sendResult.currentTopic ?? null,
				})
				sceneStateStore?.incrementSendCount()
			}
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

	const handleFocus = useMemoizedFn(() => {
		setIsFocused(true)
		editorContext?.onEditorFocus?.()
	})

	const handleBlur = useMemoizedFn(() => {
		setIsFocused(false)
		editorContext?.onEditorBlur?.()
	})

	useSandboxPreWarm({
		selectedTopic,
		selectedWorkspace:
			editorContext?.selectedWorkspace ??
			workspaceStore.selectedWorkspace ??
			workspaceStore.firstWorkspace,
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
	const selectedWorkspace =
		editorContext?.selectedWorkspace ??
		workspaceStore.selectedWorkspace ??
		workspaceStore.firstWorkspace
	const draftKey = editorContext?.draftKey

	const editorStyleProps = useMemo(
		() =>
			editorContext
				? {
						className: editorContext.className,
						containerClassName: cn(
							editorContext.containerClassName,
							"border border-border",
						),
					}
				: {},
		[editorContext],
	)

	return (
		<>
			<MessageEditor
				ref={tiptapEditorRef}
				{...editorStyleProps}
				placeholder={placeholder}
				onSend={handleSend}
				isTaskRunning={showLoading}
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				selectedWorkspace={selectedWorkspace}
				draftKey={draftKey}
				topicMode={effectiveTopicMode}
				size={editorContext?.size ?? "default"}
				modules={editorContext?.modules}
				isSending={isSending}
				sendButtonLoading={isHomePreparingSend}
				onFocus={handleFocus}
				onBlur={handleBlur}
				onFileClick={editorContext?.onFileClick}
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
			{editorContext?.showTopicExamplesPortal ? topicExamplesPortalNode : null}
		</>
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
