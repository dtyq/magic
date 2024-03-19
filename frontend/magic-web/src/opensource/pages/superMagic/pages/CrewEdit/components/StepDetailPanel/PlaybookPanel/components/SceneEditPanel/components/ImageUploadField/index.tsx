import { useState, useEffect } from "react"
import { Image, Upload, Loader2 } from "lucide-react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { cn } from "@/opensource/lib/utils"
import { useUpload } from "@/opensource/hooks/useUploadFiles"
import UploadAction from "@/opensource/components/base/UploadAction"
import magicToast from "@/opensource/components/base/MagicToaster/utils"

export interface ImageMetadata {
	width: number
	height: number
	aspectRatio: number
}

interface ImageUploadFieldProps {
	/** Current persisted image URL (controlled) */
	value: string
	onChange: (url: string) => void
	/** Callback with detected image metadata after upload */
	onMetadataChange?: (metadata?: ImageMetadata) => void
	/** Upload button label */
	buttonLabel: string
	/** Placeholder text shown when no image */
	emptyText: string
	/** Optional second line in the placeholder */
	emptySubText?: string
	/** Toast message on upload success */
	successToast: string
	/** Toast message on upload failure */
	failToast: string
	/** Tailwind classes for the preview container (controls size/shape) */
	previewClassName?: string
	/** data-testid applied to the upload button */
	uploadBtnTestId?: string
	/** Error message — highlights the preview border in destructive color */
	error?: string
	/** Callback when upload state changes (e.g. to disable submit during upload) */
	onUploadingChange?: (uploading: boolean) => void
}

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/gif"

function loadImageMetadata(file: File): Promise<ImageMetadata | undefined> {
	const objectUrl = URL.createObjectURL(file)

	return new Promise((resolve) => {
		const image = new window.Image()

		image.onload = () => {
			URL.revokeObjectURL(objectUrl)

			if (!image.naturalWidth || !image.naturalHeight) {
				resolve(undefined)
				return
			}

			resolve({
				width: image.naturalWidth,
				height: image.naturalHeight,
				aspectRatio: image.naturalWidth / image.naturalHeight,
			})
		}

		image.onerror = () => {
			URL.revokeObjectURL(objectUrl)
			resolve(undefined)
		}

		image.src = objectUrl
	})
}

export function ImageUploadField({
	value,
	onChange,
	onMetadataChange,
	buttonLabel,
	emptyText,
	emptySubText,
	successToast,
	failToast,
	previewClassName = "size-32",
	uploadBtnTestId,
	error,
	onUploadingChange,
}: ImageUploadFieldProps) {
	const [localPreview, setLocalPreview] = useState(value)
	const [uploading, setUploading] = useState(false)

	const { uploadAndGetFileUrl } = useUpload({ storageType: "public" })

	// Sync preview when value is reset externally (e.g. dialog reopen)
	useEffect(() => {
		setLocalPreview(value)
	}, [value])

	async function handleFileChange(files: FileList) {
		const file = files[0]
		if (!file) return

		const metadataPromise = loadImageMetadata(file)
		setLocalPreview(URL.createObjectURL(file))
		setUploading(true)
		onUploadingChange?.(true)

		try {
			const metadata = await metadataPromise
			const fileData = { name: file.name, file, status: "init" as const }
			const { fullfilled } = await uploadAndGetFileUrl([fileData])
			if (fullfilled.length > 0) {
				onChange(fullfilled[0].value.url)
				onMetadataChange?.(metadata)
				magicToast.success(successToast)
			} else {
				setLocalPreview(value)
				magicToast.error(failToast)
			}
		} catch {
			setLocalPreview(value)
			magicToast.error(failToast)
		} finally {
			setUploading(false)
			onUploadingChange?.(false)
		}
	}

	return (
		<div className="flex flex-col items-center gap-2">
			<div
				className={cn(
					"flex items-center justify-center overflow-hidden border",
					error ? "border-destructive" : "border-border",
					previewClassName,
				)}
			>
				{localPreview ? (
					<img src={localPreview} alt="preview" className="size-full object-cover" />
				) : (
					<div className="flex flex-col items-center gap-1 text-center">
						<Image className="h-6 w-6 text-muted-foreground" />
						<p className="text-[10px] leading-3 text-muted-foreground">{emptyText}</p>
						{emptySubText && (
							<p className="text-[10px] leading-3 text-muted-foreground">
								{emptySubText}
							</p>
						)}
					</div>
				)}
			</div>
			<UploadAction
				accept={ACCEPT}
				onFileChange={handleFileChange}
				handler={(onUpload) => (
					<Button
						variant="outline"
						className="shadow-xs h-9"
						disabled={uploading}
						onClick={onUpload}
						data-testid={uploadBtnTestId}
					>
						{uploading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Upload className="h-4 w-4" />
						)}
						{buttonLabel}
					</Button>
				)}
			/>
		</div>
	)
}
