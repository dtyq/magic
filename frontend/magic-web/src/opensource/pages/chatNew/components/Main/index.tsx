import Logo from "@/opensource/components/MagicLogo"
import { LogoType } from "@/opensource/components/MagicLogo/LogoType"
import HomeBotAnimation from "@/opensource/components/animations/HomeBotAnimation"
import { Flex } from "antd"
import { createStyles } from "antd-style"
import { useTranslation } from "react-i18next"

import { IMStyle, useAppearanceStore } from "@/opensource/providers/AppearanceProvider/context"
import type { HTMLAttributes } from "react"
import ExampleCard from "./components/ExampleCard"

const useStyles = createStyles(({ isDarkMode, css, token }, { imStyle }: { imStyle: IMStyle }) => {
	return {
		main: {
			position: "relative",
			width: "100%",
			minWidth: 420,
			height: "100%",
			color: isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.black,
			flex: 1,
			padding: imStyle === IMStyle.Modern ? "0 18px 24px" : 0,
		},

		top: {
			margin: "100px 0",
			flex: 1,
		},

		title: {
			color: isDarkMode ? token.magicColorUsages.white : token.magicColorUsages.text[1],
			fontSize: 50,
			fontWeight: 600,
			overflow: "hidden",
			whiteSpace: "nowrap",
		},

		magicEn: {
			width: 150,
			marginTop: 12,
		},

		magicCN: {
			width: 75,
		},

		description: css`
			color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[2]};
			font-size: 18px;
			font-weight: 200;
			line-height: 24px;
			margin-bottom: 30px;
		`,
		exampleMessages: {
			margin: "20px 0 30px",
		},

		footer: {
			width: "100%",
			position: "relative",
		},

		bot: {
			position: "absolute",
			top: 0,
			margin: "auto",
			left: "50%",
			transform: "translateX(-50%)",
		},
	}
})

const data = [
	{
		icon: "🎯",
		content: "总结会议重点后将会议中的事项创建成任务及通知相关负责人",
		key: "message",
	},
	{
		icon: "📊",
		content: "使用环比、同比分析最近一个月的销售额，并给出优化建议",
		key: "addressBook",
	},
]

function Main(props: HTMLAttributes<HTMLDivElement>) {
	const { t } = useTranslation("interface")
	const imStyle = useAppearanceStore((state) => state.imStyle)
	const { styles } = useStyles({ imStyle })

	return (
		<Flex className={styles.main} vertical align="center" justify="space-between" {...props}>
			<div className={styles.top}>
				<Flex vertical align="center" gap={10}>
					<Flex align="center" justify="center" gap={16} className={styles.title}>
						{t("home.welcomeTo")}
						<Logo type={LogoType.COLOR_TEXT} className={styles.magicEn} />
					</Flex>
					<div className={styles.description}>{t("home.description")}</div>
					<Flex className={styles.exampleMessages} vertical gap={10}>
						{data.map(({ key, ...item }, index) => (
							<ExampleCard
								key={key}
								style={{
									transform: `scale(${1 - index * 0.05})`,
									// opacity: 1 - index * 0.25,
								}}
								{...item}
							/>
						))}
					</Flex>
				</Flex>
			</div>
			{/* {imStyle === IMStyle.Standard ? null : <HomeBotAnimation />} */}
			<Flex vertical align="center" className={styles.footer} justify="flex-end">
				{imStyle === IMStyle.Standard ? null : <HomeBotAnimation />}
			</Flex>
		</Flex>
	)
}

export default Main
