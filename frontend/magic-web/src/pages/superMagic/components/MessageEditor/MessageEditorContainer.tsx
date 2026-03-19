import type { Editor, JSONContent } from "@tiptap/react"
import { forwardRef, useEffect, useCallback, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useMemoizedFn, useAsyncEffect } from "ahooks"
import { observer } from "mobx-react-lite"
import { useMessageEditor, useDragUpload, useSlideContentSync } from "./hooks"
import { useIsMobile } from "@/hooks/useIsMobile"
import { useMessageEditorProvider } from "./MessageEditorProvider"
import useMessageEditorToolbarContext from "./hooks/useMessageEditorToolbarContext"
import MessageEditorContainerView from "./components/MessageEditorContainerView"
import useResolvedEditorStore from "./hooks/useResolvedEditorStore"
import useSyncEditorStoreState from "./hooks/useSyncEditorStoreState"
import useEditorSlotContent from "./hooks/useEditorSlotContent"
import useUploadMentionFlow from "./hooks/useUploadMentionFlow"
import useMessageSendHandler from "./hooks/useMessageSendHandler"
import useMessageEditorImperativeRef from "./hooks/useMessageEditorImperativeRef"
import {
	EDITOR_ICON_SIZE_MAP,
	TOP_BAR_ICON_SIZE_MAP,
	DEFAULT_LAYOUT_CONFIG,
} from "./constants/constant"
import { isEmptyJSONContent } from "./utils"
import {
	type MessageEditorProps,
	type MessageEditorRef as MessageEditorRefType,
	ModelItem,
	ToolbarButton,
} from "./types"
import {
	McpMentionData,
	MentionItemType,
} from "@/components/business/MentionPanel/types"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import AiCompletionService from "@/services/chat/editor/AiCompletionService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import {
	checkMCPOAuth,
	MCPOAuthType,
} from "@/components/Agent/MCP/AgentSettings/AgentPanel/MCPPanel/helpers"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/store"
import { insertMentionFromDroppedData } from "./utils/drag"
import useChooseUploadDirModal from "./hooks/useChooseUploadDirModal"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import type { Topic } from "../../pages/Workspace/types"
import useSharedDataFromApp from "./hooks/useSharedDataFromApp"
import type { VoiceInputRef } from "@/components/business/VoiceInput"
import useMessageEditorPubSub from "./hooks/useMessageEditorPubSub"
import { useMessageEditorMarker } from "./hooks/useMessageEditorMarker"
import { hasToolbarButton, resolveMessageEditorModules } from "./utils/moduleConfig"

export type MessageEditorRef = MessageEditorRefType & {
	/**
	 * Add upload files.
	 * @param files - File list
	 */
	addUploadFiles: (files: File[]) => Promise<void>
	loadDraftReady: () => Promise<void>
	saveSuperMagicTopicModel: (params: {
		selectedTopic: Topic
		model: ModelItem
		imageModel: ModelItem | null
	}) => void
}

