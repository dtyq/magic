import { Loader2, Upload, X } from "lucide-react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { UploadedImage } from "@magic-admin-v2/capabilities/types"
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render"
import { Button, type ButtonProps } from "@magic-admin-v2/components/ui/button"
import { cn } from "@magic-admin-v2/utils/cn"
import { getPublicImageUploadErrorMessage, publicImageAccept } from "./upload-error"
import { usePublicImageUpload } from "./use-public-image-upload"

/** 带头像预览的单张公共图片上传字段配置。 */
export type AvatarImageUploadFieldProps = {
	/** 文件选择器允许的 MIME 类型或扩展名。 */
	accept?: string
	/** 操作按钮区域的自定义样式。 */
	actionsClassName?: string
	/** 头像容器的自定义样式。 */
	avatarClassName?: string
	/** 上传和清空按钮的尺寸。 */
	buttonSize?: ButtonProps["size"]
	/** 字段根容器的自定义样式。 */
	className?: string
	/** 清空按钮文案。 */
	clearLabel?: ReactNode
	/** 是否显示清空按钮。 */
	clearable?: boolean
	/** 控制区域的自定义样式。 */
	controlsClassName?: string
	/** 是否禁用文件选择、上传和清空操作。 */
	disabled?: boolean
	/** 外部传入的字段错误文案。 */
	error?: string
	/** 无头像预览时展示的图标。 */
	fallbackIcon?: ReactNode
	/** 无头像预览时展示的备用文本。 */
	fallbackText?: string
	/** 将上传错误转换为字段错误文案；返回 null 表示不展示该错误。 */
	getErrorMessage?: (error: unknown) => string | null
	/** 隐藏文件输入的 id，可用于 label 关联。 */
	id?: string
	/** 字段辅助说明。 */
	hint?: ReactNode
	/** 头像图片元素的自定义样式。 */
	imageClassName?: string
	/** conditional 仅在有预览时展示头像，inline 始终保留头像区域。 */
	layout?: "conditional" | "inline"
	/** 头像的无障碍文本和备用名称。 */
	name: string
	/** 清空当前图片后的业务回调。 */
	onClear?: () => void
	/** 上传完成后的业务回调。 */
	onUploaded: (image: UploadedImage, file: File) => void | Promise<void>
	/** 上传状态变化回调。 */
	onUploadingChange?: (uploading: boolean) => void
	/** 上传失败后的业务回调。 */
	onUploadError?: (error: unknown) => void
	/** 上传成功后的业务回调。 */
	onUploadSuccess?: (image: UploadedImage, file: File) => void
	/** 替换已有图片时的按钮文案。 */
	replaceLabel?: ReactNode
	/** 是否在字段内部展示错误文案。 */
	showInlineError?: boolean
	/** value 为空时是否仍展示头像占位区域。 */
	showPreviewWhenEmpty?: boolean
	/** 尚未上传图片时的按钮文案。 */
	uploadLabel?: ReactNode
	/** 当前已上传图片地址；上传中的本地预览会暂时覆盖该值。 */
	value: string
	uploadButtonTestId?: string
	clearButtonTestId?: string
	inputTestId?: string
}

export function AvatarImageUploadField({
	accept = publicImageAccept,
	actionsClassName,
	avatarClassName,
	buttonSize = "sm",
	className,
	clearLabel,
	clearable = false,
	controlsClassName,
	disabled = false,
	error: fieldError,
	fallbackIcon,
	fallbackText,
	getErrorMessage,
	id,
	hint,
	imageClassName,
	layout = "inline",
	name,
	onClear,
	onUploaded,
	onUploadingChange,
	onUploadError,
	onUploadSuccess,
	replaceLabel,
	showInlineError = true,
	showPreviewWhenEmpty = true,
	uploadLabel,
	value,
	uploadButtonTestId,
	clearButtonTestId,
	inputTestId,
}: AvatarImageUploadFieldProps) {
	const { t } = useTranslation()
	const upload = usePublicImageUpload({
		value,
		onUploaded,
		onUploadingChange,
		onUploadError,
		onUploadSuccess,
	})
	const uploadError = upload.uploadError
		? getErrorMessage
			? getErrorMessage(upload.uploadError)
			: getPublicImageUploadErrorMessage(upload.uploadError, t)
		: null
	const error = uploadError || fieldError
	const hasPreview = Boolean(upload.previewUrl)
	const shouldShowPreview = showPreviewWhenEmpty || hasPreview
	const shouldUseReplaceLabel = layout === "conditional" ? hasPreview : Boolean(value)
	const actions = (
		<div className={cn("flex flex-wrap items-center gap-2", actionsClassName)}>
			<Button
				data-testid={uploadButtonTestId}
				className={layout === "conditional" && !hasPreview ? "w-fit" : undefined}
				disabled={disabled || upload.isUploading}
				onClick={upload.openFilePicker}
				size={buttonSize}
				type="button"
				variant="outline"
			>
				{upload.isUploading ? (
					<Loader2 className="size-4 animate-spin" aria-hidden="true" />
				) : (
					<Upload className="size-4" aria-hidden="true" />
				)}
				{shouldUseReplaceLabel
					? (replaceLabel ?? t("common.replace"))
					: (uploadLabel ?? t("common.upload"))}
			</Button>
			{clearable && value ? (
				<Button
					data-testid={clearButtonTestId}
					disabled={disabled || upload.isUploading}
					onClick={onClear}
					size={buttonSize}
					type="button"
					variant="ghost"
				>
					<X className="size-4" aria-hidden="true" />
					{clearLabel ?? t("common.clear")}
				</Button>
			) : null}
		</div>
	)
	const avatar = (
		<EntityAvatarRender
			alt={name}
			className={avatarClassName}
			fallbackIcon={fallbackIcon}
			fallbackText={fallbackText}
			imageClassName={imageClassName}
			name={name}
			src={upload.previewUrl || undefined}
		/>
	)
	const fileInput = (
		<input
			id={id}
			data-testid={inputTestId}
			ref={upload.inputRef}
			accept={accept}
			className="hidden"
			disabled={disabled || upload.isUploading}
			onChange={upload.handleFileChange}
			type="file"
		/>
	)

	if (layout === "conditional") {
		return (
			<div className={cn("grid gap-2", className)}>
				{shouldShowPreview ? (
					<div className="flex items-center gap-3">
						{avatar}
						{actions}
					</div>
				) : (
					actions
				)}
				{fileInput}
				{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
				{showInlineError && error ? (
					<p className="text-xs text-destructive">{error}</p>
				) : null}
			</div>
		)
	}

	return (
		<div className={cn("flex flex-wrap items-center gap-4", className)}>
			{avatar}
			<div className={cn("grid gap-2", controlsClassName)}>
				{actions}
				{hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
				{showInlineError && error ? (
					<p className="text-xs text-destructive">{error}</p>
				) : null}
			</div>
			{fileInput}
		</div>
	)
}
