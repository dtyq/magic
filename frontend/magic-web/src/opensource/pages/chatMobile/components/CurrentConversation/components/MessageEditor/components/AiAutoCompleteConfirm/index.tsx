import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"

// Types
import type { AiAutoCompleteConfirmProps } from "./types"

// Styles
import { useStyles } from "./styles"

// Components
import MagicWandIcon from "./components/MagicWandIcon"
import { useAppearanceStore } from "@/opensource/providers/AppearanceProvider/context"
import { forwardRef } from "react"

/**
 * AiAutoCompleteConfirm - AI intelligent completion confirmation component
 *
 * @param props - Component props
 * @returns JSX.Element
 */
const AiAutoCompleteConfirm = forwardRef<HTMLDivElement, AiAutoCompleteConfirmProps>(
	(props, ref) => {
		const { originalText, suggestedText, className, style, onAccept, suggestionTextClassName } =
			props
		const { styles, cx } = useStyles()
		const { t } = useTranslation("interface")

		const openAiCompletion = useAppearanceStore((state) => state.aiCompletion)

		// Don't render if not visible
		if (!openAiCompletion || !suggestedText || suggestedText.trim() === "") return null

		return (
			<div ref={ref} className={cx(styles.container, className)} style={style}>
				{/* Header section with title and accept button */}
				<div className={styles.header}>
					<div className={styles.titleSection}>
						<div className={styles.titleContainer}>
							<div className={styles.iconWrapper}>
								<MagicWandIcon className={styles.magicIcon} />
							</div>
							<p className={styles.titleText}>{t("aiAutoComplete.title")}</p>
						</div>
					</div>

					<button className={styles.acceptButton} onClick={onAccept} type="button">
						{t("aiAutoComplete.accept")}
					</button>
				</div>

				{/* Suggestion text section */}
				<div className={cx(styles.suggestionText, suggestionTextClassName)}>
					<span className={styles.originalText} data-suggested-text={suggestedText}>
						{originalText}
					</span>
				</div>
			</div>
		)
	},
)

const MemoizedAiAutoCompleteConfirm = observer(AiAutoCompleteConfirm)
MemoizedAiAutoCompleteConfirm.displayName = "AiAutoCompleteConfirm"

export default MemoizedAiAutoCompleteConfirm
