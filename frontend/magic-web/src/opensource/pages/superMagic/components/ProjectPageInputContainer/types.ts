import { MentionPanelStore } from "@/opensource/components/business/MentionPanel/store"
import { ProjectListItem, Topic, Workspace } from "../../pages/Workspace/types"
import { MessageEditorLayoutConfig } from "../MessageEditor"
import { MessageEditorSize } from "../MessageEditor/types"
import { TopicModeLogic } from "../MessagePanel/types"
import { AttachmentItem } from "../TopicFilesButton/hooks"

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
	/**
	 * 话题模式逻辑，用于控制话题模式的选择和切换
	 *
	 * PS: 录音总结模式，AI 对话功能使用该逻辑
	 */
	topicModeLogic?: TopicModeLogic
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
}
