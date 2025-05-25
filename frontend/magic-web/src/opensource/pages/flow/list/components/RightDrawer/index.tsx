import { FlowApi } from "@/apis"
import { Flex, Avatar, message } from "antd"
import { useBoolean, useMemoizedFn, useResetState } from "ahooks"
import MagicButton from "@/opensource/components/base/MagicButton"
import MagicIcon from "@/opensource/components/base/MagicIcon"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { IconX, IconEdit } from "@tabler/icons-react"
import { memo, useEffect, useMemo } from "react"
import MagicAvatar from "@/opensource/components/base/MagicAvatar"
import { useTranslation } from "react-i18next"
import { Flow, FlowTool, FlowRouteType } from "@/types/flow"
import FlowEmptyImage from "@/assets/logos/empty-flow.png"
import ToolsEmptyImage from "@/assets/logos/empty-tools.svg"
import KeyManagerButton from "@/opensource/pages/flow/components/KeyManager/KeyManagerButton"
import { resolveToString } from "@dtyq/es6-template-strings"
import AuthControlButton from "@/opensource/pages/flow/components/AuthControlButton/AuthControlButton"
import {
	hasAdminRight,
	hasEditRight,
	hasViewRight,
	ResourceTypes,
} from "@/opensource/pages/flow/components/AuthControlButton/types"
import useStyles from "./style"
import BindOpenApiAccount from "../BindOpenApiAccount"
import ToolCard from "../ToolCard"
import type { FlowWithTools } from "../../hooks/useFlowList"
import { defaultAvatarMap, flowTypeToApiKeyType } from "../../constants"
import ToolImportButton from "./components/ToolImportButton"
import { EventEmitter } from "ahooks/lib/useEventEmitter"
import { pick } from "lodash-es"
import { Knowledge } from "@/types/knowledge"
export type DataType = MagicFlow.Flow | Knowledge.KnowledgeItem | Flow.Mcp.Detail

export type DrawerItem = {
	id?: string
	title?: string
	desc?: string
	type?: string
	enabled?: boolean
	required?: boolean
	more?: boolean
	rawData?: FlowTool.Tool | Flow.Mcp.ListItem
}

type RightDrawerProps = {
	open: boolean
	data: DataType
	flowType: FlowRouteType
	openAddOrUpdateFlow: () => void
	goToFlow: (id: string) => void
	onClose: () => void
	setGroupId: React.Dispatch<React.SetStateAction<string>>
	getDropdownItems: (
		tool: FlowTool.Tool | Flow.Mcp.ListItem,
		flow: MagicFlow.Flow,
	) => React.ReactNode
	mcpEventListener?: EventEmitter<string>
	setCurrentFlow: (flow: DataType) => void
	mutate: (data: any) => void
}

