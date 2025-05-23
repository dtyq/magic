import type { FormInstance } from "antd"
import { Form, Flex } from "antd"
import { useTranslation } from "react-i18next"
import { useFlowStore } from "@/opensource/stores/flow"
import { FlowApi } from "@/apis"
import styles from "@/opensource/pages/flow/components/ToolsSelect/ToolSelect.module.less"
import useToolsPanel from "@/opensource/pages/flow/components/ToolsSelect/hooks/useToolsPanelVisible"
import ToolsPanel from "@/opensource/pages/flow/components/ToolsSelect/components/ToolsPanel/ToolsPanel"
import { ToolSelectedItem } from "@/opensource/pages/flow/components/ToolsSelect/types"

type ToolsSelectProps = {
	form: FormInstance<any>
	AddToolButtonComponent: React.FC<{ onClick: () => void }>
	showLabel?: boolean
	className?: string
	addFn: (tool: ToolSelectedItem) => void
	selectedTools?: ToolSelectedItem[]
}

export default function McpToolSelect({
	AddToolButtonComponent,
	showLabel = true,
	className,
	addFn,
	selectedTools,
}: ToolsSelectProps) {
	const { toolInputOutputMap, updateToolInputOutputMap } = useFlowStore()

	const { t } = useTranslation()
	// const { updateNodeConfig } = useFlow()
	const { openToolsPanel, isToolsPanelOpen, closeToolsPanel } = useToolsPanel()

	return (
		<Form.Item
			className={className ? className : styles.toolsSelect}
			label={showLabel ? t("common.tools", { ns: "flow" }) : ""}
		>
			<Form.List name="option_tools">
				{() => {
					return (
						<Flex className={styles.toolsWrap} vertical gap={6} justify="center">
							<AddToolButtonComponent onClick={openToolsPanel} />
							<ToolsPanel
								open={isToolsPanelOpen}
								onClose={closeToolsPanel}
								onAddTool={async (tool) => {
									addFn(tool)

									// 更新inputOutput的map
									const response = await FlowApi.getAvailableTools([tool.tool_id])
									if (response.list.length > 0) {
										const targetTool = response.list[0]
										updateToolInputOutputMap({
											...toolInputOutputMap,
											[tool.tool_id]: targetTool,
										})
									}
								}}
								selectedTools={selectedTools}
							/>
						</Flex>
					)
				}}
			</Form.List>
		</Form.Item>
	)
}
