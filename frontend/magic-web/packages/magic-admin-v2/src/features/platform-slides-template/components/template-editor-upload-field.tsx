import { CheckCircle2, FileArchive } from "lucide-react"
import {
	forwardRef,
	useRef,
	useState,
	type ButtonHTMLAttributes,
	type ClipboardEvent,
	type DragEvent,
	type ReactNode,
} from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@magic-admin-v2/utils/cn"

type TemplateEditorUploadFieldProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
	accept: string
	fileName?: string
	icon: ReactNode
	kind: "image" | "zip"
	onFiles: (files: File[]) => void
	pasteable?: boolean
	previewUrl?: string
}

/** 模板编辑器的单文件上传字段，保留图片粘贴、拖拽和替换提示等业务交互。 */
export const TemplateEditorUploadField = forwardRef<
	HTMLButtonElement,
	TemplateEditorUploadFieldProps
>(function TemplateEditorUploadField(
	{
		accept,
		className,
		fileName,
		icon,
		kind,
		onFiles,
		pasteable,
		previewUrl,
		...buttonProps
	},
	ref,
) {
	const { t } = useTranslation()
	const [dragging, setDragging] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const invalid = Boolean(buttonProps["aria-invalid"])
	const uploaded = Boolean(fileName || previewUrl)
	const fileNameSegments = fileName?.split("/").filter(Boolean)
	const displayFileName = fileNameSegments?.[fileNameSegments.length - 1]
	const dispatch = (files: FileList | null) => files && onFiles(Array.from(files))
	const onDrop = (event: DragEvent<HTMLButtonElement>) => {
		event.preventDefault()
		setDragging(false)
		dispatch(event.dataTransfer.files)
	}
	const onPaste = (event: ClipboardEvent<HTMLButtonElement>) => {
		if (!pasteable || !event.clipboardData.files.length) return
		event.preventDefault()
		dispatch(event.clipboardData.files)
	}

	return (
		<>
			<button data-testid="platform-slides-template-upload-button"
				ref={ref}
				{...buttonProps}
				className={cn(
					"flex min-h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed p-3 text-muted-foreground outline-none transition-[border-color,background-color,box-shadow] duration-200 hover:border-primary/50 hover:bg-muted/40 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
					uploaded
						? "border-emerald-300/80 bg-emerald-50/60 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
						: "bg-muted/20",
					dragging && "border-primary bg-primary/5 ring-2 ring-primary/15",
					invalid && "border-destructive bg-destructive/5",
					className,
				)}
				onClick={() => inputRef.current?.click()}
				onDragEnter={(event) => {
					if (!Array.from(event.dataTransfer.types).includes("Files")) return
					event.preventDefault()
					setDragging(true)
				}}
				onDragLeave={(event) => {
					if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
					setDragging(false)
				}}
				onDragOver={(event) => {
					if (!Array.from(event.dataTransfer.types).includes("Files")) return
					event.preventDefault()
					event.dataTransfer.dropEffect = "copy"
				}}
				onDrop={onDrop}
				onPaste={onPaste}
				type="button"
			>
				{uploaded ? (
					<span className="flex w-full min-w-0 flex-col items-center gap-3">
						{previewUrl ? (
							<span className="flex h-28 w-full items-center justify-center overflow-hidden rounded-md border bg-background/80 p-1.5">
								<img
									alt={t("slidesTemplate.aria.uploadPreview")}
									className="size-full object-contain"
									draggable={false}
									src={previewUrl}
								/>
							</span>
						) : null}
						<span className="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 text-left">
							<span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-emerald-200 bg-background px-3 py-2 font-medium text-foreground shadow-sm dark:border-emerald-800">
								<CheckCircle2 className="size-4 text-emerald-600" />
								{t("slidesTemplate.form.uploadSuccess")}
							</span>
							<span className="font-medium text-emerald-700 dark:text-emerald-400">
								{t(
									kind === "zip"
										? "slidesTemplate.form.zipUploadedReplaceHint"
										: "slidesTemplate.form.imageUploadedReplaceHint",
								)}
							</span>
						</span>
						{kind === "zip" && displayFileName ? (
							<span
								className="flex max-w-full items-center gap-1.5 text-xs text-muted-foreground"
								title={fileName}
							>
								<FileArchive className="size-3.5 shrink-0" />
								<span className="truncate">{displayFileName}</span>
							</span>
						) : null}
					</span>
				) : (
					<span className="flex max-w-full flex-col items-center gap-2">
						{icon}
						<span className="max-w-full text-center text-xs">
							{t(
								kind === "zip"
									? "slidesTemplate.form.zipUploadHint"
									: "slidesTemplate.form.imageUploadHint",
							)}
						</span>
					</span>
				)}
			</button>
			<input data-testid="platform-slides-template-upload-input"
				accept={accept}
				className="hidden"
				onChange={(event) => {
					dispatch(event.target.files)
					event.target.value = ""
				}}
				ref={inputRef}
				type="file"
			/>
		</>
	)
})
