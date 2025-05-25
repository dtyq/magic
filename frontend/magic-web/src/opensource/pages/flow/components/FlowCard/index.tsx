import { Flex, Switch } from "antd"
import { useMemoizedFn } from "ahooks"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { memo, useMemo } from "react"
import PromptCard from "@/opensource/pages/explore/components/PromptCard"
import { IconCircleCheckFilled, IconAlertCircleFilled, IconTools } from "@tabler/icons-react"
import { cx } from "antd-style"
import type { FlowTool } from "@/types/flow"
import { FlowRouteType, Flow as FlowScope } from "@/types/flow"
import { useTranslation } from "react-i18next"
import { resolveToString } from "@dtyq/es6-template-strings"
import { colorScales } from "@/opensource/providers/ThemeProvider/colors"
import { formatToK } from "@/utils/number"
import FlowTag from "../FlowTag"
import useStyles from "./style"
import OperateMenu from "../OperateMenu"
import { hasEditRight, hasViewRight } from "../AuthControlButton/types"
import type { Knowledge } from "@/types/knowledge"

type Flow = MagicFlow.Flow & {
	quote?: number
	icon?: string
	created_at?: string
	agent_used_count?: number
	tools?: FlowTool.Tool[]
}

type FlowCardProps = {
	data: Flow | Knowledge.KnowledgeItem | FlowScope.Mcp.Detail
	selected: boolean
	lineCount: number
	flowType?: FlowRouteType
	dropdownItems: React.ReactNode
	onCardClick: (flow: MagicFlow.Flow | Knowledge.KnowledgeItem | FlowScope.Mcp.Detail) => void
	updateEnable: (flow: Flow | Knowledge.KnowledgeItem | FlowScope.Mcp.Detail) => void
}

function Card({
	data,
	lineCount,
	selected,
	dropdownItems,
	onCardClick,
	updateEnable,
	flowType,
}: FlowCardProps) {
	const { styles } = useStyles()

	const { t } = useTranslation("interface")
	const { t: tFlow } = useTranslation("flow")

	const updateInnerEnable = useMemoizedFn((_, e) => {
		e.stopPropagation()
		updateEnable(data)
	})

	const handleInnerClick = useMemoizedFn(() => {
		onCardClick?.(data)
	})

	const cardData = useMemo(() => {
		return {
			id: data.id,
			title: data.name,
			icon: data.icon,
			description: data.description,
		}
	}, [data])

	const tagRender = useMemo(() => {
		let quote = 0
		let tools = 0
		const hasTools = flowType === FlowRouteType.Tools || flowType === FlowRouteType.Mcp
		switch (flowType) {
			case FlowRouteType.Mcp:
				tools = (data as FlowScope.Mcp.Detail).tools_count
				quote = (data as Flow).agent_used_count ?? 0
				break
			case FlowRouteType.Tools:
				quote = (data as Flow).agent_used_count ?? 0
				tools = (data as Flow).tools?.length ?? 0
				break
			case FlowRouteType.Sub:
				quote = (data as Flow).quote ?? 0
				break
			// TODO 知识库的引用关系
			default:
				break
		}
		const quoteTag =
			quote > 0
				? [
						{
							key: "quote",
							text: resolveToString(t("agent.quoteAgent"), { num: quote || 0 }),
							icon: <IconCircleCheckFilled size={12} color={colorScales.green[4]} />,
						},
				  ]
				: [
						{
							key: "quote",
							text: t("agent.noQuote"),
							icon: <IconAlertCircleFilled size={12} color={colorScales.orange[5]} />,
						},
				  ]

		return hasTools
			? [
					{
						key: "tool",
						text: resolveToString(t("flow.toolsNum"), { num: tools }),
						icon: <IconTools size={12} color={colorScales.brand[5]} />,
					},
					...quoteTag,
			  ]
			: quoteTag
	}, [data, flowType, t])

	return (
		<Flex
			vertical
			className={cx(styles.cardWrapper, { [styles.checked]: selected })}
			gap={8}
			onClick={handleInnerClick}
		>
			<PromptCard type={flowType} data={cardData} lineCount={lineCount} height={9} />
			<Flex justify="space-between" align="center">
				{flowType !== FlowRouteType.VectorKnowledge && (
					<Flex gap={4} align="center">
						{tagRender.map((item) => {
							return (
								<FlowTag
									key={`${data.id}-${item.key}`}
									text={item.text}
									icon={item.icon}
								/>
							)
						})}
					</Flex>
				)}

				{hasEditRight(data.user_operation) && (
					<Flex gap={8} align="center">
						{t("agent.status")}
						<Switch checked={data.enabled} onChange={updateInnerEnable} size="small" />
					</Flex>
				)}
			</Flex>
			<Flex justify="space-between" align="center">
				<div>{`${t("agent.createTo")} ${data.created_at?.replace(/-/g, "/")}`}</div>
				{flowType === FlowRouteType.VectorKnowledge && (
					<Flex gap={5} align="center">
						<div>
							{tFlow("common.documentCount", {
								num: data.document_count || 0,
							})}
						</div>
						<div>/</div>
						<div>
							{tFlow("common.wordCount", {
								num: formatToK(data.word_count) || 0,
							})}
						</div>
					</Flex>
				)}
			</Flex>
			{hasViewRight(data.user_operation) && (
				<div className={styles.moreOperations}>
					<OperateMenu menuItems={dropdownItems} useIcon />
				</div>
			)}
		</Flex>
	)
}

const FlowCard = memo((props: FlowCardProps) => {
	return (
		<OperateMenu
			trigger="contextMenu"
			placement="right"
			menuItems={props.dropdownItems}
			key={props.data.id}
		>
			<Card {...props} />
		</OperateMenu>
	)
})

FlowCard.displayName = "FlowCard"

export default FlowCard
