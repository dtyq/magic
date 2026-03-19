import { env } from "@/utils/env"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { HTMLAttributes, memo, useMemo } from "react"
import { useTranslation } from "react-i18next"

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

	const IcpCode = useMemo(() => {
		if (!env("MAGIC_ICP_CODE")) {
			return null
		}
		return (
			<>
				<span>|</span>
				<a href="https://beian.miit.gov.cn" style={{ color: "inherit" }}>
					{env("MAGIC_ICP_CODE")}
				</a>
			</>
		)
	}, [])

	return (
		<Flex align="center" justify="center" className={cx(styles.brand, className)}>
			<span>{env("MAGIC_COPYRIGHT") ?? t("copyright")}</span>
			{IcpCode}
		</Flex>
	)
})

export default Copyright
