import { AttachmentItem } from "../../../TopicFilesButton/hooks"

export interface SelectDirectoryModalProps {
	visible: boolean
	title?: string
	defaultPath?: AttachmentItem[]
	onCreateDirectory?: (params: { id: string; projectId: string; parentId: string }) => void
	onClose?: () => void
	isShowCreateDirectory?: boolean
	onSubmit?: (params: { path: AttachmentItem[] }) => void
	fileType?: string[]
	placeholder?: string
	emptyDataTip?: string
	tips?: string
	projectId: string
	attachments?: AttachmentItem[]
	okText?: string
	cancelText?: string
	// 禁用的文件夹ID列表，这些文件夹将不能被选择为移动目标
	disabledFolderIds?: string[]
}
