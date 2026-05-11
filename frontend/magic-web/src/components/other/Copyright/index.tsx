import { Flex } from "antd"
import { createStyles } from "antd-style"
import { HTMLAttributes, memo, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { globalConfigStore } from "@/stores/globalConfig"
import { useGlobalLanguage } from "@/models/config/hooks"
import { SupportLocales } from "@/constants/locale"

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		brand: css`
			color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[2]};
			width: 100%;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			flex-wrap: wrap;

			@media (max-width: 700px) {
				display: none;
			}
		`,
	}
})

const Copyright = memo(function Copyright({ className }: HTMLAttributes<HTMLDivElement>) {
	const { styles, cx } = useStyles()
	const { t } = useTranslation("login")

	const language = useGlobalLanguage(false) as SupportLocales
	const globalConfig = globalConfigStore.globalConfig

	const IcpCode = useMemo(() => {
		if (!globalConfig?.footer?.filing?.enabled) {
			return null
		}
		return (
			<>
				<span>|</span>
				<a href={globalConfig?.footer?.filing?.link} style={{ color: "inherit" }}>
					{globalConfig?.footer?.filing?.number}
				</a>
			</>
		)
	}, [globalConfig])

	return (
		<Flex align="center" justify="center" className={cx(styles.brand, className)}>
			<span>{globalConfig?.footer?.copyright_i18n?.[language] ?? t("copyright")}</span>
			{IcpCode}
		</Flex>
	)
})

export default Copyright
