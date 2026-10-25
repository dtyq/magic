import { ImageIcon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { AvatarImageUploadField } from "@magic-admin-v2/components/image-upload/avatar-image-upload-field"

export function ModelIconUploadField({
	disabled,
	id,
	onUploaded,
	onUploadingChange,
	value,
}: {
	disabled: boolean
	id?: string
	onUploaded: (value: string) => void
	onUploadingChange?: (uploading: boolean) => void
	value: string
}) {
	const { t } = useTranslation()

	return (
		<AvatarImageUploadField
			actionsClassName="grid"
			avatarClassName="size-16"
			disabled={disabled}
			id={id}
			fallbackIcon={<ImageIcon className="size-5" aria-hidden="true" />}
			hint={t("modelList.editor.iconUploadHint")}
			imageClassName="object-cover"
			name=""
			onUploaded={(image) => onUploaded(image.url)}
			onUploadingChange={onUploadingChange}
			value={value}
		/>
	)
}
