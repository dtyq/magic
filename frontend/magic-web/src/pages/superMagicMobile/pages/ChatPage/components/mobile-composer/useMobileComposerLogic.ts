import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react"
import type { JSONContent } from "@tiptap/core"
import type { Editor } from "@tiptap/react"
import { useAsyncEffect, useCreation, useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import type {
	MentionListItem,
	MentionRemoveItemPayload,
} from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import {
	McpMentionData,
	MentionItemType,
	type MentionSelectContext,
} from "@/components/business/MentionPanel/types"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import type { VoiceInputRef } from "@/components/business/VoiceInput"
import { useIsMobile } from "@/hooks/useIsMobile"
import { userStore } from "@/models/user"
import { useLocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/hooks/useLocaleText"
import { useOptionalSceneStateStore } from "@/pages/superMagic/components/MainInputContainer/stores"
import useChooseUploadDirModal from "@/pages/superMagic/components/MessageEditor/hooks/useChooseUploadDirModal"
import useMessageEditorPubSub from "@/pages/superMagic/components/MessageEditor/hooks/useMessageEditorPubSub"
import { useMessageEditor } from "@/pages/superMagic/components/MessageEditor/hooks/useMessageEditor"
import useMessageSendHandler from "@/pages/superMagic/components/MessageEditor/hooks/useMessageSendHandler"
import useResolvedEditorStore from "@/pages/superMagic/components/MessageEditor/hooks/useResolvedEditorStore"
import useSharedDataFromApp from "@/pages/superMagic/components/MessageEditor/hooks/useSharedDataFromApp"
import { useSlideContentSync } from "@/pages/superMagic/components/MessageEditor/hooks/useSlideContentSync"
import useSyncEditorStoreState from "@/pages/superMagic/components/MessageEditor/hooks/useSyncEditorStoreState"
import { useMessageEditorMarker } from "@/pages/superMagic/components/MessageEditor/hooks/useMessageEditorMarker"
import type {
	FileData,
	ModelItem,
	SendMessageByContentPayload,
} from "@/pages/superMagic/components/MessageEditor/types"
import { generateTextFromJSONContent } from "@/pages/superMagic/components/MessageEditor/utils"
import { resolveMessageEditorModules } from "@/pages/superMagic/components/MessageEditor/utils/moduleConfig"
import useUploadMentionFlow from "@/pages/superMagic/components/MessageEditor/hooks/useUploadMentionFlow"
import { useMessageEditorProvider } from "@/pages/superMagic/components/MessageEditor/MessageEditorProvider"
import type { MessageEditorRef } from "@/pages/superMagic/components/MessageEditor/MessageEditorContainer"
import { createMessageSendService } from "@/pages/superMagic/services/messageSendFlowService"
import type { HandleSendParams } from "@/pages/superMagic/services/messageSendFlowService"
import { preparePanelSend } from "@/pages/superMagic/services/messageSendPreparation"
import { useTaskInterrupt } from "@/pages/superMagic/hooks/useTaskInterrupt"
import { projectStore, topicStore, workspaceStore } from "@/pages/superMagic/stores/core"
import { roleStore } from "@/pages/superMagic/stores"
import superMagicModeService from "@/services/superMagic/SuperMagicModeService"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	checkMCPOAuth,
	MCPOAuthType,
} from "@/components/Agent/MCP/AgentSettings/AgentPanel/MCPPanel/helpers"
import { getMCPAccess } from "@/components/Agent/MCP/store/mcp-access"
import { openMessageFile } from "@/pages/superMagic/components/MessageList/utils/openMessageFile"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { resetDocumentScrollPosition } from "@/utils/scroll"

interface ReEditPayload {
	content?: JSONContent | string
	extra?: {
		super_agent?: {
			mentions?: MentionListItem[]
		}
	}
}

interface UseMobileComposerLogicParams {
	editorContext: SceneEditorContext
	enableReEditMessageFromPubSub?: boolean
}

export interface MobileComposerLogic {
	parentStore: ReturnType<typeof useResolvedEditorStore>["parentStore"]
	store: ReturnType<typeof useResolvedEditorStore>["store"]
	domRef: React.RefObject<HTMLDivElement>
	tiptapEditor: ReturnType<typeof useMessageEditor>["tiptapEditor"]
	tiptapEditorRef: React.MutableRefObject<MessageEditorRef | null>
	voiceInputRef: React.RefObject<VoiceInputRef>
	uploadModal: React.ReactNode
	placeholder: string
	isComposerFocused: boolean
	showLoading: boolean
	isPreparingSend: boolean
	isTaskRunning: boolean
	stopEventLoading: boolean
	selectedTopic: SceneEditorContext["selectedTopic"]
	selectedProject: SceneEditorContext["selectedProject"]
	effectiveTopicMode: SceneEditorContext["topicMode"]
	mentionPanelStore: typeof GlobalMentionPanelStore
	uploadEnabled: boolean
	voiceInputEnabled: boolean
	mcpStorageKey?: string
	mcpUseTempStorage: boolean
	selectedPluginCount: number
	handleSend: () => void
	handleInterrupt: () => void
	handleFileUploadClick: (files: FileList) => void
	handleRemoveUploadedFile: (file: FileData) => void
	handleSelectMentionItem: (item: TiptapMentionAttributes) => Promise<void>
	/** 将焦点恢复到底部 TipTap 编辑器（移动端会 scrollIntoView） */
	focusComposerEditor: () => void
	handlePaste: (event: React.ClipboardEvent) => void
	handleCompositionStart: () => void
	handleCompositionEnd: () => void
	handleBlurComposer: () => void
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

export default function useMobileComposerLogic({
	editorContext,
	enableReEditMessageFromPubSub = false,
}: UseMobileComposerLogicParams): MobileComposerLogic {
	const { t } = useTranslation("super")
	const lt = useLocaleText()
	const isMobile = useIsMobile()
	const sceneStateStore = useOptionalSceneStateStore()
	const { config: providerConfig } = useMessageEditorProvider()
	const [isSending, setIsSending] = useState(false)
	const [isPreparingSend, setIsPreparingSend] = useState(false)
	const [isComposerFocused, setIsComposerFocused] = useState(false)
	const mentionPanelStore =
		(editorContext.mentionPanelStore as typeof GlobalMentionPanelStore | undefined) ??
		GlobalMentionPanelStore

	const { store, parentStore } = useResolvedEditorStore({
		mentionPanelStore,
		projectFilesStore: editorContext.projectFilesStore,
		topicModelStore: editorContext.topicModelStore,
	})

	const selectedProject = editorContext.selectedProject ?? projectStore.selectedProject
	const selectedTopic = editorContext.selectedTopic ?? topicStore.selectedTopic
	const effectiveTopicMode = editorContext.topicMode ?? roleStore.currentRole
	const currentAgentCode = editorContext.agentCode ?? selectedTopic?.agent_code
	const effectiveSetSelectedWorkspace =
		editorContext.setSelectedWorkspace ?? workspaceStore.setSelectedWorkspace
	const selectedWorkspace =
		editorContext.selectedWorkspace ??
		workspaceStore.selectedWorkspace ??
		workspaceStore.firstWorkspace
	const modePlaceholder =
		lt(editorContext.placeholder) ??
		superMagicModeService.getModePlaceholderWithLegacy(
			effectiveTopicMode,
			t,
			isMobile,
			currentAgentCode,
		)
	const placeholder = editorContext.showLoading
		? t("messageEditor.placeholderLoading")
		: (modePlaceholder ??
			(effectiveTopicMode === TopicMode.CustomAgent
				? ""
				: t("messageEditor.placeholderTask")))

	useSyncEditorStoreState({
		store,
		draftKey: editorContext.draftKey,
		mentionPanelStore,
		isSending,
		isTaskRunning: editorContext.isTaskRunning ?? editorContext.showLoading ?? false,
	})

	const resolvedModules = useMemo(
		() =>
			resolveMessageEditorModules({
				modules: editorContext.modules,
				layoutConfig: editorContext.layoutConfig,
				providerConfig,
			}),
		[editorContext.layoutConfig, editorContext.modules, providerConfig],
	)

	const shouldEnableMention = resolvedModules.mention.enabled
	const uploadEnabled = resolvedModules.upload.enabled
	const voiceInputEnabled = resolvedModules.voiceInput.enabled
	const sendEnabled = resolvedModules.send.enabled
	const mcpButtonConfig = resolvedModules.mcp
	const fileUploadStore = store.fileUploadStore
	const mcpStorageKey = mcpButtonConfig.storageKey ?? selectedProject?.id
	const mcpUseTempStorage = mcpButtonConfig.useTempStorage
	const mcpAccess = useCreation(
		() =>
			getMCPAccess({
				storageKey: mcpStorageKey,
				useTempStorage: mcpUseTempStorage,
			}),
		[mcpStorageKey, mcpUseTempStorage],
	)
	const selectedPluginCount = mcpAccess.mcpList.length

	const voiceInputRef = useRef<VoiceInputRef>(null)
	const tiptapEditorRef = useRef<MessageEditorRef | null>(null)
	const tiptapCoreRef = useRef<Editor | null>(null) as MutableRefObject<Editor | null>
	const isMountedRef = useRef(true)
	const isPreparingSendRef = useRef(false)
	const shouldSkipMentionRemoveSyncRef = useRef(false)

	const getEditor = useMemoizedFn(() => tiptapCoreRef.current)
	const runWithoutMentionRemoveSync = useMemoizedFn((callback: () => void) => {
		shouldSkipMentionRemoveSyncRef.current = true
		try {
			callback()
		} finally {
			shouldSkipMentionRemoveSyncRef.current = false
		}
	})

	const {
		files,
		addFiles: addFilesRaw,
		clearFiles,
		clearFilesLocalOnly,
		isAllFilesUploaded,
		validateFileSize,
		validateFileCount,
		collectMentionItemsFromContent,
		collectMentionItemsFromEditor,
		handleRemoveFile,
		handleRemoveUploadedFile,
		handleMentionRemoveItems: handleUploadMentionRemoveItems,
		shouldRestoreRemovedMention,
	} = useUploadMentionFlow({
		fileUploadStore,
		mentionPanelStore,
		getEditor,
		isProjectContext: Boolean(selectedProject?.id),
		isQueueDraftMode: false,
		confirmDelete: resolvedModules.upload.confirmDelete,
		runWithoutMentionRemoveSync,
		selectedProjectId: selectedProject?.id,
		selectedTopicId: selectedTopic?.id,
		t,
	})

	const { handleMarkerMentionRemove, hasLoadingMarker, syncInsertedMarkersToManager } =
		useMessageEditorMarker({
			getEditor,
			content: store.editorStore.value,
		})

	const handleMentionRemove = useMemoizedFn((mentionAttrs: TiptapMentionAttributes) => {
		handleMarkerMentionRemove(mentionAttrs)
		handleRemoveFile(mentionAttrs)
	})

	const handleMentionRemoveItems = useMemoizedFn((items: MentionRemoveItemPayload[]) => {
		items.forEach(({ item, stillExists, deletionInput }) => {
			if (stillExists) return
			if (item.type === MentionItemType.DESIGN_MARKER) {
				handleMarkerMentionRemove(item)
				return
			}
			handleUploadMentionRemoveItems([{ item, stillExists, deletionInput }])
		})
	})

	const { addFilesWithDir, UploadModal } = useChooseUploadDirModal({
		addFiles: addFilesRaw,
		selectedProject,
		attachments: editorContext.attachments,
		validateFileSize,
		validateFileCount,
	})

	const addFiles = useMemoizedFn(async (inputFiles: File[]) => {
		if (!uploadEnabled) return
		await addFilesWithDir(inputFiles)
	})

	const setValue = useMemoizedFn((content: JSONContent | undefined) => {
		store.setValue({
			value: content,
			mentionPanelStore,
		})
	})

	const clearContent = useMemoizedFn(() => {
		pubsub.publish(PubSubEvents.Super_Magic_Clear_Canvas_Markers, {})
		setValue(undefined)
		tiptapCoreRef.current?.commands.clearContent()
		clearFiles()
	})

	const clearContentAfterSend = useMemoizedFn(() => {
		shouldSkipMentionRemoveSyncRef.current = true
		try {
			pubsub.publish(PubSubEvents.Super_Magic_Clear_Canvas_Markers, {})
			setValue(undefined)
			tiptapCoreRef.current?.commands.clearContent()
			clearFilesLocalOnly()
		} finally {
			shouldSkipMentionRemoveSyncRef.current = false
		}
	})

	const handleKeyboardInput = useMemoizedFn(() => {
		if (voiceInputRef.current?.isRecording) voiceInputRef.current.stopRecording()
	})

	const canSendMessage = useMemo(() => {
		if (!sendEnabled) return false
		if (hasLoadingMarker) return false
		if (isPreparingSend) return false
		if (editorContext.queueContext?.editingQueueItem) return isAllFilesUploaded && !isSending

		return !store.editorStore.isEmpty && isAllFilesUploaded && !isSending
	}, [
		editorContext.queueContext?.editingQueueItem,
		hasLoadingMarker,
		isAllFilesUploaded,
		isPreparingSend,
		isSending,
		sendEnabled,
		store.editorStore.isEmpty,
	])

	const handleFocus = useMemoizedFn(() => {
		setIsComposerFocused(true)
		editorContext.onEditorFocus?.()
	})

	const handleBlur = useMemoizedFn(() => {
		store.draftStore.saveDraftOnBlur({
			value: store.editorStore.value,
			onError: (error) => {
				if (isMountedRef.current) console.error("Failed to save draft on blur:", error)
			},
		})
		setIsComposerFocused(false)
		editorContext.onEditorBlur?.()
		resetDocumentScrollPosition()
	})

	const scopedMessageSendService = useMemo(
		() =>
			createMessageSendService({
				mentionPanelStore,
			}),
		[mentionPanelStore],
	)

	const handleSendToServer = useMemoizedFn(async (params: HandleSendParams) => {
		const nextValue = appendPresetSuffixContent(
			params.value,
			sceneStateStore?.presetSuffixContent,
		)

		if (isSending || isPreparingSendRef.current) return

		const queueContext = editorContext.queueContext
		if (queueContext?.editingQueueItem) {
			if (!params.queueId || params.queueId === queueContext.editingQueueItem.id) {
				isPreparingSendRef.current = true
				setIsPreparingSend(true)

				try {
					queueContext.finishEditQueueItem(nextValue, params.mentionItems)
					clearContentAfterSend()
					setIsComposerFocused(false)
				} finally {
					isPreparingSendRef.current = false
					setIsPreparingSend(false)
				}
				return
			}
		}

		if (!params.value) return

		isPreparingSendRef.current = true
		setIsPreparingSend(true)

		try {
			const isWaitingForUser = selectedTopic?.task_status === TaskStatus.WAITING_FOR_USER
			const showLoading = editorContext.showLoading ?? false
			if (showLoading && !isWaitingForUser && !params.isFromQueue && queueContext) {
				queueContext.addToQueue({
					content: nextValue ?? params.value,
					mentionItems: params.mentionItems,
					selectedModel: params.selectedModel,
					selectedImageModel: params.selectedImageModel,
					selectedVideoModel: params.selectedVideoModel,
					topicMode: params.topicMode,
				})
				clearContentAfterSend()
				setIsComposerFocused(false)
				return
			}

			if (
				!editorContext.selectedWorkspace &&
				!workspaceStore.selectedWorkspace &&
				selectedWorkspace
			) {
				effectiveSetSelectedWorkspace(selectedWorkspace)
			}

			const defaultParams: HandleSendParams = {
				...params,
				value: nextValue ?? params.value,
				extra:
					effectiveTopicMode === TopicMode.CustomAgent && editorContext.agentCode
						? {
								...params.extra,
								agent_code: editorContext.agentCode,
							}
						: params.extra,
			}
			const customParamsPatch = editorContext.mergeSendParams?.({
				defaultParams,
			})
			const finalParams = customParamsPatch
				? { ...defaultParams, ...customParamsPatch }
				: defaultParams

			const preparedSend = await preparePanelSend({
				params: finalParams,
				context: {
					selectedProject,
					selectedTopic,
					selectedWorkspace,
					setSelectedProject: editorContext.setSelectedProject,
					setSelectedTopic: editorContext.setSelectedTopic,
					setSelectedWorkspace: editorContext.setSelectedWorkspace,
					topicStore: editorContext.topicStore ?? topicStore,
				},
				tabPattern: effectiveTopicMode,
				editorRef: tiptapEditorRef.current,
				messagesLength: editorContext.messagesLength ?? 0,
			})

			if (!preparedSend) return

			const sendResult = await scopedMessageSendService.sendPanelMessage({
				params: preparedSend.params,
				context: preparedSend.context,
				currentProject: preparedSend.currentProject,
				currentTopic: preparedSend.currentTopic,
				isSending,
				setIsSending,
				showLoading,
				isMobile,
				isEmptyStatus: editorContext.isEmptyStatus ?? true,
				tabPattern: effectiveTopicMode,
				editorRef: tiptapEditorRef.current,
				setFocused: setIsComposerFocused,
				messagesLength: editorContext.messagesLength ?? 0,
			})

			editorContext.onSendSuccess?.({
				currentProject: sendResult?.currentProject ?? null,
				currentTopic: sendResult?.currentTopic ?? null,
			})
			editorContext.onSendComplete?.({
				success: Boolean(sendResult),
				currentProject: sendResult?.currentProject ?? null,
				currentTopic: sendResult?.currentTopic ?? null,
			})
		} finally {
			isPreparingSendRef.current = false
			setIsPreparingSend(false)
		}
	})

	const handleSend = useMessageSendHandler({
		voiceInputRef,
		canSendMessage,
		hasLoadingMarker,
		isAllFilesUploaded,
		store,
		t,
		onSend: handleSendToServer,
		topicMode: effectiveTopicMode,
		collectMentionItemsFromEditor,
		isMountedRef,
	})

	const { tiptapEditor, domRef } = useMessageEditor({
		value: store.editorStore.value,
		onSend: handleSend,
		placeholder,
		onMentionInsertItems: (items) => {
			syncInsertedMarkersToManager(items)
		},
		onChange: setValue,
		onMentionRemove: handleMentionRemove,
		onMentionRemoveItems: handleMentionRemoveItems,
		selectedTopic,
		onKeyboardInput: handleKeyboardInput,
		shouldEnableMention,
		sendEnabled,
		aiCompletionEnabled: resolvedModules.aiCompletion.enabled,
		isOAuthInProgress: store.editorStore.isOAuthInProgress,
		onFocus: handleFocus,
		onBlur: handleBlur,
		size: "mobile",
		topicMode: effectiveTopicMode,
		mentionPanelStore,
		isAllowedMention: editorContext.isAllowedMention,
		shouldSkipRemoveSync: () => shouldSkipMentionRemoveSyncRef.current,
		shouldRestoreRemovedMention,
	})

	const updateContent = useMemoizedFn((content: JSONContent | undefined) => {
		store.editorStore.updateContent(content)
		if (tiptapCoreRef.current && content) {
			tiptapCoreRef.current.commands.setContent(content)
		}
	})

	const focusEditor = useMemoizedFn(() => {
		tiptapCoreRef.current?.commands.focus()
		if (isMobile) tiptapCoreRef.current?.commands.scrollIntoView()
	})

	useEffect(() => {
		tiptapCoreRef.current = tiptapEditor
		store.editorStore.setEditor(tiptapEditor)
		return () => {
			tiptapCoreRef.current = null
		}
	}, [store.editorStore, tiptapEditor])

	const handleSendMessageByContent = useMemoizedFn((data: SendMessageByContentPayload) => {
		handleSendToServer({
			value: data.jsonContent,
			mentionItems: data.mentionItems ?? collectMentionItemsFromContent(data.jsonContent),
			selectedModel: data.selectedModel ?? store.topicModelStore.selectedLanguageModel,
			selectedImageModel: data.selectedImageModel ?? store.topicModelStore.selectedImageModel,
			selectedVideoModel: data.selectedVideoModel ?? store.topicModelStore.selectedVideoModel,
			topicMode: data.topicMode ?? effectiveTopicMode,
			shouldClearEditorAfterSend: data.shouldClearEditorAfterSend,
			extra: data.extra,
		})
	})

	const setModels = useMemoizedFn(
		({
			languageModel,
			imageModel,
			videoModel,
		}: {
			languageModel?: ModelItem | null
			imageModel?: ModelItem | null
			videoModel?: ModelItem | null
		}) => {
			store.topicModelStore.setSelectedLanguageModel(languageModel ?? null)
			store.topicModelStore.setSelectedImageModel(imageModel ?? null)
			store.topicModelStore.setSelectedVideoModel(videoModel ?? null)
		},
	)

	useEffect(() => {
		tiptapEditorRef.current = {
			editor: tiptapCoreRef.current,
			canSendMessage,
			getFiles: () => files,
			clearFiles,
			getValue: () => store.editorStore.value,
			clearContent,
			clearContentAfterSend,
			setContent: updateContent,
			restoreMentionItems: () => undefined,
			restoreContent: (content) => {
				updateContent(content)
				if (content) tiptapCoreRef.current?.commands.setContent(content)
			},
			focus: () => {
				focusEditor()
			},
			setModels: ({ languageModel, imageModel, videoModel }) => {
				setModels({
					languageModel,
					imageModel,
					videoModel,
				})
			},
			addUploadFiles: addFiles,
			loadDraftReady: () => store.draftStore.waitForLoadDraft(),
			saveSuperMagicTopicModel: ({
				selectedTopic: currentTopic,
				model,
				imageModel,
				videoModel,
			}) => {
				superMagicTopicModelService.saveModel(
					currentTopic?.id,
					selectedProject?.id ?? "",
					model,
					imageModel,
					videoModel,
					store.topicModelStore,
				)
			},
		}
		// 同步到外部 ref，使父级的 useRecordSummaryAudioFile 能访问到编辑器方法
		if (editorContext.editorRef) {
			;(editorContext.editorRef as MutableRefObject<MessageEditorRef | null>).current =
				tiptapEditorRef.current
		}
	}, [
		addFiles,
		canSendMessage,
		clearContent,
		clearContentAfterSend,
		clearFiles,
		editorContext.editorRef,
		files,
		focusEditor,
		selectedProject?.id,
		setModels,
		store.draftStore,
		store.editorStore.value,
		store.topicModelStore,
		updateContent,
	])

	useEffect(() => {
		isMountedRef.current = true

		return () => {
			isMountedRef.current = false
		}
	}, [])

	useMessageEditorPubSub({
		editor: tiptapEditor,
		isMobile,
		draftStore: store.draftStore,
		updateContent,
		enableMessageSendByContent: editorContext.enableMessageSendByContent ?? false,
		onSendMessageByContent: handleSendMessageByContent,
	})

	useSharedDataFromApp({
		editor: tiptapEditor,
		addFiles,
		uploadEnabled,
	})

	useSlideContentSync({
		tiptapEditor,
		value: store.editorStore.value,
		updateContent,
	})

	useAsyncEffect(async () => {
		store.draftStore.resetSendingGuard()
		pubsub.publish(PubSubEvents.Super_Magic_Clear_Canvas_Markers, {})

		if (!editorContext.draftKey) return
		if (editorContext.skipInitialDraftRestore) return

		await store.draftStore.loadLatestDraft({
			isClearContent: true,
			replaceDirectly: true,
		})
	}, [
		editorContext.draftKey?.topicId,
		editorContext.draftKey?.projectId,
		editorContext.draftKey?.workspaceId,
		editorContext.skipInitialDraftRestore,
		store.draftStore,
	])

	useEffect(() => {
		if (!enableReEditMessageFromPubSub) return

		const handleOpenReEditContent = (payload?: unknown) => {
			const reEditPayload = payload as ReEditPayload | undefined
			if (!reEditPayload?.content) return
			try {
				const parsedContent =
					typeof reEditPayload.content === "string"
						? (JSON.parse(reEditPayload.content) as JSONContent)
						: reEditPayload.content

				updateContent(parsedContent)
				window.setTimeout(() => {
					if (tiptapCoreRef.current && !tiptapCoreRef.current.isDestroyed) {
						tiptapCoreRef.current.commands.setContent(parsedContent)
						focusEditor()
					}
				}, 0)
			} catch (error) {
				console.error("Failed to parse re-edit content:", error)
			}
		}

		pubsub.subscribe(PubSubEvents.Re_Edit_Message, handleOpenReEditContent)
		return () => {
			pubsub.unsubscribe(PubSubEvents.Re_Edit_Message, handleOpenReEditContent)
		}
	}, [enableReEditMessageFromPubSub, focusEditor, updateContent])

	useEffect(() => {
		if (editorContext.selectedModel === undefined) return
		setModels({
			languageModel: editorContext.selectedModel ?? null,
		})
	}, [editorContext.selectedModel, setModels])

	const { handleInterrupt: internalInterrupt } = useTaskInterrupt({
		selectedTopic: selectedTopic ?? null,
		userId: userStore.user.userInfo?.user_id,
		isStopping: store.stopEventLoading,
		setIsStopping: store.setStopEventLoading,
		canInterrupt: editorContext.isTaskRunning ?? editorContext.showLoading ?? false,
	})

	const handleInterrupt = editorContext.handleInterrupt ?? internalInterrupt

	const handleFileUploadClick = useCallback(
		(filesList: FileList) => {
			void addFiles(Array.from(filesList))
		},
		[addFiles],
	)

	const handlePaste = useCallback(
		(event: React.ClipboardEvent) => {
			const clipboardData = event.clipboardData
			if (!clipboardData) return

			const inputFiles = Array.from(clipboardData.files)
			if (uploadEnabled && inputFiles.length > 0) {
				event.preventDefault()
				void addFiles(inputFiles)
			}
		},
		[addFiles, uploadEnabled],
	)

	const handleSelectMentionItem = useMemoizedFn(
		async (item: TiptapMentionAttributes, context?: MentionSelectContext) => {
			if (!item.data) return

			if (item.type === MentionItemType.MCP && !context?.mcpValidated) {
				store.editorStore.setOAuthInProgress(true)
				try {
					const result = await checkMCPOAuth(item.data as McpMentionData)
					if (result === MCPOAuthType.validationFailed) return
					void mentionPanelStore.dispatch({
						kind: "effect",
						effect: "refresh-mcp",
					})
				} finally {
					store.editorStore.setOAuthInProgress(false)
				}
			}

			tiptapCoreRef.current?.commands.insertContent({
				type: "mention",
				attrs: item,
			})
		},
	)

	const handleProjectFileMentionClick = useMemoizedFn((target: EventTarget | null) => {
		const targetElement =
			target instanceof HTMLElement
				? target
				: target instanceof Text
					? target.parentElement
					: null

		const mentionElement = targetElement?.closest(
			"[data-mention-suggestion-char]",
		) as HTMLElement | null

		if (!mentionElement || mentionElement.dataset.type !== MentionItemType.PROJECT_FILE) {
			return false
		}

		try {
			const data = JSON.parse(mentionElement.dataset.data || "{}")
			if (openMessageFile(data)) return true

			editorContext.onFileClick?.(data)
			return true
		} catch (error) {
			console.error(error)
			return false
		}
	})

	useEffect(() => {
		const handleNativeClick = (event: MouseEvent) => {
			handleProjectFileMentionClick(event.target)
		}

		let currentEditorDom: HTMLElement | null = null
		const frameId = window.requestAnimationFrame(() => {
			currentEditorDom = domRef.current?.querySelector(".ProseMirror") ?? null
			currentEditorDom?.addEventListener("click", handleNativeClick, true)
		})

		return () => {
			window.cancelAnimationFrame(frameId)
			currentEditorDom?.removeEventListener("click", handleNativeClick, true)
		}
	}, [domRef, handleProjectFileMentionClick, tiptapEditor])

	const handleCompositionStart = useMemoizedFn(() => {
		store.editorStore.handleCompositionStart()
	})

	const handleCompositionEnd = useMemoizedFn(() => {
		store.editorStore.handleCompositionEnd()
		setTimeout(() => {
			store.draftStore.saveDraft({
				value: store.editorStore.value,
			})
		})
	})

	const handleBlurComposer = useMemoizedFn(() => {
		setIsComposerFocused(false)
		if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
	})

	useEffect(() => {
		void mcpAccess.load().catch(console.error)
	}, [mcpAccess])

	return {
		parentStore,
		store,
		domRef,
		tiptapEditor,
		tiptapEditorRef,
		voiceInputRef,
		uploadModal: uploadEnabled ? UploadModal : null,
		placeholder,
		isComposerFocused,
		showLoading: editorContext.showLoading ?? false,
		isPreparingSend,
		isTaskRunning: editorContext.isTaskRunning ?? editorContext.showLoading ?? false,
		stopEventLoading: editorContext.stopEventLoading ?? store.stopEventLoading,
		selectedTopic,
		selectedProject,
		effectiveTopicMode,
		mentionPanelStore,
		uploadEnabled,
		voiceInputEnabled,
		mcpStorageKey,
		mcpUseTempStorage,
		selectedPluginCount,
		handleSend,
		handleInterrupt,
		handleFileUploadClick,
		handleRemoveUploadedFile,
		handleSelectMentionItem,
		focusComposerEditor: focusEditor,
		handlePaste,
		handleCompositionStart,
		handleCompositionEnd,
		handleBlurComposer,
	}
}
