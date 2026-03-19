import { memo } from "react"
import { createStyles } from "antd-style"
import { IconChevronsDown } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import MagicIcon from "@/components/base/MagicIcon"

interface ScrollToBottomProps {
	onClick?: () => void
	className?: string
}

const useStyles = createStyles(({ css, token }) => ({
	container: css`
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 8px 12px;
		background: ${token.colorBgContainer};
		border: none;
		border-radius: 12px;
		cursor: pointer;
		font-size: 12px;
		line-height: 16px;
		color: ${token.magicColorUsages.text[1]};
		box-shadow:
			0px 2px 8px rgba(0, 0, 0, 0.06),
			0px 0px 1px rgba(0, 0, 0, 0.12);
		transition: all 0.2s ease-out;
		white-space: nowrap;
		user-select: none;
		position: absolute;
		bottom: 10px;
		right: 10px;

		&:hover {
			border-color: ${token.colorBorder};
			transform: translateY(-1px);
			box-shadow:
				0px 4px 12px rgba(0, 0, 0, 0.08),
				0px 0px 1px rgba(0, 0, 0, 0.12);
		}

		&:active {
			transform: translateY(0) scale(0.98);
			box-shadow:
				0px 1px 4px rgba(0, 0, 0, 0.06),
				0px 0px 1px rgba(0, 0, 0, 0.12);
		}
	`,
}))

function ScrollToBottom({ onClick, className }: ScrollToBottomProps) {
	const { styles } = useStyles()
	const { t } = useTranslation("super")

	return (
		<button
			className={`${styles.container} ${className || ""}`}
			onClick={onClick}
			type="button"
		>
			<MagicIcon component={IconChevronsDown} size={14} color="rgba(28, 29, 35, 0.8)" />
			<span>{t("recordingSummary.ui.scrollToBottom")}</span>
		</button>
	)
}

export default memo(ScrollToBottom)
