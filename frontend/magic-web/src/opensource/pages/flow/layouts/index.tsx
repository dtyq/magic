import { Outlet } from "react-router-dom"
import { createStyles } from "antd-style"

import { Flex } from "antd"
import type { PropsWithChildren } from "react"
import { useTranslation } from "react-i18next"
import FlowSubSider from "../components/FlowSubSider"
import LoadingFallback from "@/opensource/components/fallback/LoadingFallback"

interface FlowLayoutProps extends PropsWithChildren {}

const useFlowLayoutStyles = createStyles(({ css, isDarkMode, token }) => {
	const headerHeight = 50
	return {
		navList: css`
			height: 60px;
			display: flex;
			align-items: center;
			padding: 0 0 0 20px;
			overflow: hidden;
			background: ${isDarkMode
				? token.magicColorScales.grey[9]
				: token.magicColorUsages.white};
			border-bottom: 1px solid
				${isDarkMode ? token.magicColorScales.grey[8] : token.magicColorUsages.border};
		`,
		navItem: css`
			cursor: pointer;
			height: 40px;
			padding: 4px 20px;
			display: flex;
			align-items: center;
			gap: 4px;
			color: ${isDarkMode ? token.magicColorScales.grey[9] : token.magicColorUsages.text[1]};
		`,
		noSelected: css`
			color: ${isDarkMode ? token.magicColorScales.grey[1] : token.magicColorUsages.text[1]};
		`,
		selected: css`
			color: currentColor;
			position: relative;
			font-weight: 600;

			&::before {
				content: "";
				display: block;
				position: absolute;
				top: 99%;
				left: 50%;
				transform: translate(-50%, 0);
				width: 100px;
				height: 50px;
				background: currentColor;
				opacity: 0.3;
				filter: blur(20px);
			}
		`,
		title: css`
			color: inherit;
		`,
		container: css`
			height: calc(100% - ${headerHeight}px);
		`,
		content: css`
			flex: 1;
			height: 100%;
		`,
		header: css`
			padding: 13px 20px;
			border-bottom: 1px solid ${token.colorBorder};
			font-size: 18px;
			font-weight: 600;
			color: ${isDarkMode ? token.magicColorScales.grey[9] : token.magicColorUsages.text[1]};
			background: ${isDarkMode ? "transparent" : token.magicColorUsages.white};
			height: ${headerHeight}px;
		`,
		arrow: css`
			border-radius: 4px;
			cursor: pointer;
			&:hover {
				background: ${isDarkMode
					? token.magicColorScales.grey[6]
					: token.magicColorScales.grey[0]};
			}
		`,
	}
})

export default function FlowLayout({ children }: FlowLayoutProps) {
	const { styles } = useFlowLayoutStyles()
	const { t } = useTranslation("interface")

	return (
		<Flex flex={1} vertical className="h-full overflow-hidden rounded-lg border border-border">
			<Flex className={styles.header} align="center" gap={14}>
				{/* <MagicIcon
					component={IconChevronLeft}
					size={24}
					className={styles.arrow}
					onClick={() => navigate({ delta: -1 })}
				/> */}
				<div>{t("agent.agentManage")}</div>
			</Flex>
			<Flex className={styles.container}>
				<FlowSubSider />
				<div className={styles.content}>
					<LoadingFallback>{children || <Outlet />}</LoadingFallback>
				</div>
			</Flex>
		</Flex>
	)
}
