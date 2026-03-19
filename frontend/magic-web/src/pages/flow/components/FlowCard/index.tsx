import { Flex, Switch } from "antd"
import { useMemoizedFn } from "ahooks"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { memo, useMemo } from "react"
import PromptCard from "@/pages/explore/components/PromptCard"
import { IconCircleCheckFilled, IconAlertCircleFilled, IconTools } from "@tabler/icons-react"
import { cx } from "antd-style"
import type { FlowTool } from "@/types/flow"
import { FlowRouteType, Flow as FlowScope } from "@/types/flow"
import { useTranslation } from "react-i18next"
import { colorScales } from "@/providers/ThemeProvider/colors"
import { formatToK } from "@/utils/number"
import FlowTag from "../FlowTag"
import useStyles from "./style"
import OperateMenu from "../OperateMenu"
import { hasEditRight } from "../AuthControlButton/types"
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
	const isSSEMcp = useMemo(() => {
		return flowType === FlowRouteType.Mcp && (data as FlowScope.Mcp.Detail).type === "sse"
	}, [flowType, data])

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
		const hasTools = flowType === FlowRouteType.Tools || isSSEMcp
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
						text: t("agent.quoteAgent", { num: quote || 0 }),
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
					text: t("flow.toolsNum", { num: tools }),
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
			<PromptCard
				type={flowType}
				data={cardData}
				lineCount={lineCount}
				height={9}
				titleExtra={
					hasEditRight(data.user_operation) && (
						<OperateMenu menuItems={dropdownItems} useIcon />
					)
				}
			/>
			<Flex justify="space-between" align="center" className={styles.statusWrapper}>
				{flowType !== FlowRouteType.VectorKnowledge && (
					<Flex gap={4} align="center" wrap>
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

				<Flex gap={8} align="center">
					{t("agent.status")}
					<Switch
						disabled={!hasEditRight(data.user_operation)}
						checked={data.enabled}
						onChange={updateInnerEnable}
						size="small"
					/>
				</Flex>
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
		</Flex>
	)
}

const FlowCard = memo((props: FlowCardProps) => {
	return (
		<OperateMenu
			trigger="contextMenu"
			placement="right"
			menuItems={hasEditRight(props.data.user_operation) && props.dropdownItems}
			key={props.data.id}
		>
			<Card {...props} />
		</OperateMenu>
	)
})

FlowCard.displayName = "FlowCard"

export default FlowCard
