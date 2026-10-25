import { Topic } from "@/pages/superMagic/pages/Workspace/types"
import type { JSONContent } from "@/infrastructure/editors/tiptap/core"
import {
	createContext,
	type MouseEvent,
	type PropsWithChildren,
	type ReactNode,
	useContext,
} from "react"
import defaultProjectFilesStore, { type ProjectFilesStore } from "@/stores/projectFiles"
import type { FileBundleDownloadCapability } from "@/pages/superMagic/hooks/useFileBundleDownload"
import type { ActiveDetailTabType } from "@/pages/superMagic/components/Detail/components/FilesViewer/types"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"

/** Final attachments of one assistant message, resolved to workspace files. */
export interface MessageAttachmentsRenderProps {
	files: AttachmentItem[]
	className?: string
}

import type { ModelErrorRecoveryCapability } from "@/pages/superMagic/hooks/useModelErrorRecovery"

export interface MessageListContextState {
	/** 打开当前话题的文件管理器，并显示一次性整理引导。 */
	onOpenProjectFiles?: () => void
	/** 列表拥有下载任务；虚拟卡片只展示状态和触发动作。 */
	fileBundleDownload?: FileBundleDownloadCapability
	/** 消息正文转交列表级调试入口，不由虚拟消息行持有弹窗状态。 */
	onMessageDebugClick?: (node: unknown, event: MouseEvent<HTMLDivElement>) => void
	/** 当前会话注入；分享、历史预览等未注入场景只能阅读帮助。 */
	modelErrorRecovery?: ModelErrorRecoveryCapability
	/** 仅登录的非分享会话解析当前用户的个人文件引用。 */
	allowUserFileReferences?: boolean
	/** 是否允许撤回 */
	allowRevoke?: boolean
	/** 是否允许用户消息复制 */
	allowUserMessageCopy?: boolean
	/** 是否允许创建定时任务 */
	allowScheduleTaskCreate?: boolean
	/** 是否允许悬浮消息节点显示时间 */
	allowMessageTooltip?: boolean
	/** 是否允许话题会话记录复制至新话题 */
	allowConversationCopy?: boolean
	/** 是否允许创建新话题 */
	allowCreateNewTopic?: boolean
	/** 是否允许"导出对话"入口 */
	allowExport?: boolean
	/** 当前是否处于导出选择模式 */
	exportModeActive?: boolean
	/** 触发进入导出选择模式（由 MessageList 内部注入） */
	onExportRequest?: () => void
	/** 切换当前话题 */
	onTopicSwitch?: (topic: Topic) => void
	/** 失败乐观消息重试 */
	onRetryOptimisticMessage?: (message: { app_message_id?: string }) => void
	/** Optional assistant avatar renderer for scoped scenes */
	renderAssistantAvatar?: (props?: { className?: string }) => ReactNode
	/**
	 * Scoped scenes may present a message's final attachments themselves, e.g. research studies
	 * group their deliverables. Return null or undefined to keep the default attachment list.
	 */
	renderAttachments?: (props: MessageAttachmentsRenderProps) => ReactNode
	/** When false, hide the assistant "task completed" status badge */
	showTaskCompletedBadge?: boolean
	/** 当前上下文的 projectFilesStore。每个 MessageListProvider 都必须传入对应场景实例。 */
	projectFilesStore: ProjectFilesStore
	/** 当前详情面板中激活的文件；缓存但隐藏的文件 Tab 不据此显示定位入口。 */
	activeFileId?: string | null
	/** 当前可见详情 Tab 类型。 */
	activeDetailTabType?: ActiveDetailTabType
	/** 详情面板是否实际可见。 */
	detailPanelVisible?: boolean
}

const MessageListContext = createContext<MessageListContextState>({
	allowRevoke: false,
	allowUserMessageCopy: false,
	allowScheduleTaskCreate: false,
	allowMessageTooltip: false,
	allowConversationCopy: false,
	allowCreateNewTopic: true,
	allowExport: false,
	exportModeActive: false,
	onExportRequest: undefined,
	onTopicSwitch: undefined,
	renderAssistantAvatar: undefined,
	projectFilesStore: defaultProjectFilesStore,
})

export function useMessageListContext(): MessageListContextState {
	return useContext(MessageListContext)
}

/** MessageList 子树内的文件 store。子组件不要再 import `@/stores/projectFiles` 默认单例。 */
export function useMessageListProjectFilesStore(): ProjectFilesStore {
	return useMessageListContext().projectFilesStore
}

export function MessageListProvider(props: PropsWithChildren<{ value: MessageListContextState }>) {
	const { value, children } = props
	return <MessageListContext.Provider value={value}>{children}</MessageListContext.Provider>
}
