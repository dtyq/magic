export type OpenFileIdLike = string | number

/**
 * Open_File_Tab 事件附带的文件上下文对象。
 * 兼容历史多种字段命名，发布方直接传入原始文件对象即可，无需重新整理内部字段。
 */
export interface OpenFileTabRecord {
	file_id?: OpenFileIdLike
	fileId?: OpenFileIdLike
	currentFileId?: OpenFileIdLike
	id?: OpenFileIdLike
	data?: {
		file_id?: OpenFileIdLike
		fileId?: OpenFileIdLike
		[key: string]: unknown
	} | null
	[key: string]: unknown
}

/**
 * 打开文件预览 Tab 时发布，供所有详情区（工作台、分享页、移动端）统一消费。
 * fileId 是唯一必填字段；fileData 为可选的原始文件对象，内部字段格式不限。
 */
export interface SuperMagicOpenFileTabPayload {
	fileId: string
	fileData?: OpenFileTabRecord
}

/**
 * 通过文件相对路径打开文件 Tab。
 * 适用于消息 content 中 @file_path 引用的场景：
 * 此时只有路径和文件名，没有 file_id。
 * 订阅方（如 useTopicDetailPanelController）需在附件树中查找匹配的文件，
 * 找到后再调用 openFileTab。
 */
export interface SuperMagicOpenFileTabByPathPayload {
	/** 工作区相对路径，例如 "新闻报道/分类一/xxx.md" */
	filePath: string
	/** 文件名，用于展示（附件树查找失败时的 fallback 标题） */
	fileName: string
	/** 可选动作，默认 "open"，传 "download" 时触发下载 */
	action?: "open" | "download"
}

/**
 * 打开知识库文件预览 Tab。
 * 适用于引用（citation）场景：点击知识库类型引用时，携带知识库 ID 和文件 key，
 * 在详情区创建一个知识库文件预览 Tab。
 */
export interface SuperMagicOpenKnowledgeBaseTabPayload {
	/** 知识库 ID */
	knowledgeBaseId: string
	/** 文件 key（对象存储标识） */
	fileKey: string
	/** 文档标题（用于 Tab 显示） */
	title: string
	/** 知识库名称（可选，用于辅助展示） */
	knowledgeBaseName?: string
	/** 文件扩展名（可选，用于 Tab 图标渲染） */
	fileExtension?: string
}
