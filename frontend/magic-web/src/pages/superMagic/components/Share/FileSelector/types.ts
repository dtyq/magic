// File selector props
export interface FileSelectorProps {
	attachments: any[] // AttachmentItem[]
	selectedFileIds: string[]
	onSelectionChange: (fileIds: string[], files: any[]) => void
	topicId?: string
	projectId?: string
	defaultSelectedFileIds?: string[] // 默认选中的文件ID列表，会自动展开其父级文件夹
	defaultOpenFileId?: string // 当前设置的默认打开文件ID
	onDefaultOpenFileChange?: (fileId: string | null) => void // 默认打开文件变化回调
	disabled?: boolean // 禁用所有 checkbox（例如开启分享项目时）
	allowSetDefaultOpen?: boolean // 即使 disabled 为 true，也允许设置默认打开文件（例如开启项目分享时）
	className?: string
}
