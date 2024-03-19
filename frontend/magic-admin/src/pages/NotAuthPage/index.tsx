import { Flex } from "antd"
import { useTranslation } from "react-i18next"
import { createStyles } from "antd-style"
import { MagicButton } from "components"
import { useAdmin } from "@/provider/AdminProvider"
import zero from "@/assets/logos/403-zero.svg"
import zeroDark from "@/assets/logos/403-zero-dark.svg"
import { RouteName } from "@/const/routes"

const useStyles = createStyles(({ css, token, isDarkMode }) => {
	return {
		container: css`
			width: 100vw;
			height: 100vh;
			flex: 1;
			background-color: ${isDarkMode
				? token.magicColorUsages.bg[0]
				: token.magicColorUsages.white};
		`,
		title: css`
			font-size: 100px;
			color: ${isDarkMode ? "#587DF0" : token.magicColorUsages.primary.default};
			font-weight: 900;
			line-height: normal;
		`,
		content: css`
			color: ${token.magicColorUsages.text[2]};
			font-size: 14px;
		`,
		subTitle: css`
			font-size: 32px;
			font-weight: 500;
			line-height: 44px;
		`,
		btn: css`
			display: flex;
			height: 32px;
			padding: 6px 24px;
			border-radius: 8px;
			background-color: ${isDarkMode ? "#587DF0" : token.magicColorUsages.primary.default};
			color: ${token.magicColorUsages.white};
			&:hover {
				background-color: ${isDarkMode
					? "#4B6AD0"
					: token.magicColorUsages.primary.hover} !important;
				color: ${token.magicColorUsages.white} !important;
			}
		`,
	}
})

export default function NotAuthPage({ className }: { className?: string }) {
	const { t } = useTranslation("admin/common")
	const { styles, cx } = useStyles()
	const { theme, navigate } = useAdmin()

	return (
		<Flex
			className={cx(styles.container, className)}
			justify="center"
			align="center"
			vertical
			gap={40}
		>
			<Flex gap={10} className={styles.title} justify="center" align="center">
				<span>4</span>
				<img src={theme === "dark" ? zeroDark : zero} alt="403" />
				<span>3</span>
			</Flex>
			<Flex vertical gap={20} align="center">
				<Flex vertical gap={4} align="center" justify="center" className={styles.content}>
					<div className={styles.subTitle}>{t("noAuth.title")}</div>
					<div>{t("noAuth.desc")}</div>
				</Flex>
				<MagicButton
					className={styles.btn}
					onClick={() => {
						navigate({ name: RouteName.Admin })
					}}
				>
					{t("noAuth.return")}
				</MagicButton>
			</Flex>
		</Flex>
	)
}
