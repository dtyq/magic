import type { UploadStatus } from "../../constants"

/**
 * 文件上传卡片Props
 */
export interface FileUploadCardProps {
	file: {
		name: string
		status: UploadStatus
		progress?: number
		size?: string
		error?: string
	}
	/** 卡片类型：file-文件, project-项目, document-文档 */
	type?: "file" | "project" | "document"
	/** 删除回调 */
	onDelete?: () => void
	/** 重试回调 */
	onRetry?: () => void
	/** 是否显示进度条 */
	showProgress?: boolean
	className?: string
}
