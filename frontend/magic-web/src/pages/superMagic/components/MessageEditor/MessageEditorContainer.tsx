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
import useCompressContext from "./hooks/useCompressContext"
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
	type SendMessageByContentPayload,
} from "./types"
import {
	McpMentionData,
	MentionItemType,
	type MentionSelectContext,
} from "@/components/business/MentionPanel/types"
import type {
	MentionRemoveItemPayload,
	TiptapMentionAttributes,
} from "@/components/business/MentionPanel/tiptap-plugin"
import AiCompletionService from "@/services/chat/editor/AiCompletionService"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { resetDocumentScrollPosition } from "@/utils/scroll"
import {
	checkMCPOAuth,
	MCPOAuthType,
} from "@/components/Agent/MCP/AgentSettings/AgentPanel/MCPPanel/helpers"
import GlobalMentionPanelStore from "@/components/business/MentionPanel/builtin-store"
import { insertMentionFromDroppedData } from "./utils/drag"
import useChooseUploadDirModal from "./hooks/useChooseUploadDirModal"
import { superMagicTopicModelService } from "@/services/superMagic/topicModel"
import type { Topic } from "../../pages/Workspace/types"
import useSharedDataFromApp from "./hooks/useSharedDataFromApp"
import type { VoiceInputRef } from "@/components/business/VoiceInput"
import useMessageEditorPubSub from "./hooks/useMessageEditorPubSub"
import { useMessageEditorMarker } from "./hooks/useMessageEditorMarker"
import { resolveMessageEditorModules } from "./utils/moduleConfig"
import { userStore } from "@/models/user"
import { useTaskInterrupt } from "../../hooks/useTaskInterrupt"
import { openMessageFile } from "@/pages/superMagic/components/MessageList/utils/openMessageFile"

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
		videoModel?: ModelItem | null
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
				selectedTopic,
				selectedProject,
				draftKey,
				size = "default",
				modules,
				isSending = false,
				sendButtonLoading = false,
				topicMode,
				onFocus,
				onBlur,
				onMentionInsertItems,
				onFileClick,
				showLoading = false,
				attachments,
				isEditingQueueItem = false,
				editorModeSwitch,
				modelSwitch,
				mentionPanelStore = GlobalMentionPanelStore,
				isAllowedMention,
				projectFilesStore,
				topicModelStore,
				layoutConfig,
				enableMessageSendByContent = false,
				skipInitialDraftRestore = false,
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

			const resolvedModules = useMemo(
				() =>
					resolveMessageEditorModules({
						modules,
						layoutConfig: effectiveLayoutConfig,
						providerConfig,
					}),
				[modules, effectiveLayoutConfig, providerConfig],
			)

			const shouldEnableMention = resolvedModules.mention.enabled

			const aiCompletionEnabled = !isMobile && resolvedModules.aiCompletion.enabled

			const uploadEnabled = resolvedModules.upload.enabled
			const mcpButtonConfig = resolvedModules.mcp
			const voiceInputEnabled = resolvedModules.voiceInput.enabled
			const sendEnabled = resolvedModules.send.enabled
			const shouldConfirmUploadDelete = resolvedModules.upload.confirmDelete

			const { store, parentStore } = useResolvedEditorStore({
				mentionPanelStore,
				projectFilesStore,
				topicModelStore,
			})

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
				mentionPanelStore,
				getEditor,
				isProjectContext,
				// The main editor can enqueue messages while loading, but it is
				// still not a dedicated queue draft editor.
				isQueueDraftMode: false,
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

			const handleMentionRemoveItems = useMemoizedFn((items: MentionRemoveItemPayload[]) => {
				items.forEach(({ item, stillExists, deletionInput }) => {
					if (stillExists) return
					if (item.type === MentionItemType.DESIGN_MARKER) {
						handleMarkerMentionRemove(item)
					} else {
						handleUploadMentionRemoveItems([{ item, stillExists, deletionInput }])
					}
				})
			})

			const canSendMessage = useMemo(() => {
				if (!sendEnabled) return false
				if (hasLoadingMarker) return false
				if (isEditingQueueItem) {
					return isAllFilesUploaded && !isSending && !sendButtonLoading
				}
				const hasContent = !isEmptyJSONContent(store.editorStore.value)
				return hasContent && isAllFilesUploaded && !isSending && !sendButtonLoading
			}, [
				hasLoadingMarker,
				isEditingQueueItem,
				store.editorStore.value,
				isAllFilesUploaded,
				isSending,
				sendButtonLoading,
				sendEnabled,
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
				if (isMobile) resetDocumentScrollPosition()
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
					if (!selectedProject?.id) {
						store.fileUploadStore.addPendingProjectFileReferences(items)
					}
					onMentionInsertItems?.(items)
				},
				onChange: setValue,
				onMentionRemove: handleMentionRemove,
				onMentionRemoveItems: handleMentionRemoveItems,
				selectedTopic,
				onKeyboardInput: handleKeyboardInput,
				shouldEnableMention,
				sendEnabled,
				aiCompletionEnabled,
				isOAuthInProgress: store.editorStore.isOAuthInProgress,
				onFocus,
				onBlur: handleBlur,
				size,
				topicMode,
				mentionPanelStore,
				isAllowedMention,
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
				(data: SendMessageByContentPayload) => {
					onSend?.({
						value: data.jsonContent,
						mentionItems:
							data.mentionItems ?? collectMentionItemsFromContent(data.jsonContent),
						selectedModel:
							data.selectedModel ?? store.topicModelStore.selectedLanguageModel,
						selectedImageModel:
							data.selectedImageModel ?? store.topicModelStore.selectedImageModel,
						selectedVideoModel:
							data.selectedVideoModel ?? store.topicModelStore.selectedVideoModel,
						topicMode: data.topicMode ?? topicMode,
						shouldClearEditorAfterSend: data.shouldClearEditorAfterSend,
						extra: data.extra,
					})
				},
			)

			const { handleCompressContext } = useCompressContext({
				handleSendMessageByContent,
			})

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

				if (skipInitialDraftRestore) {
					return
				}

				await store.draftStore.loadLatestDraft({
					isClearContent: true,
					replaceDirectly: true,
				})
			}, [
				draftKey?.topicId,
				draftKey?.projectId,
				draftKey?.workspaceId,
				skipInitialDraftRestore,
			])

			const focus = useMemoizedFn(
				({ enableWhenIsMobile = false }: { enableWhenIsMobile?: boolean } = {}) => {
					if (!enableWhenIsMobile && isMobile) {
						return
					}
					if (!tiptapEditor || tiptapEditor.isDestroyed) return
					try {
						tiptapEditor.commands.focus()
						if (isMobile) {
							tiptapEditor.commands.scrollIntoView()
						}
					} catch {
						// Silently ignore — view may not be mounted yet during rapid state transitions
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
					videoModel,
				}: {
					selectedTopic: Topic
					model: ModelItem
					imageModel: ModelItem | null
					videoModel?: ModelItem | null
				}) => {
					superMagicTopicModelService.saveModel(
						topic?.id,
						selectedProject?.id || "",
						model,
						imageModel,
						videoModel,
						store.topicModelStore,
					)
				},
			)

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
					superMagicTopicModelService.saveModel(
						selectedTopic?.id || "",
						selectedProject?.id || "",
						languageModel,
						imageModel,
						videoModel,
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

			const { handleInterrupt } = useTaskInterrupt({
				selectedTopic: selectedTopic ?? null,
				userId: userStore.user.userInfo?.user_id,
				isStopping: store.stopEventLoading,
				setIsStopping: store.setStopEventLoading,
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

			const handleSelectMentionItem = useMemoizedFn(
				async (item: TiptapMentionAttributes, context?: MentionSelectContext) => {
					if (!item.data) return
					if (item.type === MentionItemType.MCP && !context?.mcpValidated) {
						store.editorStore.setOAuthInProgress(true)
						try {
							const res = await checkMCPOAuth(item.data as McpMentionData)
							if (res === MCPOAuthType.validationFailed) {
								return
							}
							void mentionPanelStore.dispatch({
								kind: "effect",
								effect: "refresh-mcp",
							})
						} finally {
							store.editorStore.setOAuthInProgress(false)
						}
					}

					tiptapEditor?.commands.insertContent({
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

				if (
					!mentionElement ||
					mentionElement.dataset.type !== MentionItemType.PROJECT_FILE
				) {
					return false
				}

				try {
					const data = JSON.parse(mentionElement.dataset.data || "{}")
					if (openMessageFile(data)) {
						return true
					}

					onFileClick?.(data)
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
				sendEnabled,
				sendButtonDisabled,
				sendButtonLoading,
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
				handleCompressContext,
				editorModeSwitch,
				modelSwitch,
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
