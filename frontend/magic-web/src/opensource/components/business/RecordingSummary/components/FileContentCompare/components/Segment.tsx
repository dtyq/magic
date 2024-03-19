import MagicSegmented from "@/opensource/components/base/MagicSegmented"
import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { SelectedContentType } from "../types"
import { useStyles } from "../styles"

interface SegmentProps {
	selectedType: SelectedContentType | null
	onChange: (value: SelectedContentType) => void
}

function Segment({ selectedType, onChange }: SegmentProps) {
	const { t } = useTranslation("super")
	const { styles } = useStyles()

	// Content selector options
	const contentOptions = useMemo(
		() => [
			{
				label: t("recordingSummary.fileChangeModal.selectMerge"),
				value: "merge" as const,
			},
			{
				label: t("recordingSummary.fileChangeModal.selectServer"),
				value: "server" as const,
			},
			{
				label: t("recordingSummary.fileChangeModal.selectCurrent"),
				value: "current" as const,
			},
		],
		[t],
	)

	return (
		<div className={styles.selectorContainer}>
			<MagicSegmented
				options={contentOptions}
				value={selectedType || undefined}
				onChange={(value) => onChange(value as SelectedContentType)}
				size="middle"
				className={styles.contentSelector}
			/>
		</div>
	)
}

export default memo(Segment)
