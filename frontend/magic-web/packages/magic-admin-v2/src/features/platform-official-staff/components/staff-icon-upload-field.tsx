import { useTranslation } from "react-i18next"
import { AvatarImageUploadField } from "@magic-admin-v2/components/image-upload/avatar-image-upload-field"

type StaffIconUploadFieldProps = {
	disabled: boolean
	id?: string
	name: string
	onUploadingChange?: (uploading: boolean) => void
	onUploaded: (value: string) => void
	value: string
}

export function StaffIconUploadField({
	disabled,
	id,
	name,
	onUploadingChange,
	onUploaded,
	value,
}: StaffIconUploadFieldProps) {
	const { t } = useTranslation()

	return (
		<AvatarImageUploadField
			avatarClassName="size-16 rounded-lg"
			disabled={disabled}
			id={id}
			fallbackText={name}
			hint={t("officialStaff.editor.iconUploadHint")}
			imageClassName="object-contain"
			layout="conditional"
			name={name}
			onUploaded={(image) => onUploaded(image.url)}
			onUploadingChange={onUploadingChange}
			showPreviewWhenEmpty={false}
			value={value}
		/>
	)
}
