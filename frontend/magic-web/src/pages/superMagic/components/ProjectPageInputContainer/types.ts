import type { MentionPanelStore } from "@/components/business/MentionPanel/builtin-store"
import type { HandleSendParams } from "../../services/messageSendFlowService"
import type { SceneEditorContext } from "../MainInputContainer/components/editors/types"
import type { ProjectListItem, Topic, Workspace } from "../../pages/Workspace/types"
import type { MessageEditorLayoutConfig, MessageEditorSize } from "../MessageEditor/types"
import type { TopicModeLogic } from "../MessagePanel/types"
import type { AttachmentItem } from "../TopicFilesButton/hooks"
import type { TopicStore } from "../../stores/core/topic"

export interface ProjectPageInputContainerProps {
	messages?: any[]
	taskData?: any
	className?: string
	classNames?: {
		container?: string
		editorWrapper?: string
		editor?: string
		editorInnerWrapper?: string
		editorContent?: string
		emptyState?: string
	}
	containerRef?: React.RefObject<HTMLDivElement>
	onEditorBlur?: () => void
	onEditorFocus?: () => void
	onMessageSendReady?: (
		sendMessage?: (params: HandleSendParams) => Promise<boolean>,
		prevSendMessage?: (params: HandleSendParams) => Promise<boolean>,
	) => void
	showLoading?: boolean
	selectedTopic: Topic | null
	setSelectedTopic: (topic: Topic | null) => void
	isEmptyStatus?: boolean
	size?: MessageEditorSize
	selectedProject: ProjectListItem | null
	setSelectedProject?: (project: ProjectListItem | null) => void
	onFileClick?: (fileItem: any) => void
	selectedWorkspace?: Workspace | null
	attachments?: AttachmentItem[]
	isShowLoadingInit?: boolean
	mentionPanelStore?: MentionPanelStore
	/** Keeps send-time topic mutations inside the caller's isolated topic scope. */
	topicStore?: TopicStore
	/** Prevents detail-only conversations from switching back into recording mode. */
	allowRecordingMode?: SceneEditorContext["allowRecordingMode"]
	/**
	 * 话题模式逻辑，用于控制话题模式的选择和切换
	 */
	topicModeLogic?: TopicModeLogic
	/** 模型选择器使用的模式目录，不改变实际发送时的话题模式。 */
	modelTopicMode?: SceneEditorContext["modelTopicMode"]
	/** 覆盖编辑器发送和场景配置使用的员工；用于锁定对话详情的默认员工。 */
	agentCode?: string | null
	/** 输入框提示文案覆盖，用于让移动端对话详情与对话首页保持一致。 */
	placeholder?: SceneEditorContext["placeholder"]
	/**
	 * 是否启用通过内容发送消息
	 */
	enableMessageSendByContent?: boolean
	/**
	 * Editor layout configuration for toolbar buttons
	 * Allows customizing the position and order of buttons in the message editor
	 *
	 * @example
	 * editorLayoutConfig={{
	 *   topBarLeft: [ToolbarButton.AT, ToolbarButton.DRAFT_BOX],
	 *   bottomRight: [ToolbarButton.UPLOAD, ToolbarButton.SEND_BUTTON]
	 * }}
	 */
	editorLayoutConfig?: MessageEditorLayoutConfig
	/**
	 * 是否显示话题模式示例卡片
	 */
	showTopicModeExamplePortal?: boolean
	/** 仅允许特定页面消费“撤回消息重新编辑”事件，避免移动端保活页面重复弹层 */
	enableReEditMessageFromPubSub?: boolean
	/** 是否显示模式/员工选择入口；桌面端与移动端共用。 */
	showModeToggle?: boolean
	/** 移动端固定模式场景仍允许切换语言/图像/视频模型。 */
	showModelSelector?: boolean
	onSendComplete?: (params: {
		success: boolean
		currentProject: ProjectListItem | null
		currentTopic: Topic | null
	}) => void
	/** 发送成功后把当前项目/话题透传给外层容器，用于项目入口页跳转到新建话题。 */
	onSendSuccess?: (params: {
		currentProject: ProjectListItem | null
		currentTopic: Topic | null
	}) => void
	/** Optional override for send-time topic creation (e.g. project entry with detail backfill). */
	createTopic?: SceneEditorContext["createTopic"]
	/** Mentions bound to every sent message, e.g. the AI canvas folder. */
	getImplicitMentionItems?: SceneEditorContext["getImplicitMentionItems"]
	editorRef?: SceneEditorContext["editorRef"]
}
