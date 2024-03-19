export interface ImproveInformationModalProps {
	/** 控制弹窗是否显示 */
	open?: boolean
	/** 弹窗关闭时的回调函数 */
	onClose?: () => void
	/** 提交成功时的回调函数 */
	onSubmit?: (data: ImproveInformationData) => void | Promise<void>
}

export interface ImproveInformationData {
	userName: string
	avatarUrl?: string
	avatarKey?: string
	profession?: string
	channel?: string
}
