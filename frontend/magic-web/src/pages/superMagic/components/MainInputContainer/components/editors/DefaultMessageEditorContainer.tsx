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
import { roleStore } from "@/pages/superMagic/stores"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import useSharedProjectMode from "@/pages/superMagic/hooks/useSharedProjectMode"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import useSandboxPreWarm from "@/pages/superMagic/components/MessagePanel/hooks/useSandboxPreWarm"
import { useNanoBananaPrompt } from "@/pages/superMagic/hooks/useNanoBananaPrompt"
import useTopicExamplesPortal from "@/pages/superMagic/hooks/useTopicExamplesPortal"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/store"
import type { SceneEditorContext, SceneEditorNodes } from "./types"
import { useOptionalSceneStateStore } from "../../stores"
import { cn } from "@/lib/utils"
import { generateTextFromJSONContent } from "@/pages/superMagic/components/MessageEditor/utils"

interface DefaultMessageEditorContainerProps {
	editorContext?: SceneEditorContext
	editorNodes?: SceneEditorNodes
	editorRef?: RefObject<MessageEditorRef>
}

export default function DefaultMessageEditorContainer(props: DefaultMessageEditorContainerProps) {
	const { editorContext, editorRef } = props
	const { t } = useTranslation("super")
	const lt = useLocaleText()
	const isMobile = useIsMobile()
	const sceneStateStore = useOptionalSceneStateStore()

	const internalEditorRef = useRef<MessageEditorRef>(null)
	const tiptapEditorRef = editorRef ?? internalEditorRef

	const [isSending, setIsSending] = useState(false)
	const [, setFocused] = useState(false)
	const [, setIsFocused] = useState(false)

	const mentionPanelStore = editorContext?.mentionPanelStore ?? GlobalMentionPanelStore
	const _topicStore = editorContext?.topicStore ?? topicStore
	const scopedMessageSendService = useMemo(
		() =>
			createMessageSendService({
				mentionPanelStore,
				topicStore: _topicStore,
			}),
		[_topicStore, mentionPanelStore],
	)

	const selectedProject = editorContext?.selectedProject ?? projectStore.selectedProject
	const selectedTopic = editorContext?.selectedTopic ?? topicStore.selectedTopic
	const effectiveTopicMode = editorContext?.topicMode ?? roleStore.currentRole
	const effectiveSetTopicMode = editorContext?.setTopicMode ?? roleStore.setCurrentRole
	const queueContext = editorContext?.queueContext
	const showLoading = editorContext?.showLoading ?? false
	const isEmptyStatus = editorContext?.isEmptyStatus ?? true

	useSharedProjectMode({ setTopicMode: effectiveSetTopicMode })

	useEffect(() => {
		if (!editorContext?.autoFocus) return
		// 代理 input 已唤起键盘，此处等待 Vaul Drawer 过渡动画结束后再转移焦点，
		// 避免动画期间 focus() 在部分 iOS 版本上定位错乱或静默失败
		const timer = setTimeout(() => {
			tiptapEditorRef.current?.focus?.({ enableWhenIsMobile: true })
		}, 100)
		return () => clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if (!editorContext?.initialContent) return
		// useEffect 运行时子组件 useImperativeHandle 已完成，tiptapEditorRef.current 可用，
		// 直接写入内容以消除弹窗打开时的 placeholder 闪烁（不再需要 setTimeout）
		tiptapEditorRef.current?.setContent?.(editorContext.initialContent)
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
					tiptapEditorRef.current?.editor?.commands.focus()
				}, 100)
			}
		} else if (!currentEditingItem && prevEditingItem && tiptapEditorRef.current) {
			tiptapEditorRef.current?.clearContent()
			setFocused(false)
		}

		prevEditingQueueItemRef.current = currentEditingItem
	}, [queueContext?.editingQueueItem, tiptapEditorRef, setFocused])

	const handleSend = useMemoizedFn(async (params: HandleSendParams) => {
		const nextValue = appendPresetSuffixContent(
			params.value,
			sceneStateStore?.presetSuffixContent ?? "",
		)

		if (queueContext?.editingQueueItem) {
			if (!params.queueId || params.queueId === queueContext.editingQueueItem.id) {
				queueContext.finishEditQueueItem(nextValue, params.mentionItems)
				tiptapEditorRef.current?.clearContent()
				setFocused(false)
				return
			}
		}

		if (!params.value || isSending) {
			return
		}

		if (showLoading && !params.isFromQueue && queueContext) {
			queueContext.addToQueue({
				content: nextValue ?? params.value,
				mentionItems: params.mentionItems,
				selectedModel: params.selectedModel,
				selectedImageModel: params.selectedImageModel,
				topicMode: params.topicMode,
			})
			tiptapEditorRef.current?.clearContent()
			setFocused(false)
			return
		}

		const selectedWorkspace = workspaceStore.selectedWorkspace ?? workspaceStore.firstWorkspace

		if (!workspaceStore.selectedWorkspace && selectedWorkspace) {
			workspaceStore.setSelectedWorkspace(selectedWorkspace)
		}

		const defaultParams: HandleSendParams = {
			...params,
			value: nextValue ?? params.value,
		}
		const customParamsPatch = editorContext?.mergeSendParams?.({
			defaultParams,
		})

		const sendResult = await scopedMessageSendService.sendPanelMessage({
			params: customParamsPatch ? { ...defaultParams, ...customParamsPatch } : defaultParams,
			isSending,
			setIsSending,
			showLoading,
			isMobile,
			isEmptyStatus,
			tabPattern: effectiveTopicMode,
			editorRef: tiptapEditorRef.current,
			setFocused,
			selectedProject,
			selectedTopic,
			messagesLength: editorContext?.messagesLength ?? 0,
			setSelectedProject:
				editorContext?.setSelectedProject ?? projectStore.setSelectedProject,
			setSelectedTopic: editorContext?.setSelectedTopic ?? topicStore.setSelectedTopic,
		})

		editorContext?.onSendSuccess?.({
			currentProject: sendResult?.currentProject ?? null,
			currentTopic: sendResult?.currentTopic ?? null,
		})
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
		selectedWorkspace: workspaceStore.selectedWorkspace ?? workspaceStore.firstWorkspace,
		editorRef: tiptapEditorRef.current?.editor,
	})

	useNanoBananaPrompt({
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
			(superMagicModeService.getModePlaceholderWithLegacy(effectiveTopicMode, t, isMobile) ||
				t("messageEditor.placeholderTask")))
	const selectedWorkspace = workspaceStore.selectedWorkspace ?? workspaceStore.firstWorkspace
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
				onInterrupt={editorContext?.onInterrupt}
				selectedTopic={selectedTopic}
				selectedProject={selectedProject}
				selectedWorkspace={selectedWorkspace}
				draftKey={draftKey}
				topicMode={effectiveTopicMode}
				size={editorContext?.size ?? "default"}
				modules={editorContext?.modules}
				isSending={isSending}
				onFocus={handleFocus}
				onBlur={handleBlur}
				onFileClick={editorContext?.onFileClick}
				attachments={editorContext?.attachments}
				isEditingQueueItem={!!queueContext?.editingQueueItem}
				onCreateTopic={() =>
					scopedMessageSendService.createTopic({
						selectedProject,
					})
				}
				showLoading={showLoading}
				editorModeSwitch={editorContext?.editorModeSwitch}
				mentionPanelStore={mentionPanelStore}
				layoutConfig={editorContext?.layoutConfig}
				enableMessageSendByContent={editorContext?.enableMessageSendByContent ?? false}
			/>
			{editorContext?.showTopicExamplesPortal ? topicExamplesPortalNode : null}
		</>
	)
}

function appendPresetSuffixContent(
	value: JSONContent | undefined,
	presetSuffixContent: string,
): JSONContent | undefined {
	if (!value) return value

	const normalizedSuffixContent = presetSuffixContent.trim()
	if (!normalizedSuffixContent) return value

	const currentText = generateTextFromJSONContent(value).trimEnd()
	if (currentText.endsWith(normalizedSuffixContent)) return value

	const suffixDoc = buildTextJSONContent(normalizedSuffixContent)
	const baseContent = value.type === "doc" ? (value.content ?? []) : [value]

	return {
		type: "doc",
		content: [...baseContent, ...(suffixDoc.content ?? [])],
	}
}

function buildTextJSONContent(text: string): JSONContent {
	const paragraphs = text
		.split(/\n{2,}/)
		.filter((paragraph) => paragraph.trim())
		.map((paragraph) => ({
			type: "paragraph",
			content: [{ type: "text", text: paragraph }],
		}))

	if (paragraphs.length === 0) {
		return {
			type: "doc",
			content: [],
		}
	}

	return {
		type: "doc",
		content: paragraphs,
	}
}
