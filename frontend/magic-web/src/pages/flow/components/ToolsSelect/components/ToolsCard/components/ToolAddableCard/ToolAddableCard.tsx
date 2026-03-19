import { Flex, Tooltip } from "antd"
import { memo, useMemo } from "react"
import { ComponentTypes, FlowRouteType, type UseableToolSet } from "@/types/flow"
import MagicButton from "@/components/base/MagicButton"
import { IconHelp, IconPlus, IconWindowMaximize } from "@tabler/icons-react"
import DefaultToolIcon from "@/assets/logos/tool-avatar.png"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { createHighlightSegments, genDefaultComponent } from "@/pages/flow/utils/helpers"
import { useTranslation } from "react-i18next"
import { useFlowStore } from "@/stores/flow"
import useStyles from "./style"
import ToolAddableCardPopover from "../ToolAddableCardPopover/ToolAddableCardPopover"
import { useToolsPanel } from "../../../ToolsPanel/context/ToolsPanelProvider"
import type { ToolSelectedItem } from "../../../../types"
import { getRoutePath } from "@/routes/history/helpers"
import { RouteName } from "@/routes/constants"

interface ToolAddableCardProps {
	tool: UseableToolSet.UsableTool
	lineCount?: number
	fontSize14?: boolean
	textGap4?: boolean
	height?: number
	onClick?: (id: string) => void
	cardOpen: boolean
	toolSet: UseableToolSet.Item
	selectedTools?: ToolSelectedItem[]
}

const ToolAddableCard = memo(
	({
		tool,
		textGap4 = false,
		lineCount = 1,
		fontSize14 = false,
		height = 40,
		onClick,
		toolSet,
		selectedTools,
		...props
	}: ToolAddableCardProps) => {
		const { t } = useTranslation()
		const { toolInputOutputMap } = useFlowStore()
		const { currentNode } = useCurrentNode()

		const { code, name: title, description } = tool

		const { keyword, onAddTool } = useToolsPanel()

		const { styles, cx } = useStyles()

		const titleList = useMemo(() => {
			return createHighlightSegments(title, keyword)
		}, [title, keyword])

		const descList = useMemo(() => {
			return createHighlightSegments(description, keyword)
		}, [description, keyword])

		const isDisabled = useMemo(() => {
			const isNodeSelectedTool = !!currentNode?.params?.option_tools?.find?.(
				(v: ToolSelectedItem) => v?.tool_id === tool?.code,
			)
			const isSelectedTool = !!selectedTools?.find?.(
				(v: ToolSelectedItem) => v?.tool_id === tool?.code,
			)

			return isNodeSelectedTool || isSelectedTool
		}, [currentNode?.params?.option_tools, tool?.code, selectedTools])

		const mergedTool = useMemo(() => {
			const toolWithInputOutput = toolInputOutputMap?.[tool?.code]
			if (toolWithInputOutput) {
				return {
					...tool,
					input: toolWithInputOutput.input,
					output: toolWithInputOutput.output,
					custom_system_input: toolWithInputOutput.custom_system_input,
				}
			}

			return {
				...tool,
				input: null,
				output: null,
				custom_system_input: null,
			}
		}, [tool, toolInputOutputMap])

		return (
			<Flex
				vertical
				className={cx(styles.container)}
				onClick={(e) => {
					e.stopPropagation()
					onClick?.(code ?? "")
				}}
				{...props}
			>
				<Flex
					gap={10}
					style={{ minHeight: height }}
					align={height === 40 ? "center" : "flex-start"}
				>
					<Flex vertical gap={textGap4 ? 4 : 8} flex={1}>
						<Flex
							gap={6}
							className={cx(styles.title, { [styles.title14]: fontSize14 })}
							align="center"
						>
							<div>
								{titleList.map((titleItem, index) => {
									return (
										<span
											key={`title-${index}`}
											className={cx({
												[styles.highlight]: titleItem.type === "highlight",
											})}
										>
											{titleItem.value}
										</span>
									)
								})}
							</div>

							<ToolAddableCardPopover
								avatar={toolSet?.icon || DefaultToolIcon}
								tool={mergedTool}
							>
								<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
							</ToolAddableCardPopover>
							<Tooltip title={t("common.goToTargetTools", { ns: "flow" })}>
								<IconWindowMaximize
									size={16}
									color="#1C1D2399"
									onClick={(e) => {
										e.stopPropagation()

										window.open(
											getRoutePath({
												name: RouteName.FlowDetail,
												params: {
													id: tool.code,
													type: FlowRouteType.Tools,
												},
											}) as string,
											"_blank",
										)
									}}
								/>
							</Tooltip>
						</Flex>

						<div
							className={cx(styles.descroption, {
								[styles.lineClamp2]: lineCount === 2,
							})}
						>
							{descList.map((descItem) => {
								return (
									<span
										key={descItem.value}
										className={cx({
											[styles.highlight]: descItem.type === "highlight",
										})}
									>
										{descItem.value}
									</span>
								)
							})}
						</div>
					</Flex>
					<MagicButton
						type="default"
						onClick={() => {
							onAddTool({
								tool_id: tool.code,
								tool_set_id: toolSet.id,
								async: false,
								name: tool.name,
								description: tool.description,
								custom_system_input: {
									widget: null,
									form:
										tool.custom_system_input?.form ??
										genDefaultComponent(ComponentTypes.Form),
								},
							})
						}}
						disabled={isDisabled}
					>
						<IconPlus
							color={isDisabled ? "rgba(28, 29, 35, 0.35)" : "#315CEC"}
							size={20}
						/>
						{t("common.add", { ns: "flow" })}
					</MagicButton>
				</Flex>
			</Flex>
		)
	},
)

export default ToolAddableCard
