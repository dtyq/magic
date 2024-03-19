export interface WaitingTipModalProps {
	/** 是否显示模态框 */
	open?: boolean
	/** 关闭回调 */
	onClose?: () => void
	/** 项目名称，默认为"未命名项目" */
	projectName?: string
	/** 工作空间名称 */
	workspaceName?: string
}

export interface ShowWaitingTipModalOptions {
	/** 项目名称，默认为"未命名项目" */
	projectName?: string
	/** 工作空间名称 */
	workspaceName?: string
	/** 模态框关闭时的回调函数 */
	onClose?: () => void
}