export const MessageEditorContainer = observer(
	forwardRef<MessageEditorRef, MessageEditorProps>(
		(
			{
				className,
				containerClassName,
				onSend,
				placeholder,
				onFileUpload,
				isTaskRunning = false,
				onInterrupt,
				selectedTopic,
				selectedProject,
				draftKey,
				size = "default",
				modules,
				isSending = false,
				topicMode,
				onFocus,
				onBlur,
				onMentionInsertItems,
				onFileClick,
				showLoading = false,
				attachments,
				isEditingQueueItem = false,
				editorModeSwitch,
				mentionPanelStore = GlobalMentionPanelStore,
				layoutConfig,
				enableMessageSendByContent = false,
			},
			ref,
		) => {
			const { t } = useTranslation("super")
			const voiceInputRef = useRef<VoiceInputRef>(null)
			const isMobile = useIsMobile()

			const iconSize = EDITOR_ICON_SIZE_MAP[size]
			const topBarIconSize = TOP_BAR_ICON_SIZE_MAP[size]

			const { config: providerConfig } = useMessageEditorProvider()

			const effectiveLayoutConfig = useMemo(
				() => ({
					topBarLeft: layoutConfig?.topBarLeft ?? DEFAULT_LAYOUT_CONFIG.topBarLeft,
					topBarRight: layoutConfig?.topBarRight ?? DEFAULT_LAYOUT_CONFIG.topBarRight,
					bottomLeft: layoutConfig?.bottomLeft ?? DEFAULT_LAYOUT_CONFIG.bottomLeft,
					bottomRight: layoutConfig?.bottomRight ?? DEFAULT_LAYOUT_CONFIG.bottomRight,
					outsideTop: layoutConfig?.outsideTop ?? DEFAULT_LAYOUT_CONFIG.outsideTop,
					outsideBottom:
						layoutConfig?.outsideBottom ?? DEFAULT_LAYOUT_CONFIG.outsideBottom,
				}),
				[layoutConfig],
			)

			const hasMentionButton = useMemo(
				() => hasToolbarButton(effectiveLayoutConfig, ToolbarButton.AT),
				[effectiveLayoutConfig],
			)

			const resolvedModules = useMemo(
				() =>
					resolveMessageEditorModules({
						modules,
						layoutConfig: effectiveLayoutConfig,
						providerConfig,
					}),
				[modules, effectiveLayoutConfig, providerConfig],
			)

			const shouldEnableMention = resolvedModules.mention.enabled && hasMentionButton

			const aiCompletionEnabled = !isMobile && resolvedModules.aiCompletion.enabled

			const uploadEnabled = resolvedModules.upload.enabled
			const mcpButtonConfig = resolvedModules.mcp
			const voiceInputEnabled = resolvedModules.voiceInput.enabled
			const shouldConfirmUploadDelete = resolvedModules.upload.confirmDelete

			const { store, parentStore } = useResolvedEditorStore({ mentionPanelStore })

			const isMountedRef = useRef(true)
			const isProjectContext = Boolean(selectedProject?.id)

			useSyncEditorStoreState({
				store,
				draftKey,
				mentionPanelStore,
				isSending,
				isTaskRunning,
			})

			const fileUploadStore = store.fileUploadStore
			const tiptapEditorRef = useRef<Editor | null>(null)
			const shouldSkipMentionRemoveSyncRef = useRef(false)

			const getEditor = useMemoizedFn(() => tiptapEditorRef.current)
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
				addFiles: _addFiles,
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
				getEditor,
				isProjectContext,
				confirmDelete: shouldConfirmUploadDelete,
				onFileUpload,
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

			const handleMentionRemoveItems = useMemoizedFn(
				(items: { item: TiptapMentionAttributes; stillExists: boolean }[]) => {
					items.forEach(({ item, stillExists }) => {
						if (stillExists) return
						if (item.type === MentionItemType.DESIGN_MARKER) {
							handleMarkerMentionRemove(item)
						} else {
							handleUploadMentionRemoveItems([{ item, stillExists }])
						}
					})
				},
			)

			const canSendMessage = useMemo(() => {
				if (hasLoadingMarker) return false
				if (isEditingQueueItem) {
					return isAllFilesUploaded && !isSending
				}
				const hasContent = !isEmptyJSONContent(store.editorStore.value)
				return hasContent && isAllFilesUploaded && !isSending
			}, [
				hasLoadingMarker,
				isEditingQueueItem,
				store.editorStore.value,
				isAllFilesUploaded,
				isSending,
			])

			const sendButtonDisabled = !canSendMessage

			const { addFilesWithDir, UploadModal } = useChooseUploadDirModal({
				addFiles: _addFiles,
				selectedProject,
				attachments,
				validateFileSize,
				validateFileCount,
			})
			const uploadModal = uploadEnabled ? UploadModal : null

			const addFiles = useMemoizedFn(async (files: File[]) => {
				if (!uploadEnabled) return
				await addFilesWithDir(files)
			})

			const setValue = useMemoizedFn((content: JSONContent | undefined) => {
				store.setValue({ value: content })
			})

			const handleKeyboardInput = useMemoizedFn(() => {
				if (voiceInputRef.current?.isRecording) {
					voiceInputRef.current.stopRecording()
				}
			})

			const { isDragOver, dragEvents } = useDragUpload({
				enableFileDrop: uploadEnabled,
				onFilesDropped: uploadEnabled
					? (files) => {
						addFiles(Array.from(files))
					}
					: undefined,
				onDataDropped: (data) => {
					insertMentionFromDroppedData({ editor: tiptapEditorRef.current, data })
				},
			})

			const handleBlur = useMemoizedFn(() => {
				store.draftStore.saveDraftOnBlur({
					value: store.editorStore.value,
					onError: (error) => {
						if (isMountedRef.current) {
							console.error("Failed to save draft on blur:", error)
						}
					},
				})
				onBlur?.()
			})

			const handleSend = useMessageSendHandler({
				voiceInputRef,
				canSendMessage,
				hasLoadingMarker,
				isAllFilesUploaded,
				store,
				t,
				onSend,
				topicMode,
				collectMentionItemsFromEditor,
				isMountedRef,
			})

			const { tiptapEditor, domRef } = useMessageEditor({
				value: store.editorStore.value,
				onSend: handleSend,
				placeholder,
				onMentionInsertItems: (items) => {
					syncInsertedMarkersToManager(items)
					onMentionInsertItems?.(items)
				},
				onChange: setValue,
				onMentionRemove: handleMentionRemove,
				onMentionRemoveItems: handleMentionRemoveItems,
				selectedTopic,
				onKeyboardInput: handleKeyboardInput,
				shouldEnableMention,
				aiCompletionEnabled,
				isOAuthInProgress: store.editorStore.isOAuthInProgress,
				onFocus,
				onBlur: handleBlur,
				size,
				mentionPanelStore,
				shouldSkipRemoveSync: () => shouldSkipMentionRemoveSyncRef.current,
				shouldRestoreRemovedMention,
			})

			useEffect(() => {
				tiptapEditorRef.current = tiptapEditor
				store.editorStore.setEditor(tiptapEditor)
				return () => {
					tiptapEditorRef.current = null
				}
			}, [tiptapEditor, store.editorStore])

			useEffect(() => {
				return () => {
					isMountedRef.current = false
				}
			}, [])

			const updateContent = useMemoizedFn((content: JSONContent | undefined) => {
				store.editorStore.updateContent(content)
			})

			const handleSendMessageByContent = useMemoizedFn(
				(data: { jsonContent: JSONContent }) => {
					onSend?.({
						value: data.jsonContent,
						mentionItems: collectMentionItemsFromContent(data.jsonContent),
						selectedModel: store.topicModelStore.selectedLanguageModel,
						selectedImageModel: store.topicModelStore.selectedImageModel,
						topicMode,
					})
				},
			)

			useMessageEditorPubSub({
				editor: tiptapEditor,
				isMobile,
				draftStore: store.draftStore,
				updateContent,
				enableMessageSendByContent,
				onSendMessageByContent: handleSendMessageByContent,
			})

			useSharedDataFromApp({
				editor: tiptapEditor,
				addFiles,
				uploadEnabled,
			})

			const clearAllMarkers = useMemoizedFn(() => {
				pubsub.publish(PubSubEvents.Super_Magic_Clear_Canvas_Markers, {})
			})

			const clearContent = useMemoizedFn(() => {
				clearAllMarkers()

				setValue(undefined)
				if (tiptapEditor) {
					tiptapEditor.commands.clearContent()
				}
				clearFiles()
			})

			const clearContentAfterSend = useMemoizedFn(() => {
				shouldSkipMentionRemoveSyncRef.current = true
				try {
					clearAllMarkers()

					setValue(undefined)
					if (tiptapEditor) {
						tiptapEditor.commands.clearContent()
					}
					clearFilesLocalOnly()
				} finally {
					shouldSkipMentionRemoveSyncRef.current = false
				}
			})

			useEffect(() => {
				store.draftStore.setClearContentHandler(clearContent)
			}, [clearContent, store])

			const updateEditorValue = useMemoizedFn((content: JSONContent | undefined) => {
				setValue(content)
			})

			useSlideContentSync({ tiptapEditor, value: store.editorStore.value, updateContent })

			useAsyncEffect(async () => {
				store.draftStore.resetSendingGuard()
				clearAllMarkers()

				if (!draftKey) {
					return
				}

				await store.draftStore.loadLatestDraft({
					isClearContent: true,
					replaceDirectly: true,
				})
			}, [draftKey?.topicId, draftKey?.projectId, draftKey?.workspaceId])

			const focus = useMemoizedFn(
				({ enableWhenIsMobile = false }: { enableWhenIsMobile?: boolean } = {}) => {
					if (!enableWhenIsMobile && isMobile) {
						return
					}
					tiptapEditor?.commands.focus()
					if (isMobile) {
						tiptapEditor?.commands.scrollIntoView()
					}
				},
			)

			const loadDraftReady = useMemoizedFn(() => {
				return store.draftStore.waitForLoadDraft()
			})

			const saveSuperMagicTopicModel = useMemoizedFn(
				({
					selectedTopic: topic,
					model,
					imageModel,
				}: {
					selectedTopic: Topic
					model: ModelItem
					imageModel: ModelItem | null
				}) => {
					superMagicTopicModelService.saveModel(
						topic?.id,
						selectedProject?.id || "",
						model,
						imageModel,
						store.topicModelStore,
					)
				},
			)

			const setModels = useMemoizedFn(
				({
					languageModel,
					imageModel,
				}: {
					languageModel?: ModelItem | null
					imageModel?: ModelItem | null
				}) => {
					superMagicTopicModelService.saveModel(
						selectedTopic?.id || "",
						selectedProject?.id || "",
						languageModel,
						imageModel,
						store.topicModelStore,
					)
				},
			)

			useMessageEditorImperativeRef({
				ref,
				tiptapEditor,
				canSendMessage,
				files,
				clearFiles,
				store,
				clearContent,
				clearContentAfterSend,
				updateContent,
				focus,
				addFiles,
				loadDraftReady,
				saveSuperMagicTopicModel,
				setModels,
			})

			const handleInterrupt = useMemoizedFn(() => {
				if (store.stopEventLoading) {
					return
				}
				store.setStopEventLoading(true)
				onInterrupt?.(() => {
					store.setStopEventLoading(false)
				})
			})

			const handleFileUploadClick = useCallback(
				(files: FileList) => {
					const fileArray = Array.from(files)
					addFiles(fileArray)
				},
				[addFiles],
			)

			const handlePaste = useCallback(
				(e: React.ClipboardEvent) => {
					const clipboardData = e.clipboardData
					if (!clipboardData) return

					const files = Array.from(clipboardData.files)

					if (uploadEnabled && files.length > 0) {
						e.preventDefault()
						addFiles(files)
					}
				},
				[addFiles, uploadEnabled],
			)

			const handleSelectMentionItem = useMemoizedFn(async (item: TiptapMentionAttributes) => {
				if (!item.data) return
				if (
					item.type === MentionItemType.MCP &&
					((item.data as McpMentionData).check_auth ||
						(item.data as McpMentionData).check_require_fields)
				) {
					store.editorStore.setOAuthInProgress(true)
					try {
						const res = await checkMCPOAuth(item.data as McpMentionData)
						if (res === MCPOAuthType.validationFailed) {
							return
						}
						mentionPanelStore.fetchMcpList()
					} finally {
						store.editorStore.setOAuthInProgress(false)
					}
				}

				tiptapEditor?.commands.insertContent({
					type: "mention",
					attrs: item,
				})
			})

			const handleClick = useMemoizedFn((e: React.MouseEvent) => {
				const targetElement = e.target as HTMLElement
				const target = targetElement.closest(
					"[data-mention-suggestion-char]",
				) as HTMLElement | null
				if (target) {
					if (target.dataset && target.dataset.type === MentionItemType.PROJECT_FILE) {
						try {
							const data = JSON.parse(target.dataset.data || "{}")
							const type = target.dataset.type
							switch (type) {
								case MentionItemType.PROJECT_FILE:
									onFileClick?.(data)
									break
								default:
									break
							}
						} catch (error) {
							console.error(error)
						}
					}
				}
			})

			const handleCompositionStart = useMemoizedFn(() => {
				store.editorStore.handleCompositionStart()
				AiCompletionService.onCompositionStart()
			})

			const handleCompositionEnd = useMemoizedFn(() => {
				store.editorStore.handleCompositionEnd()

				setTimeout(() => {
					store.draftStore.saveDraft({
						value: store.editorStore.value,
					})
				})

				AiCompletionService.onCompositionEnd()
			})

			const buttonContext = useMessageEditorToolbarContext({
				voiceInputRef,
				tiptapEditor,
				iconSize,
				topBarIconSize,
				size,
				value: store.editorStore.value,
				draftStore: store.draftStore,
				fileUploadStore: store.fileUploadStore,
				shouldEnableMention,
				uploadEnabled,
				sendButtonDisabled,
				showLoading,
				isTaskRunning,
				isUploadingFiles: !isAllFilesUploaded,
				voiceInputEnabled,
				stopEventLoading: store.stopEventLoading,
				isEditingQueueItem: isEditingQueueItem ?? false,
				selectedTopic,
				selectedProject,
				topicMode,
				mentionPanelStore,
				mcpButtonConfig,
				handleSelectMentionItem,
				handleFileUploadClick,
				handleRemoveUploadedFile,
				handleSend,
				handleInterrupt,
				editorModeSwitch,
				t,
				updateEditorValue,
			})

			const {
				topBarLeftContent,
				topBarRightContent,
				bottomLeftContent,
				bottomRightContent,
				outsideBottomContent,
				outsideTopContent,
			} = useEditorSlotContent({
				layoutConfig: effectiveLayoutConfig,
				buttonContext,
				size,
			})

			return (
				<MessageEditorContainerView
					parentStore={parentStore}
					store={store}
					className={className}
					containerClassName={containerClassName}
					size={size}
					tiptapEditor={tiptapEditor}
					domRef={domRef}
					isDragOver={isDragOver}
					dragEvents={dragEvents}
					onPaste={handlePaste}
					onCompositionStart={handleCompositionStart}
					onCompositionEnd={handleCompositionEnd}
					onClick={handleClick}
					topBarLeftContent={topBarLeftContent}
					topBarRightContent={topBarRightContent}
					bottomLeftContent={bottomLeftContent}
					bottomRightContent={bottomRightContent}
					outsideBottomContent={outsideBottomContent}
					outsideTopContent={outsideTopContent}
					uploadModal={uploadModal}
					showAiCompletion={aiCompletionEnabled}
				/>
			)
		},
	),
)
