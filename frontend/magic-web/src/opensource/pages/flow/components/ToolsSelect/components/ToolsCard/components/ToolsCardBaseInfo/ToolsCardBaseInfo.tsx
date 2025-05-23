import { Flex } from "antd"
import { memo, useMemo } from "react"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { useTranslation } from "react-i18next"
import defaultToolAvatar from "@/assets/logos/tool-avatar.png"
import type { UseableToolSet } from "@/types/flow"
import { resolveToString } from "@dtyq/es6-template-strings"
import { IconAlertCircleFilled, IconCircleCheckFilled, IconTools } from "@tabler/icons-react"
import { colorScales } from "@/opensource/providers/ThemeProvider/colors"
import useStyles from "./style"
import FlowTag from "../../../../../FlowTag"

interface ToolsCardBaseInfoProps {
	toolSet: UseableToolSet.Item
	lineCount?: number
	fontSize14?: boolean
	textGap4?: boolean
	height?: number
	onClick?: (id: string) => void
}

const ToolsCardBaseInfo = memo(
	({
		toolSet,
		textGap4 = false,
		lineCount = 1,
		fontSize14 = false,
		height = 40,
		onClick,
		...props
	}: ToolsCardBaseInfoProps) => {
		const { id, name: title, icon, description } = toolSet
		const { t } = useTranslation("interface")

		const { styles, cx } = useStyles({ img: icon as string })

		const defaultAvatar = useMemo(() => {
			return <img src={defaultToolAvatar} className={styles.defaultAvatar} alt="" />
		}, [styles])

		const tagRender = useMemo(() => {
			const quote = toolSet.agent_used_count ? toolSet.agent_used_count : 0
			const tools = toolSet.tools ? toolSet.tools.length : 0
			const quoteTag =
				quote > 0
					? [
							{
								key: "quote",
								text: resolveToString(t("agent.quoteAgent"), { num: quote || 0 }),
								icon: (
									<IconCircleCheckFilled size={12} color={colorScales.green[4]} />
								),
							},
					  ]
					: [
							{
								key: "quote",
								text: t("agent.noQuote"),
								icon: (
									<IconAlertCircleFilled
										size={12}
										color={colorScales.orange[5]}
									/>
								),
							},
					  ]

			return [
				{
					key: "tool",
					text: resolveToString(t("flow.toolsNum"), { num: tools }),
					icon: <IconTools size={12} color={colorScales.brand[5]} />,
				},
				...quoteTag,
			]
		}, [toolSet.agent_used_count, toolSet.tools, t])

		return (
			<Flex
				vertical
				className={styles.container}
				onClick={() => onClick?.(id ?? "")}
				{...props}
			>
				<Flex
					gap={10}
					style={{ minHeight: height }}
					align={height === 40 ? "center" : "flex-start"}
				>
					{icon ? (
						<MagicAvatar style={{ borderRadius: 8 }} src={icon} size={50}>
							{title}
						</MagicAvatar>
					) : (
						defaultAvatar
					)}
					<Flex vertical gap={textGap4 ? 4 : 8} flex={1}>
						<div className={cx(styles.title, { [styles.title14]: fontSize14 })}>
							{title}
						</div>

						<div
							className={cx(styles.descroption, {
								[styles.lineClamp2]: lineCount === 2,
							})}
						>
							{description}
						</div>
					</Flex>

					<Flex justify="space-between" align="center">
						<Flex gap={4} align="center">
							{tagRender.map((item) => {
								return (
									<FlowTag
										key={`${toolSet.id}-${item.key}`}
										text={item.text}
										icon={item.icon}
									/>
								)
							})}
						</Flex>
					</Flex>
				</Flex>
			</Flex>
		)
	},
)

export default memo(ToolsCardBaseInfo)
