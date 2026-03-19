import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import type { JSONContent } from "@tiptap/react"
import DefaultMessageEditorContainer from "@/pages/superMagic/components/MainInputContainer/components/editors/DefaultMessageEditorContainer"
import type { SceneEditorContext } from "@/pages/superMagic/components/MainInputContainer/components/editors/types"
import {
	MessageEditorStore,
	MessageEditorStoreProvider,
} from "@/pages/superMagic/components/MessageEditor/stores"
import type { ModelItem } from "@/pages/superMagic/components/MessageEditor/components/ModelSwitch/types"
import type {
	MessageEditorLayoutConfig,
	MessageEditorModules,
	MessageEditorSize,
} from "@/pages/superMagic/components/MessageEditor/types"
import type { MessageEditorRef as BaseMessageEditorRef } from "@/pages/superMagic/components/MessageEditor/MessageEditor"
import { ToolbarButton } from "@/pages/superMagic/components/MessageEditor/types"
import { ModeToggle } from "@/pages/superMagic/components/TopicMode"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { MentionPanelStore } from "@/components/business/MentionPanel/store"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type {
	ProjectListItem,
	Topic,
	TopicMode,
	Workspace,
} from "@/pages/superMagic/pages/Workspace/types"
import { TopicMode as TopicModeEnum } from "@/pages/superMagic/pages/Workspace/types"
import { collectMentionItemsFromContent } from "@/pages/superMagic/components/MessageEditor/services/uploadMentionService"
import { cn } from "@/lib/utils"

export type MessageEditorRef = BaseMessageEditorRef & {
	selectedModel: ModelItem | null
	setSelectedModel: (model: ModelItem | null) => void
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
	size?: MessageEditorSize
	modules?: MessageEditorModules
	layoutConfig?: MessageEditorLayoutConfig
	attachments?: AttachmentItem[]
	mentionPanelStore?: MentionPanelStore
	showModeToggle?: boolean
	allowChangeMode?: boolean
	enableAiCompletion?: boolean
	selectedModel?: ModelItem | null
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
		topicMode = TopicModeEnum.General,
		setTopicMode,
		size = "default",
		modules,
		layoutConfig,
		attachments,
		mentionPanelStore,
		showModeToggle = false,
		allowChangeMode = true,
		enableAiCompletion = false,
		selectedModel: selectedModelProp = null,
		value,
		onChange,
	},
	ref,
) {
	const innerRef = useRef<BaseMessageEditorRef>(null)
	const [editorStore] = useState(() => new MessageEditorStore({ mentionPanelStore }))

	useEffect(() => {
		editorStore.topicModelStore.setSelectedLanguageModel(selectedModelProp)
	}, [editorStore, selectedModelProp])

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
			topicMode,
			setTopicMode,
			size,
			attachments,
			mentionPanelStore,
			selectedModel: selectedModelProp,
			showModeToggle,
			allowChangeMode,
			onContentChange: onChange ? (content) => onChange(content) : undefined,
			modules: {
				...modules,
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
			selectedModelProp,
			selectedProject,
			selectedTopic,
			selectedWorkspace,
			setTopicMode,
			showModeToggle,
			size,
			topicMode,
		],
	)

	useImperativeHandle(ref, () => {
		return {
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
			setSelectedModel(model: ModelItem | null) {
				editorStore.topicModelStore.setSelectedLanguageModel(model)
				innerRef.current?.setModels({
					languageModel: model,
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
						topicMode={topicMode}
						allowChangeMode={allowChangeMode}
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
