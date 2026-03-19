import MagicIcon from "@/components/base/MagicIcon"
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react"
import { createStyles, useTheme } from "antd-style"
import LoadingIcon from "../LoadingIcon"
import { Tooltip } from "antd"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ css, token }) => ({
	pauseButton: css`
		border: none;
		border-radius: 8px;
		padding: 4px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;

		background: transparent;
		color: ${token.magicColorUsages.text[1]};

		&:hover {
			background: ${token.magicColorScales.grey[0]};
		}
		&:active {
			background: ${token.magicColorScales.grey[1]};
		}
	`,
}))

function PauseButton({
	isPaused,
	onPause,
	onResume,
	isPausing,
	isContinuing,
	disabled,
}: {
	isPaused: boolean
	onPause: () => void
	onResume: () => void
	isPausing: boolean
	isContinuing: boolean
	disabled?: boolean
}) {
	const { styles } = useStyles()
	const { magicColorUsages } = useTheme()
	const { t } = useTranslation("super")
	return (
		<Tooltip
			title={
				isPaused
					? t("recordingSummary.pauseButton.resume")
					: t("recordingSummary.pauseButton.pause")
			}
		>
			<button
				className={styles.pauseButton}
				onClick={isPaused ? onResume : onPause}
				disabled={disabled}
			>
				{isPausing || isContinuing ? (
					<LoadingIcon size={20} color={magicColorUsages.text[1]} />
				) : (
					<MagicIcon
						component={isPaused ? IconPlayerPlayFilled : IconPlayerPauseFilled}
						size={20}
						color="currentColor"
					/>
				)}
			</button>
		</Tooltip>
	)
}

export default PauseButton
