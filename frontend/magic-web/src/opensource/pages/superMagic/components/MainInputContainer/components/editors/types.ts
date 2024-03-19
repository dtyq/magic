import type { JSONContent } from "@tiptap/core"
import type { ReactNode } from "react"
import type { LocaleText } from "@/opensource/pages/superMagic/components/MainInputContainer/panels/types"
import type { MentionListItem } from "@/opensource/components/business/MentionPanel/tiptap-plugin/types"
import type { MentionPanelStore } from "@/opensource/components/business/MentionPanel/store"
import type { AttachmentItem } from "@/opensource/pages/superMagic/components/TopicFilesButton/hooks"
import type {
	DraftKey,
	ModelItem,
	MessageEditorLayoutConfig,
	MessageEditorModules,
	MessageEditorSize,
} from "@/opensource/pages/superMagic/components/MessageEditor/types"
import type { HandleSendParams } from "@/opensource/pages/superMagic/services/messageSendFlowService"
import type {
	ProjectListItem,
	Topic,
	TopicMode,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"
import type { QueuedMessage } from "@/opensource/pages/superMagic/components/MessagePanel/hooks/useMessageQueue"
import { TopicStore } from "@/opensource/pages/superMagic/stores/core/topic"

export interface QueueMessageInput {
	content: JSONContent
	mentionItems: MentionListItem[]
	selectedModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	topicMode?: TopicMode
}

export interface SceneEditorQueueContext {
	editingQueueItem: QueuedMessage | null
	addToQueue: (params: QueueMessageInput) => void
	finishEditQueueItem: (value: JSONContent | undefined, mentionItems: MentionListItem[]) => void
}

export interface SceneEditorContext {
	/** Override input placeholder from skill config (LocaleText) */
	placeholder?: LocaleText
	draftKey?: DraftKey
	selectedTopic: Topic | null
	selectedProject: ProjectListItem | null
	selectedWorkspace?: Workspace | null
	setSelectedTopic?: (topic: Topic | null) => void
	setSelectedProject?: (project: ProjectListItem | null) => void
	topicMode: TopicMode
	setTopicMode?: (mode: TopicMode) => void
	topicExamplesMode?: TopicMode
	size?: MessageEditorSize
	className?: string
	containerClassName?: string
	showLoading?: boolean
	isEmptyStatus?: boolean
	messagesLength?: number
	enableMessageSendByContent?: boolean
	modules?: MessageEditorModules
	layoutConfig?: MessageEditorLayoutConfig
	attachments?: AttachmentItem[]
	mentionPanelStore?: MentionPanelStore
	onSendSuccess?: (params: {
		currentProject: ProjectListItem | null
		currentTopic: Topic | null
	}) => void
	onFileClick?: (fileItem: unknown) => void
	onEditorFocus?: () => void
	onEditorBlur?: () => void
	onInterrupt?: (callback?: () => void) => void
	mergeSendParams?: (params: {
		defaultParams: HandleSendParams
	}) => Partial<HandleSendParams> | void
	queueContext?: SceneEditorQueueContext
	showTopicExamplesPortal?: boolean
	editorModeSwitch?: ({ disabled }: { disabled: boolean }) => ReactNode
	topicStore?: TopicStore
	/** 挂载后自动聚焦编辑器（移动端弹窗打开时使用） */
	autoFocus?: boolean
	/** 弹窗打开时从底部输入栏同步过来的语音输入内容（仅移动端使用） */
	initialContent?: JSONContent
	/** 编辑器内容变化回调（移动端用于双向同步，仅弹窗编辑器触发） */
	onContentChange?: (content: JSONContent) => void
}

export interface SceneEditorNodes {
	taskDataNode?: ReactNode
	messageQueueNode?: ReactNode
}
