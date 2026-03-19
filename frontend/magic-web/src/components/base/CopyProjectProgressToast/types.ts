import type { MagicProgressToastProps } from "../MagicProgressToast"

export interface CopiedProjectResponse {
	/** 复制后的项目ID */
	project_id: string
	/** 复制后的项目名称 */
	project_name: string
	/** 目标工作区ID */
	workspace_id: string
	/** 目标工作区名称 */
	workspace_name: string
	/** 选择的工作区ID（用于导航） */
	selectedWorkspaceId?: string
}

export interface CopyProjectProgressToastProps extends Omit<
	MagicProgressToastProps,
	"visible" | "progress" | "text"
> {
	/** 要轮询的项目ID */
	projectId: string
	/** 是否显示进度条 */
	visible: boolean
	/** 复制的项目信息（从初始复制API返回） */
	projectInfo?: CopiedProjectResponse
	/** 复制完成时的回调 */
	onComplete?: () => void
	/** 错误时的回调 */
	onError?: (error: Error) => void
	/** 轮询间隔时间（毫秒），默认2000ms */
	pollInterval?: number
	/** 最大重试次数，默认60次（2分钟） */
	maxRetries?: number
	onProgress: (progress: number) => void
	setCopyProjectIsRunning: (isRunning: boolean) => void
}
