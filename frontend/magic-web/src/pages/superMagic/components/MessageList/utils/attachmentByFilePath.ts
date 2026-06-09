import pubsub, { PubSubEvents } from "@/utils/pubsub"

/**
 * 从消息 content 中提取所有 [@file_path:...] 引用，按出现顺序返回路径数组。
 *
 * 支持格式：[@file_path:新闻报道/分类一/xxx.md]
 */
export function extractFilePathsFromContent(content: string): string[] {
	if (!content) return []
	const regex = /\[@file_path:([^\]]+)\]/g
	const paths: string[] = []
	let match: RegExpExecArray | null
	while ((match = regex.exec(content)) !== null) {
		const path = match[1].trim()
		if (path) paths.push(path)
	}
	return paths
}

/**
 * 从 @file_path 路径中提取文件名（最后一段）。
 *
 * "新闻报道/分类一/xxx.md" → "xxx.md"
 */
export function fileNameFromPath(filePath: string): string {
	return filePath.split("/").pop() || filePath
}

/**
 * 从 @file_path 路径中推断文件扩展名。
 *
 * "xxx.md" → "md"
 */
export function fileExtFromPath(filePath: string): string {
	const name = fileNameFromPath(filePath)
	const dotIndex = name.lastIndexOf(".")
	return dotIndex !== -1 ? name.slice(dotIndex + 1) : ""
}

/**
 * 根据 content 中的 @file_path 引用，生成一组仅含路径信息的"路径附件"对象。
 *
 * 这类对象没有 file_id，点击时通过 Open_File_Tab_By_Path 事件
 * 由订阅方在附件树中查找对应文件后再打开。
 *
 * @returns 路径附件数组。每个元素含：
 *   - filePath  工作区相对路径
 *   - fileName  文件名（显示用）
 *   - fileExt   文件扩展名（图标判断用）
 *   - __byPath  标志位，区分普通附件与路径附件
 */
export function buildFilePathAttachments(content: string): FilePathAttachment[] {
	const paths = extractFilePathsFromContent(content)
	return paths.map((filePath) => ({
		filePath,
		fileName: fileNameFromPath(filePath),
		fileExt: fileExtFromPath(filePath),
		__byPath: true as const,
	}))
}

export interface FilePathAttachment {
	/** 工作区相对路径，例如 "新闻报道/分类一/xxx.md" */
	filePath: string
	/** 展示用文件名 */
	fileName: string
	/** 文件扩展名，用于图标判断 */
	fileExt: string
	/** 标志位，区分路径附件与普通附件 */
	__byPath: true
}

/**
 * 点击路径附件时调用。
 * 发布 Open_File_Tab_By_Path 事件，由上层订阅方在附件树中查找 file_id 后打开。
 */
export function openFileByPath(attachment: FilePathAttachment): void {
	pubsub.publish(PubSubEvents.Switch_Detail_Mode, "files")
	pubsub.publish(PubSubEvents.Open_File_Tab_By_Path, {
		filePath: attachment.filePath,
		fileName: attachment.fileName,
	})
}

/** 通过路径触发订阅方下载（与预览打开共用 Open_File_Tab_By_Path） */
export function downloadFileByPath(attachment: FilePathAttachment): void {
	pubsub.publish(PubSubEvents.Open_File_Tab_By_Path, {
		filePath: attachment.filePath,
		fileName: attachment.fileName,
		action: "download",
	})
}
