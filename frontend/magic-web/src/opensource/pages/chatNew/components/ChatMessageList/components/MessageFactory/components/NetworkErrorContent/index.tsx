import MagicButton from "@/opensource/components/base/MagicButton"
import { IconReload } from "@tabler/icons-react"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { memo } from "react"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ css, token }) => ({
	container: css`
		width: 100%;
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
		margin: 8px 0;
		height: 108px;
	`,
	invalidText: css`
		color: ${token.magicColorUsages.text[2]};
		text-align: justify;
		font-size: 14px;
		line-height: 20px;
		white-space: pre-wrap;
	`,
}))

interface NetworkErrorContentProps extends React.HTMLAttributes<HTMLDivElement> {
	icon?: React.ReactNode
	onReload?: () => void
}

const NetworkErrorContent = memo(({ onReload, icon, className }: NetworkErrorContentProps) => {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("interface")

	return (
		<Flex
			vertical
			className={cx(styles.container, className)}
			justify="center"
			align="center"
			gap={10}
		>
			<div className={styles.invalidText}>{t("chat.message.networkError.description")}</div>
			{onReload && (
				<MagicButton
					type="link"
					size="small"
					onClick={onReload}
					icon={icon ?? <IconReload size={18} color="currentColor" />}
				>
					{t("chat.message.networkError.reload")}
				</MagicButton>
			)}
		</Flex>
	)
})

export default NetworkErrorContent
