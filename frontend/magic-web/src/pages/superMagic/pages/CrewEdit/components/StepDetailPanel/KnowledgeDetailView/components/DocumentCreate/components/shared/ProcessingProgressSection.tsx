import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { CheckCircle2, Loader2 } from "lucide-react"
import { FileUploadCard } from "../FileUploadCard"
import { cn } from "@/lib/utils"
import type { UploadStatus } from "../../constants"

/**
 * 处理文件项接口
 */
export interface ProcessingFileItem {
	fileId: string
	fileName: string
	progress: number
	status?: UploadStatus // 文件状态：uploading | done | error
	type?: "file" | "project" | "document"
}

export interface ProcessingProgressSectionProps {
	/** 处理中的文件列表 */
	files: ProcessingFileItem[]
	/** 是否全部完成 */
	isComplete: boolean
	/** 标题 */
	title?: string
	/** 描述 */
	description?: string
	/** 显示实时更新提示 */
	showRealTimeUpdates?: boolean
	/** 自定义className */
	className?: string
}

/**
 * 处理进度区域组件
 * 可被所有文档类型的处理步骤复用
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-1927656
 */
export const ProcessingProgressSection = observer(function ProcessingProgressSection({
	files,
	isComplete,
	title,
	description,
	showRealTimeUpdates = true,
	className,
}: ProcessingProgressSectionProps) {
	const { t } = useTranslation("crew/create")

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{/* 标题和描述 */}
			{(title || description) && (
				<div className="space-y-1">
					{title && <h3 className="text-lg font-semibold">{title}</h3>}
					{description && <p className="text-sm text-muted-foreground">{description}</p>}
				</div>
			)}

			{/* 实时更新提示 */}
			{showRealTimeUpdates && !isComplete && (
				<div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
					<Loader2 className="size-4 animate-spin text-blue-600" />
					<div className="flex-1">
						<div className="text-sm font-medium text-blue-900">
							{t("documentCreate.processing.realTimeUpdates")}
						</div>
						<div className="text-xs text-blue-700">
							{t("documentCreate.processing.updatesDescription")}
						</div>
					</div>
				</div>
			)}

			{/* 处理进度列表 */}
			<div className="flex flex-col gap-2">
				{files.map((file) => (
					<FileUploadCard
						key={file.fileId}
						file={{
							name: file.fileName,
							status: file.status || (file.progress === 100 ? "done" : "uploading"),
							progress: file.progress,
						}}
						type={file.type}
						showProgress
					/>
				))}
			</div>

			{/* 完成提示 */}
			{isComplete && (
				<div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
					<CheckCircle2 className="size-5 shrink-0 text-green-600" />
					<div className="text-sm font-medium text-green-800">
						{t("documentCreate.processing.complete")}
					</div>
				</div>
			)}
		</div>
	)
})
