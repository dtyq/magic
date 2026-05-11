import { Check, AlertCircle, Trash2, FileText, Folder, BookMarked } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Progress } from "@/components/shadcn-ui/progress"
import { cn } from "@/lib/utils"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import { UPLOAD_STATUS } from "../../constants"
import type { FileUploadCardProps } from "./types"

/**
 * 获取文件扩展名
 */
function getFileExtension(filename: string): string {
	const parts = filename.split(".")
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ""
}

/**
 * 文件上传卡片组件
 * 通用的文件/项目/文档上传状态展示卡片
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=2926-2527
 */
export function FileUploadCard({
	file,
	type = "file",
	onDelete,
	onRetry,
	showProgress = true,
	className,
}: FileUploadCardProps) {
	const { t } = useTranslation("crew/create")

	// 根据类型选择图标
	const renderIcon = () => {
		if (type === "project") {
			return (
				<div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
					<Folder className="size-6 text-muted-foreground" />
				</div>
			)
		}

		if (type === "document") {
			return (
				<div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
					<BookMarked className="size-6 text-muted-foreground" />
				</div>
			)
		}

		// 文件类型，显示对应的文件图标
		const ext = getFileExtension(file.name)
		return (
			<div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted">
				{ext ? (
					<MagicFileIcon type={ext} size={24} />
				) : (
					<FileText className="size-6 text-muted-foreground" />
				)}
			</div>
		)
	}

	return (
		<div
			className={cn(
				"flex flex-col gap-2 rounded-lg border border-border bg-card p-2 shadow-xs transition-colors",
				className,
			)}
		>
			{/* 顶部：图标、信息和操作按钮 */}
			<div className="flex items-center gap-2">
				{/* 图标 */}
				{renderIcon()}

				{/* 文件信息 */}
				<div className="min-w-0 flex-1">
					<div className="truncate text-sm font-medium leading-normal">{file.name}</div>
					{file.size && (
						<div className="text-xs leading-normal text-muted-foreground">
							{file.size}
						</div>
					)}
					{/* 显示错误信息 */}
					{file.status === UPLOAD_STATUS.ERROR && file.error && (
						<div className="text-xs leading-normal text-destructive">{file.error}</div>
					)}
				</div>

				{/* 右侧操作区域 */}
				<div className="flex shrink-0 items-center gap-2">
					{/* 上传成功 */}
					{file.status === UPLOAD_STATUS.DONE && (
						<Check className="size-5 text-green-600" />
					)}

					{/* 上传失败 - 显示错误图标和重试按钮 */}
					{file.status === UPLOAD_STATUS.ERROR && (
						<>
							<AlertCircle className="size-5 text-destructive" />
							{onRetry && (
								<Button
									variant="ghost"
									size="sm"
									className="h-7 px-2 text-xs"
									onClick={onRetry}
								>
									{t("documentCreate.upload.retry")}
								</Button>
							)}
						</>
					)}

					{/* 删除按钮 */}
					{onDelete && file.status !== UPLOAD_STATUS.UPLOADING && (
						<Button variant="ghost" size="icon" className="size-9" onClick={onDelete}>
							<Trash2 className="size-4" />
						</Button>
					)}
				</div>
			</div>

			{/* 底部：进度条（仅在上传中显示） */}
			{showProgress && file.status === UPLOAD_STATUS.UPLOADING && (
				<Progress value={file.progress || 0} className="h-1" />
			)}
		</div>
	)
}
