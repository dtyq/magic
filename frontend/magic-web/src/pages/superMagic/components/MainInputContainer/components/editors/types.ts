import type { JSONContent } from "@tiptap/core"
import type { ReactNode, RefObject } from "react"
import type { LocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import type { DataService } from "@/components/business/MentionPanel/types"
import type { MentionListItem } from "@/components/business/MentionPanel/tiptap-plugin/types"
import type { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import type { TiptapMentionAttributes } from "@/components/business/MentionPanel/tiptap-plugin"
import type { ProjectFilesStore } from "@/stores/projectFiles"
import type { createSuperMagicTopicModelStore } from "@/stores/superMagic/topicModelStore"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks"
import type { MessageEditorRef } from "@/pages/superMagic/components/MessageEditor/MessageEditor"
import type {
	DraftKey,
	ModelItem,
	MessageEditorLayoutConfig,
	MessageEditorModules,
	MessageEditorSize,
} from "@/pages/superMagic/components/MessageEditor/types"
import type { HandleSendParams } from "@/pages/superMagic/services/messageSendFlowService"
import type { ProjectListItem, Topic, Workspace } from "@/pages/superMagic/pages/Workspace/types"
import type { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import type { QueuedMessage } from "@/pages/superMagic/components/MessagePanel/hooks/useMessageQueue"
import { TopicStore } from "@/pages/superMagic/stores/core/topic"

export interface QueueMessageInput {
	content: JSONContent
	mentionItems: MentionListItem[]
	selectedModel?: ModelItem | null
	selectedImageModel?: ModelItem | null
	selectedVideoModel?: ModelItem | null
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
	setSelectedWorkspace?: (workspace: Workspace | null) => void
	topicMode: TopicMode
	/** custom_agent: same as featured mode.identifier */
	agentCode?: string
	setTopicMode?: (mode: TopicMode) => void
	topicExamplesMode?: TopicMode
	size?: MessageEditorSize
	className?: string
	containerClassName?: string
	showLoading?: boolean
	isTaskRunning?: boolean
	stopEventLoading?: boolean
	isChatPageHomepage?: boolean
	isEmptyStatus?: boolean
	messagesLength?: number
	enableMessageSendByContent?: boolean
	modules?: MessageEditorModules
	layoutConfig?: MessageEditorLayoutConfig
	attachments?: AttachmentItem[]
	mentionPanelStore?: MentionPanelStore
	isAllowedMention?: (attrs: TiptapMentionAttributes, dataService: DataService) => boolean
	projectFilesStore?: ProjectFilesStore
	topicModelStore?: ReturnType<typeof createSuperMagicTopicModelStore>
	selectedModel?: ModelItem | null
	onSendSuccess?: (params: {
		currentProject: ProjectListItem | null
		currentTopic: Topic | null
	}) => void
	onSendStart?: (params: {
		content: JSONContent | undefined
		mentionItems: MentionListItem[]
	}) => void
	onSendComplete?: (params: {
		success: boolean
		currentProject: ProjectListItem | null
		currentTopic: Topic | null
	}) => void
	onFileClick?: (fileItem: unknown) => void
	onEditorFocus?: () => void
	onEditorBlur?: () => void
	handleInterrupt?: () => void
	mergeSendParams?: (params: {
		defaultParams: HandleSendParams
	}) => Partial<HandleSendParams> | void
	queueContext?: SceneEditorQueueContext
	showTopicExamplesPortal?: boolean
	editorModeSwitch?: ({ disabled }: { disabled: boolean }) => ReactNode
	modelSwitch?: ReactNode
	topicStore?: TopicStore
	/** 挂载后自动聚焦编辑器（移动端弹窗打开时使用） */
	autoFocus?: boolean
	/** 弹窗打开时从底部输入栏同步过来的语音输入内容（仅移动端使用） */
	initialContent?: JSONContent
	/** 初始 mentions，用于恢复撤回消息的附件/复杂 mention 状态 */
	initialMentionItems?: MentionListItem[]
	/** 编辑器内容变化回调（移动端用于双向同步，仅弹窗编辑器触发） */
	onContentChange?: (content: JSONContent) => void
	/** 透传真实编辑器 ref，供外层在特殊场景下显式恢复内容 */
	editorRef?: RefObject<MessageEditorRef | null>
	/** 跳过首次草稿恢复，避免覆盖外部显式恢复的内容 */
	skipInitialDraftRestore?: boolean
	showModeToggle?: boolean
	allowChangeMode?: boolean
	mobileModeSelectorVariant?: "default" | "claw"
}

export interface SceneEditorNodes {
	taskDataNode?: ReactNode
	messageQueueNode?: ReactNode
}
