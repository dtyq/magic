import { useTranslation } from "react-i18next"
import { ErrorBoundary } from "react-error-boundary"
import { useState } from "react"
import type { PropsWithChildren } from "react"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { useCountDown } from "ahooks"
import { logger as Logger } from "@/utils/log"
import MagicButton from "@/components/base/MagicButton"
import { isDev } from "@/utils/env"
import UpdateBg from "@/assets/resources/defaultImages/update_bg.svg"
import { getNativePort } from "@/platform/native"

const logger = Logger.createLogger("errorBoundary")

const useStyles = createStyles(({ css, isDarkMode, token }) => {
	return {
		container: css`
			height: 100vh;
			background-color: ${isDarkMode ? "#141414" : "#fff"};
			display: flex;
			align-items: center;
		`,
		wrapper: css`
			width: 420px;
			display: flex;
			flex-direction: column;
			align-items: center;
			margin: auto;
			gap: 40px;
		`,
		bg: css`
			width: 240px;
			height: 240px;
		`,
		title: css`
			color: ${token.magicColorUsages.text[0]};
			text-align: center;
			font-size: 32px;
			font-style: normal;
			font-weight: 600;
			line-height: 44px; /* 137.5% */
		`,
		desc: css`
			color: ${token.magicColorUsages.text[2]};
			text-align: center;
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px; /* 142.857% */
		`,
		tip: css`
			color: ${token.magicColorUsages.text[2]};
			text-align: center;
			font-size: 14px;
			font-style: normal;
			font-weight: 400;
			line-height: 20px; /* 142.857% */
		`,
	}
})

function GlobalErrorBoundary({ children }: PropsWithChildren) {
	const { t } = useTranslation("interface")

	const { styles } = useStyles()
	const [targetDate, setTargetDate] = useState<number>()

	const [countdown] = useCountDown({
		targetDate,
		onEnd: () => {
			if (!isDev) {
				window.location.reload()
			}
		},
	})

	return (
		<ErrorBoundary
			onError={(error, errorInfo) => {
				logger.error("Global Error Boundary caught an error:", error, errorInfo)
				setTargetDate(Date.now() + 3000)
				getNativePort().environment.webHasNewVersionToUpdate()
			}}
			fallbackRender={() => {
				return (
					<div className={styles.container}>
						<div className={styles.wrapper}>
							<div className={styles.bg}>
								<img src={UpdateBg} alt="" />
							</div>
							<Flex vertical align="center" gap={16}>
								<span className={styles.title}>{t("global.boundaryTitle")}</span>
								<span className={styles.desc}>{t("global.boundaryDesc")}</span>
								<MagicButton
									type="primary"
									style={{ width: "fit-content" }}
									onClick={() => window.location.reload()}
								>
									{t("global.refresh")}
								</MagicButton>
								<span className={styles.tip}>
									{t("global.boundaryTip", {
										second: Math.round(countdown / 1000),
									})}
								</span>
							</Flex>
						</div>
					</div>
				)
			}}
		>
			{children}
		</ErrorBoundary>
	)
}

export default GlobalErrorBoundary
