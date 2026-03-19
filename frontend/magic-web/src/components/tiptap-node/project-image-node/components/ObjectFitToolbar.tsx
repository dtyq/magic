import { IconPhotoPlus, IconPhotoDown, IconPhotoOff } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"

type ObjectFitValue = "cover" | "contain" | "fill" | null

interface ObjectFitToolbarProps {
	objectFit: ObjectFitValue
	onObjectFitChange: (objectFit: "cover" | "contain" | "fill") => void
	visible?: boolean
}

const OBJECT_FIT_OPTIONS: Array<{
	value: "cover" | "contain" | "fill"
	icon: typeof IconPhotoPlus
	labelKey: string
}> = [
	{
		value: "cover",
		icon: IconPhotoPlus,
		labelKey: "projectImage.objectFit.cover",
	},
	{
		value: "contain",
		icon: IconPhotoDown,
		labelKey: "projectImage.objectFit.contain",
	},
	{
		value: "fill",
		icon: IconPhotoOff,
		labelKey: "projectImage.objectFit.fill",
	},
]

export function ObjectFitToolbar({
	objectFit = "cover",
	onObjectFitChange,
	visible = true,
}: ObjectFitToolbarProps) {
	const { t } = useTranslation("tiptap")

	if (!visible) return null

	return (
		<>
			{OBJECT_FIT_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
				<button
					key={value}
					type="button"
					className={`project-image-node__object-fit-button ${
						objectFit === value ? "project-image-node__object-fit-button--active" : ""
					}`}
					onClick={() => onObjectFitChange(value)}
					aria-label={t(labelKey)}
					title={t(labelKey)}
				>
					<Icon size={16} />
				</button>
			))}
		</>
	)
}
