export interface TaskProps {
	task: {
		status: "done" | "doing" | "pending" | string
		title: string
		id: string
	}
}

export interface NodeProps {
	node: {
		id?: string | number
		type?: string
		sender?: string
		content?: string
		brief?: string
		description?: string
		text?: string
		detail?: any
		tasks?: Array<TaskProps["task"]>
		attachments?: any
		agentStatus?: string
		timestamp?: number | string
		topic_id?: string | number
	}
	onSelectDetail?: (detail: any) => void
	isSelected?: boolean
}

export interface MessageListProps {
	data: Array<NodeProps["node"]>
	setSelectedDetail: (detail: any) => void
	selectedNodeId?: string | null
}

export interface AttachmentProps {
	attachment: {
		key: string
		name: string
		size: number
		url?: string
		filename?: string
		contentLength?: number
		src?: string
	}
}

/** 超级麦吉 - 消息卡片类型 */
export const enum SuperMagicMessageType {
	/** 富文本 */
	RichText = "rich_text",
	/** 用户提问消息类型（旧版本，新版本更改为 rich_text） */
	Chat = "chat",
	/** 话题初始化 */
	Init = "init",
	/** 任务更新 */
	TaskUpdate = "task_update",
	/** 大模型思考 */
	Thinking = "thinking",
	/** 工具调用 */
	ToolCall = "tool_call",
	/** 消息归档（暂时废弃） */
	ProjectArchive = "project_archive",
	/** 助理回复 */
	AgentReply = "agent_reply",
	/** 助理思考 */
	AgentThink = "agent_thinking",
	/** 提示 */
	Reminder = "reminder",
}

/** 超级麦吉 - 消息卡片类型 */
export interface SuperMagicMessageItem {
	type: SuperMagicMessageType
	childMessages?: Array<SuperMagicMessageItem>
	/** Message author; e.g. user vs assistant turns in MessageList */
	role?: string
	[key: string]: any
}
