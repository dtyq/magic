import { AttachmentItem } from "../../../TopicFilesButton/hooks"

export interface UploadModalSubmitParams {
	path: AttachmentItem[]
	files: File[]
	/** 记录改名之前的文件对象，避免导入正文根据展示名或文件内容猜测身份。 */
	originalFiles: File[]
}

export interface UploadModalProps {
	visible: boolean
	title?: string
	defaultPath?: AttachmentItem[]
	onCreateDirectory?: (params: { id: string; projectId: string; parentId: string }) => void
	onClose?: () => void
	isShowCreateDirectory?: boolean
	onSubmit?: (params: UploadModalSubmitParams) => void
	fileType?: string[]
	placeholder?: string
	emptyDataTip?: string
	tips?: string
	projectId: string
	attachments?: AttachmentItem[]
	okText?: string
	cancelText?: string
	uploadFiles?: File[]
	isUploadingFolder?: boolean // 新增：是否为文件夹上传

	validateFileSize?: (files: File[]) => { validFiles: File[]; hasWarning: boolean }
	validateFileCount?: (files: File[]) => { validFiles: File[]; hasError: boolean }
}
