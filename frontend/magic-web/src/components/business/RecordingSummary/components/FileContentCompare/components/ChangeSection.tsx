import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Tag, Tooltip } from "antd"
import { IconCircleCheck, IconMinus, IconPlus, IconSparkles } from "@tabler/icons-react"
import type { ChangeInfo } from "../utils/diff"
import { useStyles } from "../styles"
import FlexBox from "@/components/base/FlexBox"
import MagicIcon from "@/components/base/MagicIcon"
import { ChangeRecommendation } from "../utils/diff"
import { MagicSelect } from "@/components/base"

/**
 * Props interface for ChangeSection component
 */
interface ChangeSectionProps {
	/** Change information */
	change: ChangeInfo
	/** Item number (global index) */
	itemNumber: number
	/** Total items count (conflicts + changes) */
	totalItems: number
	/** User's current selection for this change */
	selection?: ChangeRecommendation | undefined
	/** Whether resolved by recommendation */
	resolved?: boolean
	/** Whether resolved by AI */
	resolvedByAI?: boolean
	/** Callback when user selects an option */
	onSelect: (changeId: string, selection: ChangeRecommendation) => void
	/** Whether to show recommendation */
	showRecommendation?: boolean
	/** Scroll to next unresolved item */
	scrollToNextUnresolved: (trigger: { type: "conflict" | "change"; id: string }) => void
}

/**
 * ChangeSection Component
 * Displays a single change (addition or deletion) with action buttons
 */
function ChangeSection({
	change,
	itemNumber,
	totalItems,
	selection,
	resolved = false,
	resolvedByAI = false,
	showRecommendation = false,
	onSelect,
	scrollToNextUnresolved,
}: ChangeSectionProps) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("super")

	const isAddition = change.type === "addition"

	// Button labels based on change type
	const keepButtonText = isAddition
		? t("recordingSummary.fileChangeModal.keepAddition")
		: t("recordingSummary.fileChangeModal.restoreDeletion")

	const removeButtonText = isAddition
		? t("recordingSummary.fileChangeModal.removeAddition")
		: t("recordingSummary.fileChangeModal.confirmDeletion")

	const result: JSX.Element[] = []

	// Change type header with recommendation
	const changeTypeLabel = isAddition
		? t("recordingSummary.fileChangeModal.additionLabel")
		: t("recordingSummary.fileChangeModal.deletionLabel")

	const markerClassName = isAddition ? styles.changeMarkerAddition : styles.changeMarkerDeletion
	const isAIRecommendation = change.recommendationSource === "ai"

	const handleSelect = (value: ChangeRecommendation) => {
		onSelect(change.id, value)
		scrollToNextUnresolved({ type: "change", id: change.id })
	}

	// Unresolved - show change header and the change lines
	// Start marker
	result.push(
		<div className={styles.conflictHeader}>
			<div key={`change-header-${change.id}`} className={cx(markerClassName, styles.marker)}>
				<MagicIcon
					component={selection ? IconCircleCheck : isAddition ? IconPlus : IconMinus}
					color="currentColor"
					size={14}
				/>
				{changeTypeLabel} {itemNumber}/{totalItems}{" "}
				{!selection && change.recommendation && (
					<span
						className={
							isAIRecommendation
								? styles.recommendationBadgeAI
								: styles.recommendationBadge
						}
					>
						<IconSparkles size={12} />
						{t("recordingSummary.fileChangeModal.recommended")}:{" "}
						{change.recommendation === "keep" ? keepButtonText : removeButtonText} -{" "}
						{change.recommendationReason}
					</span>
				)}
			</div>
			<MagicSelect
				size="small"
				className={styles.conflictSelect}
				options={[
					{
						label: keepButtonText,
						value: "keep",
					},
					{
						label: removeButtonText,
						value: "remove",
					},
				]}
				placeholder={t("recordingSummary.fileChangeModal.placeholder")}
				value={selection}
				onChange={(value) => handleSelect(value as ChangeRecommendation)}
			/>
			{showRecommendation && resolved && (
				<Tooltip
					title={
						change.recommendationReason ? (
							<>
								<strong>
									{resolvedByAI
										? t("recordingSummary.fileChangeModal.aiRecommendation")
										: t("recordingSummary.fileChangeModal.smartRecommendation")}
									:
								</strong>{" "}
								{change.recommendationReason}
							</>
						) : undefined
					}
					className={styles.tooltip}
				>
					<Tag color={resolvedByAI ? "purple" : "blue"} style={{ marginRight: 8 }}>
						<FlexBox align="center" gap={4}>
							<IconSparkles size={12} />
							{resolvedByAI
								? t("recordingSummary.fileChangeModal.aiResolved")
								: t("recordingSummary.fileChangeModal.smartResolved")}
						</FlexBox>
					</Tag>
				</Tooltip>
			)}
		</div>,
	)

	// If user has made a selection, show the resolved state
	if (selection) {
		const showLines = selection === "keep" ? change.lines : []
		const showLineNumbers = selection === "keep" ? change.lineNumbers : []

		// Show resolved content
		showLines.forEach((line, lineIdx) => {
			const lineNumber = showLineNumbers[lineIdx]
			result.push(
				<div
					key={`change-resolved-${change.id}-${lineIdx}`}
					className={styles.codeLineWithNumber}
				>
					<div className={styles.inlineLineNumber} data-line-number={lineNumber}>
						{lineNumber ?? ""}
					</div>
					<div
						className={`${styles.diffLine} ${isAddition ? styles.conflictResolved : styles.changeResolvedDeletion
							} ${styles.inlineCodeContent}`}
					>
						{line}
					</div>
				</div>,
			)
		})

		return <>{result}</>
	}

	change.lines.forEach((line, lineIdx) => {
		const lineNumber = change.lineNumbers[lineIdx]
		result.push(
			<div key={`change-line-${change.id}-${lineIdx}`} className={styles.codeLineWithNumber}>
				<div className={styles.inlineLineNumber} data-line-number={lineNumber}>
					{lineNumber ?? ""}
				</div>
				<div
					className={`${styles.diffLine} ${isAddition ? styles.added : styles.deleted} ${styles.inlineCodeContent
						}`}
				>
					{line}
				</div>
			</div>,
		)
	})

	return <>{result}</>
}

export default memo(ChangeSection)