function RightDrawer({
	open,
	data,
	flowType,
	getDropdownItems,
	goToFlow,
	setGroupId,
	openAddOrUpdateFlow,
	onClose,
	mcpEventListener,
	setCurrentFlow,
	mutate,
}: RightDrawerProps) {
	const { styles } = useStyles({ open })

	const { t } = useTranslation("interface")
	const { t: globalT } = useTranslation()

	const [drawerItems, setDrawerItems, resetDrawerItems] = useResetState<DrawerItem[]>([])

	const [bindOpenApiAccountOpen, { setFalse: closeBindOpenApiAccount }] = useBoolean(false)
	const [keyManagerOpen, { setTrue: openKeyManager, setFalse: closeKeyManager }] =
		useBoolean(false)

	const isTools = useMemo(() => flowType === FlowRouteType.Tools, [flowType])
	const isMcp = useMemo(() => flowType === FlowRouteType.Mcp, [flowType])

	const getDrawerItem = useMemoizedFn(async () => {
		switch (flowType) {
			case FlowRouteType.Mcp:
				const mcpTools = await FlowApi.getMcpToolList(data.id as string)
				if (mcpTools.list.length) {
					const items = mcpTools.list.map((tool) => {
						return {
							id: tool.id,
							title: tool.name,
							desc: tool.description,
							enabled: tool.enabled,
							more: true,
							rawData: tool,
						}
					})
					// @ts-ignore
					setDrawerItems(items)
					mutate((currentData: any[]) => {
						return currentData?.map((page) => ({
							...page,
							list: page?.list.map((item: Flow.Mcp.Detail) => {
								if (item.id === data.id) {
									return {
										...item,
										tools_count: mcpTools.list.length,
									}
								}
								return item
							}),
						}))
					})
				}
				break
			case FlowRouteType.Tools:
				const tools = (data as FlowWithTools)?.tools
				if (tools?.length) {
					const items = tools.map((tool) => {
						return {
							id: tool.code,
							title: tool.name,
							desc: tool.description,
							enabled: tool.enabled,
							more: true,
							rawData: tool,
						}
					})
					setDrawerItems(items)
				}
				break
			case FlowRouteType.Sub:
				const subFlow = await FlowApi.getSubFlowArguments(data?.id as string)
				const structure = subFlow.input?.form.structure
				if (structure) {
					const { properties, required } = structure
					const items = Object.entries(properties || {}).map(([key, value]) => {
						const { title, type, description } = value
						return {
							title: key,
							desc: `${title} ${description}`,
							type,
							required: required?.includes(key) || false,
						}
					})
					setDrawerItems(items)
				}
				break
			case FlowRouteType.VectorKnowledge:
				break
			default:
				break
		}
	})

	mcpEventListener?.useSubscription?.(() => {
		getDrawerItem()
	})

	useEffect(() => {
		if (open && data) {
			if (drawerItems.length) resetDrawerItems()
			getDrawerItem()
		}
		if (!open) {
			resetDrawerItems()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data, open, getDrawerItem, resetDrawerItems])

	const subTitle = useMemo(() => {
		const toolsLength =
			(data as FlowWithTools)?.tools?.length || (data as Flow.Mcp.Detail)?.tools_count
		if (toolsLength) {
			return resolveToString(t("flow.hasToolsNum"), {
				num: toolsLength,
			})
		}
		return t("flow.flowInput")
	}, [data, t])

	const handleAddTool = useMemoizedFn(() => {
		if (data?.id) {
			setGroupId(data?.id)
			openAddOrUpdateFlow()
		}
	})

	const handleGoToFlow = useMemoizedFn(
		(e: React.MouseEvent<HTMLElement, MouseEvent>, item: DrawerItem) => {
			if (isTools) {
				goToFlow(item.id!)
			} else {
				e.stopPropagation()
			}
		},
	)

	const handleInnerClose = useMemoizedFn(() => {
		if (bindOpenApiAccountOpen) closeBindOpenApiAccount()
		if (keyManagerOpen) closeKeyManager()
		onClose()
		resetDrawerItems()
	})

	const handlerInnerUpdateEnable = useMemoizedFn(async (e, tool) => {
		e.stopPropagation()
		if (isMcp) {
			const mcpTool = pick(tool, [
				"id",
				"source",
				"name",
				"description",
				"icon",
				"rel_code",
				"enabled",
			])
			await FlowApi.saveMcpTool(
				{
					...mcpTool,
					enabled: !tool.enabled,
				},
				data.id as string,
			)
		} else {
			await FlowApi.changeEnableStatus(tool.code)
		}
		const text = tool.enabled
			? globalT("common.baned", { ns: "flow" })
			: globalT("common.enabled", { ns: "flow" })
		message.success(`${tool.name} ${text}`)

		tool.enabled = !tool.enabled
		const newDrawerItems = drawerItems.map((item) => {
			if (item.id === tool.code || item.id === tool.id) {
				return {
					...item,
					enabled: tool.enabled,
				}
			}
			return item
		})
		setDrawerItems(newDrawerItems)
	})

	const buttons = useMemo(() => {
		const toolsBtn = [
			...(hasEditRight(data.user_operation)
				? [
						<MagicButton
							key="add-tools"
							type="primary"
							style={{ flex: 1 }}
							onClick={handleAddTool}
						>
							{t("flow.addTools")}
						</MagicButton>,
				  ]
				: []),
			...(hasAdminRight(data.user_operation)
				? [
						<AuthControlButton
							key="auth-control-tools"
							resourceType={ResourceTypes.Tools}
							resourceId={data?.id ?? ""}
						/>,
				  ]
				: []),
		]
		const flowsBtn = [
			...(hasViewRight(data.user_operation)
				? [
						<MagicButton
							key="go-to-flow"
							type="primary"
							onClick={() => goToFlow(data?.id ?? "")}
						>
							{hasEditRight(data.user_operation)
								? t("button.edit")
								: t("button.view")}
						</MagicButton>,
				  ]
				: []),
			...(hasEditRight(data.user_operation)
				? [
						// <MagicButton
						// 	type="text"
						// 	className={styles.button}
						// 	onClick={openBindOpenApiAccount}
						// >
						// 	{t("flow.appAuth")}
						// </MagicButton>,
						<MagicButton
							key="api-key"
							type="text"
							className={styles.button}
							onClick={openKeyManager}
						>
							API Key
						</MagicButton>,
				  ]
				: []),

			...(hasAdminRight(data.user_operation)
				? [
						<AuthControlButton
							key="auth-control-flow"
							resourceType={ResourceTypes.Flow}
							resourceId={data?.id ?? ""}
						/>,
				  ]
				: []),
		]
		const mcpBtns = [
			...(hasEditRight(data.user_operation)
				? [
						<ToolImportButton
							drawerItems={drawerItems}
							getDrawerItem={getDrawerItem}
							data={data}
							key="import-tools"
							setCurrentFlow={setCurrentFlow}
						/>,
						<MagicButton
							key="api-key"
							type="text"
							className={styles.button}
							onClick={openKeyManager}
						>
							API Key
						</MagicButton>,
						<AuthControlButton
							key="auth-control-flow"
							className={styles.button}
							resourceType={ResourceTypes.Mcp}
							resourceId={data?.id ?? ""}
						/>,
				  ]
				: []),
		]
		if (isMcp) return mcpBtns
		if (isTools) return toolsBtn
		return flowsBtn
	}, [
		data,
		drawerItems,
		goToFlow,
		handleAddTool,
		isMcp,
		isTools,
		openKeyManager,
		styles.button,
		t,
		getDrawerItem,
	])

	const defaultAvatar = useMemo(() => {
		return (
			<img
				src={defaultAvatarMap[flowType]}
				style={{ width: "50px", borderRadius: 8 }}
				alt=""
			/>
		)
	}, [flowType])

	const emptyTips = useMemo(() => {
		const emptyTipsMap = {
			[FlowRouteType.Tools]: t("flow.emptyTips", {
				title: t("common.tools", { ns: "flow" }),
			}),
			[FlowRouteType.Sub]: t("flow.emptyTips", {
				title: t("common.noArguments"),
			}),
			[FlowRouteType.Mcp]: t("flow.emptyTips", {
				title: t("common.tools", { ns: "flow" }),
			}),
		}
		// @ts-ignore
		return emptyTipsMap[flowType]
	}, [flowType, t])

	return (
		<Flex vertical gap={10} className={styles.container}>
			<Flex vertical className={styles.top} gap={10}>
				<Flex justify="space-between" align="center" gap={8}>
					{data?.icon ? (
						<MagicAvatar style={{ borderRadius: 8 }} src={data?.icon} size={50}>
							{data?.name}
						</MagicAvatar>
					) : (
						defaultAvatar
					)}
					<Flex justify="flex-start" align="center" flex={1} gap={8}>
						<div className={styles.title}>{data?.name}</div>
						{hasEditRight(data.user_operation) && (
							<MagicIcon
								component={IconEdit}
								size={16}
								style={{ cursor: "pointer", flexShrink: 0 }}
								onClick={openAddOrUpdateFlow}
							/>
						)}
					</Flex>
					<MagicButton
						icon={<MagicIcon component={IconX} size={24} />}
						type="text"
						className={styles.close}
						onClick={handleInnerClose}
					/>
				</Flex>
				<div className={styles.desc}>{data?.description}</div>
			</Flex>
			<Flex justify="space-between" align="center" wrap style={{ width: "100%" }} gap={8}>
				{buttons.map((btn) => btn)}
			</Flex>
			{drawerItems.length === 0 && (
				<Flex vertical gap={4} align="center" justify="center" flex={1}>
					<Flex align="center" justify="center">
						<Avatar
							// @ts-ignore
							src={
								flowType === FlowRouteType.Tools ? ToolsEmptyImage : FlowEmptyImage
							}
							size={140}
						/>
					</Flex>
					<div className={styles.emptyTips}>{emptyTips}</div>
				</Flex>
			)}
			{drawerItems.length !== 0 && (
				<Flex vertical>
					<div className={styles.subTitle}>{subTitle}</div>
					<Flex vertical gap={10} className={styles.drawerContainer}>
						{drawerItems.map((item) => (
							<ToolCard
								key={item.id}
								data={data}
								item={item}
								isTools={isTools}
								handleGoToFlow={handleGoToFlow}
								hasEditRight={hasEditRight}
								handlerInnerUpdateEnable={handlerInnerUpdateEnable}
								getDropdownItems={getDropdownItems}
								flowType={flowType}
							/>
						))}
					</Flex>
				</Flex>
			)}
			<BindOpenApiAccount
				open={bindOpenApiAccountOpen}
				onClose={closeBindOpenApiAccount}
				flowId={data.id!}
			/>
			<KeyManagerButton
				open={keyManagerOpen}
				onClose={closeKeyManager}
				flowId={data.id!}
				isAgent={false}
				type={flowTypeToApiKeyType[flowType]}
			/>
		</Flex>
	)
}
export default memo(RightDrawer)
