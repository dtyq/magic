import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import type { JSONContent } from "@/infrastructure/editors/tiptap/react"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import {
	MessageEditorStore,
	MessageEditorStoreProvider,
} from "@/pages/superMagic/components/MessageEditor/stores"
import {
	ModelStatusEnum,
	type ModelItem,
} from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type {
	MessageEditorLayoutConfig,
	MessageEditorModules,
	MessageEditorSize,
} from "@/pages/superMagic/components/MessageEditor/types"
import type { MessageEditorRef as BaseMessageEditorRef } from "@/pages/superMagic/components/MessageEditor/MessageEditor"
import { ToolbarButton } from "@/pages/superMagic/components/MessageEditor/types"
import { ModeToggle } from "@/pages/superMagic/components/TopicMode"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import { getFallbackTopicModeIdentifier } from "@/services/superMagic/DefaultAgentSelectionService"
import { collectMentionItemsFromContent } from "@/pages/superMagic/components/MessageEditor/services/uploadMentionService"
import { cn } from "@/utils/cn"

type StoredModelItem = Partial<ModelItem> & Pick<ModelItem, "model_id">

function normalizeStoredModel(model: StoredModelItem | null): ModelItem | null {
	if (!model?.model_id) return null

	return {
		id: model.id || model.model_id,
		group_id: model.group_id || "",
		model_id: model.model_id,
		model_name: model.model_name || model.model_id,
		provider_model_id: model.provider_model_id || model.model_id,
		model_description: model.model_description || "",
		model_icon: model.model_icon || "",
		model_status: model.model_status ?? ModelStatusEnum.Normal,
		sort: model.sort ?? 0,
		...(model.tags && { tags: model.tags }),
	}
}

export type MessageEditorRef = BaseMessageEditorRef & {
	selectedModel: ModelItem | null
	selectedImageModel: ModelItem | null
	selectedVideoModel: ModelItem | null
	setSelectedModel: (model: ModelItem | null) => void
	setSelectedImageModel: (model: StoredModelItem | null) => void
	setSelectedVideoModel: (model: StoredModelItem | null) => void
	mentionItems: MentionListItem[]
}

export interface MessageEditorProps {
	className?: string
	containerClassName?: string
	placeholder?: string
	selectedTopic?: Topic | null
	selectedProject?: ProjectListItem | null
	selectedWorkspace?: Workspace | null
	topicMode?: TopicMode
	setTopicMode?: (mode: TopicMode) => void
	agentCode?: string
	size?: MessageEditorSize
	modules?: MessageEditorModules
	layoutConfig?: MessageEditorLayoutConfig
	attachments?: AttachmentItem[]
	mentionPanelStore?: MentionPanelStore
	projectFilesStore?: ProjectFilesStore
	showModeToggle?: boolean
	allowChangeMode?: boolean
	/** Controls the mobile edge used by the mode selector owned by this editor. */
	modeToggleMobilePosition?: "bottom" | "top"
	enableAiCompletion?: boolean
	selectedModel?: ModelItem | null
	selectedImageModel?: StoredModelItem | null
	selectedVideoModel?: StoredModelItem | null
	value?: JSONContent
	onChange?: (content: JSONContent | undefined) => void
}

const scheduledTaskLayoutConfig: MessageEditorLayoutConfig = {
	topBarLeft: [ToolbarButton.AT],
	topBarRight: [],
	bottomLeft: [ToolbarButton.MODEL_SWITCH],
	bottomRight: [ToolbarButton.MCP, ToolbarButton.UPLOAD],
	outsideTop: [],
	outsideBottom: [],
}

