import OperateMenu from "@/opensource/pages/flow/components/OperateMenu"
import { Flex, Switch } from "antd"
import { memo, useMemo } from "react"
import type { OperationTypes } from "@/opensource/pages/flow/components/AuthControlButton/types"
import { useTranslation } from "react-i18next"
import { Flow, FlowRouteType, FlowTool } from "@/types/flow"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { DrawerItem, DataType } from "../RightDrawer"
import useStyles from "./style"
import type { FlowWithTools } from "../../hooks/useFlowList"
import MCPDesc from "./components/MCPDesc/MCPDesc"

interface ToolCardProps {
	data: DataType
	item: DrawerItem
	isTools: boolean
	handleGoToFlow: (e: React.MouseEvent<HTMLElement, MouseEvent>, item: DrawerItem) => void
	hasEditRight: (operation: OperationTypes) => boolean
	handlerInnerUpdateEnable: (
		e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent<HTMLButtonElement>,
		tool?: FlowTool.Tool | Flow.Mcp.ListItem,
	) => void
	getDropdownItems: (
		tool: FlowTool.Tool | Flow.Mcp.ListItem,
		flow: MagicFlow.Flow,
	) => React.ReactNode
	flowType: FlowRouteType
}
const Card = memo(
	({
		data,
		item,
		isTools,
		handleGoToFlow,
		hasEditRight,
		handlerInnerUpdateEnable,
		getDropdownItems,
		flowType,
	}: ToolCardProps) => {
		const { styles, cx } = useStyles()
		const { t } = useTranslation("interface")
		const isMcp = useMemo(() => flowType === FlowRouteType.Mcp, [flowType])

		return (
			<Flex
				key={item.title}
				vertical
				gap={4}
				onClick={(e) => handleGoToFlow(e, item)}
				className={cx(styles.drawerItem, {
					[styles.drawerItemActive]: isTools,
				})}
			>
				<Flex align="center" justify="space-between">
					<Flex gap={10} align="center" style={{ width: "80%" }}>
						<div className={styles.drawerItemTitle}>{item.title}</div>
						<div>{item.type}</div>
					</Flex>
					{item.required && <div className={styles.require}>{t("flow.required")}</div>}
					{item.more && hasEditRight(data.user_operation) && (
						<Flex gap={4} className={styles.moreOperations} align="center">
							{hasEditRight(data.user_operation) && (
								<Switch
									size="small"
									checked={item.enabled}
									onChange={(_, e) => {
										handlerInnerUpdateEnable(e, item.rawData)
									}}
								/>
							)}
							<OperateMenu
								useIcon
								menuItems={getDropdownItems(item.rawData!, data as FlowWithTools)}
							/>
						</Flex>
					)}
				</Flex>
				{isMcp && <MCPDesc item={item?.rawData as Flow.Mcp.Detail} />}
				<div className={styles.subDesc}>{item.desc}</div>
			</Flex>
		)
	},
)

const ToolCard = memo((props: ToolCardProps) => {
	const { item, data, hasEditRight, getDropdownItems } = props
	const menuItems = getDropdownItems(item.rawData!, data as FlowWithTools)
	const shouldShowMenu = item.more && hasEditRight(data.user_operation)

	return shouldShowMenu ? (
		<OperateMenu trigger="contextMenu" placement="right" menuItems={menuItems} key={data.id}>
			<Card {...props} />
		</OperateMenu>
	) : (
		<Card {...props} />
	)
})

export default ToolCard
