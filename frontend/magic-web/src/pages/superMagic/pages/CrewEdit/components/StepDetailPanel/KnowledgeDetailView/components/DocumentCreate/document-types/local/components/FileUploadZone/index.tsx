import { Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import { useRef } from "react"
import { FILE_UPLOAD_LIMITS } from "../../../../constants"

/**
 * FileUploadZone组件Props
 */
export interface FileUploadZoneProps {
	/** 文件选择回调 */
	onFilesSelect: (files: File[]) => void
	/** 是否禁用 */
	disabled?: boolean
	className?: string
}

/**
 * 文件上传区域组件
 * 支持拖拽上传和点击选择
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-1847155
 */
export function FileUploadZone({ onFilesSelect, disabled, className }: FileUploadZoneProps) {
	const { t } = useTranslation("crew/create")
	const fileInputRef = useRef<HTMLInputElement>(null)

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault()
		if (disabled) return

		const files = Array.from(e.dataTransfer.files)
		onFilesSelect(files)
	}

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault()
	}

	const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files
		if (files) {
			onFilesSelect(Array.from(files))
		}
		// 清空input value以允许重复选择同一文件
		e.target.value = ""
	}

	const handleClick = () => {
		if (!disabled) {
			fileInputRef.current?.click()
		}
	}

	const supportedFormats = FILE_UPLOAD_LIMITS.SUPPORTED_EXTENSIONS.map((ext) => `.${ext}`).join(
		",",
	)

	const supportedExts = FILE_UPLOAD_LIMITS.SUPPORTED_EXTENSIONS.slice(0, 8)
		.join(", ")
		.toUpperCase()

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-5 py-6 shadow-xs transition-colors hover:border-primary/50",
				disabled && "cursor-not-allowed opacity-50",
				!disabled && "cursor-pointer",
				className,
			)}
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onClick={handleClick}
		>
			{/* 上传图标 - 48x48px */}
			<div className="flex size-12 items-center justify-center rounded-md border border-border p-2">
				<Upload size={24} className="text-foreground" />
			</div>

			{/* 上传提示文本 */}
			<p className="text-center text-sm font-medium leading-normal text-foreground">
				{t("documentCreate.upload.dragDropHint")}
			</p>
			<p className="w-full text-center text-xs leading-normal text-muted-foreground">
				{t("documentCreate.upload.supportedFormatsWithLimits")}
			</p>

			{/* 浏览文件按钮 - h-9 (36px) */}
			<Button variant="outline" className="h-9" disabled={disabled}>
				{t("documentCreate.upload.browseFiles")}
			</Button>

			{/* 隐藏的文件输入 */}
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept={supportedFormats}
				className="hidden"
				onChange={handleFileInput}
				disabled={disabled}
			/>
		</div>
	)
}
