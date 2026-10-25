import { ImageUploadField } from "@magic-admin-v2/components/image-upload/image-upload-field"
import { isSafeAppMenuImageUrl } from "@magic-admin-v2/features/platform-app-menu/utils"

interface AppMenuImageUploadFieldProps {
	disabled: boolean
	error?: string
	id?: string
	onUploaded: (value: string) => void
	onUploadingChange?: (uploading: boolean) => void
	value: string
}

export function AppMenuImageUploadField({
	disabled,
	error: fieldError,
	id,
	onUploaded,
	onUploadingChange,
	value,
}: AppMenuImageUploadFieldProps) {
	return (
		<ImageUploadField
			disabled={disabled}
			error={fieldError}
			isPreviewable={isSafeAppMenuImageUrl}
			id={id}
			onUploaded={(image) => onUploaded(image.url)}
			onUploadingChange={onUploadingChange}
			value={value}
			variant="inline"
		/>
	)
}
