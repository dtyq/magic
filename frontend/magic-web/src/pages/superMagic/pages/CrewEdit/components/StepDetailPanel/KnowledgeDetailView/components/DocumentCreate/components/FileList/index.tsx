import { FileUploadCard } from "../FileUploadCard"
import type { FileUploadCardProps } from "../FileUploadCard/types"

/**
 * FileList组件Props
 */
export interface FileListProps {
	/** 标题 */
	title?: string
	/** 文件列表 */
	files: Array<{
		uid: string
		file: FileUploadCardProps["file"]
		onDelete?: () => void
		onRetry?: () => void
	}>
	/** 是否显示进度条 */
	showProgress?: boolean
	/** 卡片类型 */
	type?: FileUploadCardProps["type"]
}

/**
 * 文件列表组件
 * 通用的文件/项目/文档列表展示组件
 * 包含固定标题和可滚动的文件卡片列表
 */
export function FileList({ title, files, showProgress = true, type = "file" }: FileListProps) {
	if (files.length === 0) return null

	return (
		<>
			{/* 固定标题 */}
			{title && (
				<div className="shrink-0 px-8 pt-6">
					<div className="text-sm font-medium">{title}</div>
				</div>
			)}

			{/* 可滚动列表 */}
			<div className="flex-1 overflow-y-auto px-8 pt-2">
				<div className="flex flex-col gap-2">
					{files.map(({ uid, file, onDelete, onRetry }) => (
						<FileUploadCard
							key={uid}
							file={file}
							type={type}
							onDelete={onDelete}
							onRetry={onRetry}
							showProgress={showProgress}
						/>
					))}
				</div>
			</div>
		</>
	)
}
