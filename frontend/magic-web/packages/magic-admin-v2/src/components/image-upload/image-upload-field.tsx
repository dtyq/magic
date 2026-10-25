import { ImageIcon, Loader2, Upload } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { UploadedImage } from "@magic-admin-v2/capabilities/types"
import { Button } from "@magic-admin-v2/components/ui/button"
import { cn } from "@magic-admin-v2/utils/cn"
import {
	getPublicImageUploadErrorMessage,
	isSafePublicImageUrl,
	publicImageAccept,
} from "./upload-error"
import { usePublicImageUpload } from "./use-public-image-upload"

/** 单张公共图片上传字段的展示和回调配置。 */
export type ImageUploadFieldProps = {
	/** 文件选择器允许的 MIME 类型或扩展名。 */
	accept?: string
	/** 卡片布局下操作区域的自定义样式。 */
	actionsClassName?: string
	/** 上传按钮的自定义样式。 */
	buttonClassName?: string
	/** 字段根容器的自定义样式。 */
	className?: string
	/** 是否禁用文件选择和上传操作。 */
	disabled?: boolean
	/** 外部传入的字段错误文案。 */
	error?: string
	/** 将上传错误转换为字段错误文案；返回 null 表示不展示该错误。 */
	getErrorMessage?: (error: unknown) => string | null
	/** 隐藏文件输入的 id，可用于 label 关联。 */
	id?: string
	/** 判断当前 URL 是否可以作为图片预览。 */
	isPreviewable?: (value: string) => boolean
	/** 卡片布局下的字段标题。 */
	label?: ReactNode
	/** 上传完成后的业务回调。 */
	onUploaded: (image: UploadedImage, file: File) => void | Promise<void>
	/** 上传状态变化回调。 */
	onUploadingChange?: (uploading: boolean) => void
	/** 预览区域的自定义样式。 */
	previewClassName?: string
	/** 是否在标题后显示必填标记。 */
	required?: boolean
	/** 当前已上传图片地址；上传中的本地预览会暂时覆盖该值。 */
	value: string
	/** card 展示预览区域，inline 仅展示紧凑操作布局。 */
	variant?: "card" | "inline"
	uploadButtonTestId?: string
	inputTestId?: string
}

export function ImageUploadField({
	accept = publicImageAccept,
	actionsClassName,
	buttonClassName,
	className,
	disabled = false,
	error: fieldError,
	getErrorMessage,
	id,
	isPreviewable = isSafePublicImageUrl,
	label,
	onUploaded,
	onUploadingChange,
	previewClassName,
	required = false,
	value,
	variant = "card",
	uploadButtonTestId,
	inputTestId,
}: ImageUploadFieldProps) {
	const { t } = useTranslation()
	const upload = usePublicImageUpload({ value, onUploaded, onUploadingChange })
	const uploadError = upload.uploadError
		? getErrorMessage
			? getErrorMessage(upload.uploadError)
			: getPublicImageUploadErrorMessage(upload.uploadError, t)
		: null
	const error = uploadError || fieldError
	const hasPreview = Boolean(upload.previewUrl && isPreviewable(upload.previewUrl))
	const uploadButton = (
		<Button
			data-testid={uploadButtonTestId}
			className={cn(variant === "inline" && !hasPreview && "w-fit", buttonClassName)}
			disabled={disabled || upload.isUploading}
			onClick={upload.openFilePicker}
			size="sm"
			type="button"
			variant="outline"
		>
			{upload.isUploading ? (
				<Loader2 className="size-4 animate-spin" aria-hidden="true" />
			) : (
				<Upload className="size-4" aria-hidden="true" />
			)}
			{variant === "inline"
				? hasPreview
					? t("common.replace")
					: t("common.upload")
				: value
					? t("common.replace")
					: t("common.upload")}
		</Button>
	)
	const fileInput = (
		<input
			id={id}
			ref={upload.inputRef}
			accept={accept}
			className="hidden"
			data-testid={inputTestId}
			disabled={disabled || upload.isUploading}
			onChange={upload.handleFileChange}
			type="file"
		/>
	)

	if (variant === "inline") {
		return (
			<div className={cn("grid gap-3", className)}>
				{hasPreview ? (
					<div className="flex flex-wrap items-center gap-3">
						<div
							className={cn(
								"flex size-20 items-center justify-center overflow-hidden rounded-md border bg-muted/30 p-2",
								previewClassName,
							)}
						>
							<img
								alt=""
								className="h-full w-full object-contain"
								draggable={false}
								src={upload.previewUrl}
							/>
						</div>
						{uploadButton}
					</div>
				) : (
					uploadButton
				)}
				{fileInput}
				{error ? <p className="text-xs text-destructive">{error}</p> : null}
			</div>
		)
	}

	return (
		<div className={cn("grid gap-2 rounded-md border bg-background p-3", className)}>
			{label ? (
				<span className="text-sm font-medium">
					{label}
					{required ? <span className="ml-1 text-destructive">*</span> : null}
				</span>
			) : null}
			<div className="grid gap-3">
				<div
					className={cn(
						"flex h-20 items-center justify-center overflow-hidden rounded border bg-muted/30 p-2",
						previewClassName,
					)}
				>
					{hasPreview ? (
						<img
							alt=""
							className="h-full w-full object-contain"
							draggable={false}
							src={upload.previewUrl}
						/>
					) : (
						<ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
					)}
				</div>
				<div className={cn("flex flex-wrap items-center gap-2", actionsClassName)}>
					{uploadButton}
				</div>
				{fileInput}
				{error ? <p className="text-xs text-destructive">{error}</p> : null}
			</div>
		</div>
	)
}
