import { useFlowStore } from "@/opensource/stores/flow"
import type { FormInstance, FormListFieldData } from "antd"
import { Dropdown, Tooltip, Flex } from "antd"
import { useMemo, useRef } from "react"
import DefaultToolAvatar from "@/opensource/assets/logos/tool-avatar.png"
import MagicButton from "@/opensource/components/base/MagicButton"
import { IconAdjustmentsHorizontal, IconHelp, IconWindowMaximize } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { FlowRouteType, type UseableToolSet } from "@/opensource/types/flow"
import { FlowApi } from "@/opensource/apis"
import type { ToolSelectedItem } from "../../types"
import styles from "./ToolSelectedCard.module.less"
import type { ToolAddableCardPopoverRef } from "../ToolsCard/components/ToolAddableCardPopover/ToolAddableCardPopover"
import ToolAddableCardPopover from "../ToolsCard/components/ToolAddableCardPopover/ToolAddableCardPopover"
import ToolsParameters from "./ToolsParameters"
import { getRoutePath } from "@/opensource/routes/history/helpers"
import { RouteName } from "@/opensource/routes/constants"

type ToolsSelectedCardProps = {
	tool: ToolSelectedItem
	field: FormListFieldData
	removeFn: (index: number) => void
	form: FormInstance<any>
	index: number
}
export default function ToolsSelectedCard({
	tool,
	field,
	removeFn,
	form,
	index,
}: ToolsSelectedCardProps) {
	const { t } = useTranslation()
	const { useableToolSets, toolInputOutputMap, updateToolInputOutputMap } = useFlowStore()

	const popoverRef = useRef<ToolAddableCardPopoverRef>(null)

	const targetDetail = useMemo(() => {
		const targetToolSet = useableToolSets.find((toolSet) => toolSet.id === tool.tool_set_id)
		const foundTool = targetToolSet?.tools?.find?.((v) => v.code === tool.tool_id)
		const toolWithInputOutput = toolInputOutputMap?.[foundTool?.code || ""]
		return {
			foundToolSet: targetToolSet,
			foundTool: {
				...foundTool,
				input: toolWithInputOutput?.input,
				output: toolWithInputOutput?.output,
				custom_system_input: toolWithInputOutput?.custom_system_input,
			} as UseableToolSet.UsableTool,
		}
	}, [tool.tool_id, tool.tool_set_id, toolInputOutputMap, useableToolSets])

	const handleSettingsHover = useMemoizedFn(() => {
		popoverRef?.current?.setVisible?.(false)
	})

	const defaultText = useMemo(() => {
		return t("common.invalidTools", { ns: "flow" })
	}, [t])

	const onOpenChange = async (open: boolean) => {
		// 没有自定义输入，则请求一下
		if (open && !tool?.custom_system_input?.form?.structure) {
			// 更新inputOutput的map
			const response = await FlowApi.getAvailableTools([tool.tool_id])
			if (response.list.length > 0) {
				const targetTool = response.list[0]
				updateToolInputOutputMap({
					...toolInputOutputMap,
					[tool.tool_id]: targetTool,
				})
				form.setFieldValue(
					["option_tools", index, "custom_system_input"],
					targetTool.custom_system_input,
				)
			}
		}
	}

	return (
		<Dropdown
			menu={{
				items: [],
			}}
			trigger={["click"]}
			placement="bottomRight"
			dropdownRender={() => <ToolsParameters field={field} />}
			className="nodrag"
			getPopupContainer={(node) => node}
			overlayClassName={styles.overlay}
			onOpenChange={onOpenChange}
		>
			<Flex className={styles.toolsSelectedCard} align="center" justify="space-between">
				<Flex>
					<img
						src={targetDetail?.foundToolSet?.icon || DefaultToolAvatar}
						alt=""
						className={styles.avatar}
					/>
				</Flex>
				<Flex vertical gap={2} flex={1}>
					<Flex className={styles.title} align="center" gap={6}>
						<Tooltip
							title={targetDetail.foundTool?.name || defaultText}
							placement="topLeft"
						>
							{targetDetail.foundTool?.name || defaultText}
						</Tooltip>

						<ToolAddableCardPopover
							avatar={targetDetail?.foundToolSet?.icon || DefaultToolAvatar}
							tool={targetDetail!.foundTool}
							ref={popoverRef}
						>
							<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
						</ToolAddableCardPopover>

						<Tooltip title={t("common.goToTargetTools", { ns: "flow" })}>
							<IconWindowMaximize
								size={16}
								color="#1C1D2399"
								className={styles.icon}
								onClick={(e) => {
									e.stopPropagation()

									window.open(
										getRoutePath({
											name: RouteName.FlowDetail,
											params: {
												id: tool.tool_id,
												type: FlowRouteType.Tools,
											},
										}) as string,
										"_blank",
									)
								}}
							/>
						</Tooltip>
					</Flex>
					{targetDetail.foundTool && (
						<Tooltip title={targetDetail.foundTool?.description} placement="topLeft">
							<div className={styles.desc}>{targetDetail.foundTool?.description}</div>
						</Tooltip>
					)}
				</Flex>
				<Flex align="center" gap={4} onMouseEnter={handleSettingsHover}>
					{targetDetail.foundTool && (
						<div className={styles.settingBtnWrap}>
							<IconAdjustmentsHorizontal
								color="#1C1D23CC"
								className={styles.settingsBtn}
							/>
						</div>
					)}
					<MagicButton
						className={styles.deleteBtn}
						type="default"
						color="danger"
						onClick={(e) => {
							e.stopPropagation()
							removeFn(field.name)
						}}
						theme={false}
					>
						{t("common.delete", { ns: "flow" })}
					</MagicButton>
				</Flex>
			</Flex>
		</Dropdown>
	)
}