const MessageEditor = forwardRef<MessageEditorRef, MessageEditorProps>(function MessageEditor(
	{
		className,
		containerClassName,
		placeholder,
		selectedTopic = null,
		selectedProject = null,
		selectedWorkspace = null,
		topicMode,
		setTopicMode,
		agentCode,
		size = "default",
		modules,
		layoutConfig,
		attachments,
		mentionPanelStore,
		projectFilesStore,
		showModeToggle = false,
		allowChangeMode = true,
		modeToggleMobilePosition,
		enableAiCompletion = false,
		selectedModel: selectedModelProp = null,
		selectedImageModel: selectedImageModelProp = null,
		selectedVideoModel: selectedVideoModelProp = null,
		value,
		onChange,
	},
	ref,
) {
	const innerRef = useRef<BaseMessageEditorRef>(null)
	const [editorStore] = useState(
		() => new MessageEditorStore({ mentionPanelStore, projectFilesStore }),
	)
	const resolvedTopicMode = topicMode ?? getFallbackTopicModeIdentifier()

	useEffect(() => {
		editorStore.topicModelStore.setSelectedLanguageModel(selectedModelProp)
	}, [editorStore, selectedModelProp])

	useEffect(() => {
		editorStore.topicModelStore.setSelectedImageModel(
			normalizeStoredModel(selectedImageModelProp),
		)
	}, [editorStore, selectedImageModelProp])

	useEffect(() => {
		editorStore.topicModelStore.setSelectedVideoModel(
			normalizeStoredModel(selectedVideoModelProp),
		)
	}, [editorStore, selectedVideoModelProp])

	useEffect(() => {
		const timer = setTimeout(() => {
			if (!innerRef.current) return

			if (!value) {
				innerRef.current.clearContent()
				return
			}

			const currentValue = innerRef.current.getValue()
			if (JSON.stringify(currentValue) === JSON.stringify(value)) return
			innerRef.current.setContent(value)
		}, 0)

		return () => clearTimeout(timer)
	}, [value])

	const editorContext = useMemo<SceneEditorContext>(
		() => ({
			placeholder,
			selectedTopic,
			selectedProject,
			selectedWorkspace,
			topicMode: resolvedTopicMode,
			setTopicMode,
			agentCode,
			size,
			attachments,
			mentionPanelStore,
			projectFilesStore,
			selectedModel: selectedModelProp,
			showModeToggle,
			allowChangeMode,
			onContentChange: onChange ? (content) => onChange(content) : undefined,
			modules: {
				...modules,
				send: {
					...modules?.send,
					enabled: false,
				},
				aiCompletion: {
					...modules?.aiCompletion,
					enabled: enableAiCompletion,
				},
				mcp: {
					useTempStorage: true,
				},
			},
			layoutConfig: layoutConfig ?? scheduledTaskLayoutConfig,
			containerClassName: cn(containerClassName, className),
		}),
		[
			agentCode,
			allowChangeMode,
			attachments,
			className,
			containerClassName,
			enableAiCompletion,
			layoutConfig,
			mentionPanelStore,
			modules,
			onChange,
			placeholder,
			projectFilesStore,
			selectedModelProp,
			selectedProject,
			selectedTopic,
			selectedWorkspace,
			setTopicMode,
			showModeToggle,
			size,
			resolvedTopicMode,
		],
	)

	useImperativeHandle(ref, () => {
		return {
			getDraftKey: () => editorStore.draftStore.getDraftKey(),
			beginDraftSwitch: editorStore.draftStore.beginDraftSwitch,
			endDraftSwitch: editorStore.draftStore.endDraftSwitch,
			prepareQueueDraft: (draft) => editorStore.draftStore.prepareQueueDraft(draft),
			restoreQueueDraft: (draft, activate) =>
				editorStore.draftStore.restoreQueueDraft(draft, activate),
			getQueueDraft: () => editorStore.draftStore.getQueueDraft(),
			subscribeQueueDraft: (listener) => editorStore.draftStore.subscribeQueueDraft(listener),
			keepQueueDraft: () => editorStore.draftStore.keepQueueDraft(),
			completeQueueDraft: (syncId, value) =>
				editorStore.draftStore.completeQueueDraft(syncId, value),
			get editor() {
				return innerRef.current?.editor ?? null
			},
			get canSendMessage() {
				return innerRef.current?.canSendMessage ?? false
			},
			getFiles() {
				return innerRef.current?.getFiles() ?? []
			},
			clearFiles() {
				innerRef.current?.clearFiles()
			},
			getValue() {
				return innerRef.current?.getValue()
			},
			clearContent() {
				innerRef.current?.clearContent()
			},
			clearContentAfterSend() {
				innerRef.current?.clearContentAfterSend()
			},
			setContent(content) {
				innerRef.current?.setContent(content)
			},
			restoreMentionItems(items) {
				innerRef.current?.restoreMentionItems(items)
			},
			restoreContent(content, mentionItems) {
				innerRef.current?.restoreContent(content, mentionItems)
			},
			focus(params) {
				innerRef.current?.focus(params)
			},
			setModels(params) {
				innerRef.current?.setModels(params)
			},
			addUploadFiles(files) {
				return innerRef.current?.addUploadFiles(files) ?? Promise.resolve()
			},
			loadDraftReady() {
				return innerRef.current?.loadDraftReady() ?? Promise.resolve()
			},
			saveSuperMagicTopicModel(params) {
				innerRef.current?.saveSuperMagicTopicModel(params)
			},
			get selectedModel() {
				return editorStore.topicModelStore.selectedLanguageModel
			},
			get selectedImageModel() {
				return editorStore.topicModelStore.selectedImageModel
			},
			get selectedVideoModel() {
				return editorStore.topicModelStore.selectedVideoModel
			},
			setSelectedModel(model: ModelItem | null) {
				editorStore.topicModelStore.setSelectedLanguageModel(model)
				innerRef.current?.setModels({
					languageModel: model,
				})
			},
			setSelectedImageModel(model: StoredModelItem | null) {
				const normalizedModel = normalizeStoredModel(model)
				editorStore.topicModelStore.setSelectedImageModel(normalizedModel)
				innerRef.current?.setModels({
					imageModel: normalizedModel,
				})
			},
			setSelectedVideoModel(model: StoredModelItem | null) {
				const normalizedModel = normalizeStoredModel(model)
				editorStore.topicModelStore.setSelectedVideoModel(normalizedModel)
				innerRef.current?.setModels({
					videoModel: normalizedModel,
				})
			},
			get mentionItems() {
				return collectMentionItemsFromContent(innerRef.current?.getValue())
			},
		}
	}, [editorStore])

	return (
		<MessageEditorStoreProvider store={editorStore}>
			<div className={cn("flex flex-col", showModeToggle && "gap-2")}>
				{showModeToggle ? (
					<ModeToggle
						size={size}
						topicMode={resolvedTopicMode}
						agentCode={agentCode}
						allowChangeMode={allowChangeMode}
						mobilePopupPosition={modeToggleMobilePosition}
						onModeChange={setTopicMode}
					/>
				) : null}
				<div className="rounded-md border border-border shadow-xs">
					<DefaultMessageEditorContainer
						editorContext={editorContext}
						editorRef={innerRef}
					/>
				</div>
			</div>
		</MessageEditorStoreProvider>
	)
})

export default MessageEditor
