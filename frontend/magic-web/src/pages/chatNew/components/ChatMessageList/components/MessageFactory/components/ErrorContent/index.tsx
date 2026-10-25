import MagicButton from "@/components/base/MagicButton"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import type { ComponentProps } from "react"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ css, token }) => ({
	container: css`
		padding: 7px;
		width: 100%;
		min-width: 340px;
	`,
	invalidText: css`
		color: ${token.magicColorUsages.text[2]};
		text-align: justify;
		font-size: 14px;
		line-height: 20px;
		white-space: pre-wrap;
	`,
}))

interface ErrorContentProps extends ComponentProps<"div"> {
	onReport?: () => void
	onRetry?: () => void
}

function ErrorContent({ onReport, onRetry, className, ...props }: ErrorContentProps) {
	const { t } = useTranslation("chat")
	const { styles, cx } = useStyles()

	return (
		<Flex
			vertical
			className={cx(styles.invalidText, className)}
			justify="center"
			align="center"
			gap={10}
			{...props}
		>
			<div className={styles.invalidText}>{t("errorContent.unknown")}</div>
			{onReport && (
				<MagicButton type="link" onClick={onReport}>
					{t("errorContent.report")}
				</MagicButton>
			)}
			{onRetry && (
				<MagicButton type="link" onClick={onRetry}>
					{t("errorContent.retry")}
				</MagicButton>
			)}
		</Flex>
	)
}

export default ErrorContent
