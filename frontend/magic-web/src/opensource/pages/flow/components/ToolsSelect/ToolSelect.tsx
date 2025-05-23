import type { FormInstance } from "antd"
import { Form, Flex } from "antd"
import TSIcon from "@/opensource/components/base/TSIcon"
import { useTranslation } from "react-i18next"
import { useFlowStore } from "@/opensource/stores/flow"
import useFormListRemove from "@/opensource/pages/flow/common/hooks/useFormListRemove"
import { FlowApi } from "@/apis"
import styles from "./ToolSelect.module.less"
import useToolsPanel from "./hooks/useToolsPanelVisible"
import ToolsPanel from "./components/ToolsPanel/ToolsPanel"
import type { ToolSelectedItem } from "./types"
import ToolsSelectedCard from "./components/ToolsSelectedCard/ToolsSelectedCard"

type ToolsSelectProps = {
	form: FormInstance<any>
	AddToolButtonComponent?: React.FC<{ onClick: () => void }>
	showLabel?: boolean
	className?: string
	showSelectedTools?: boolean
}

export default function ToolSelect({
	form,
	AddToolButtonComponent,
	showLabel = true,
	className,
	showSelectedTools = true,
}: ToolsSelectProps) {
	const { removeFormListItem } = useFormListRemove()

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
				{(fields, { add }) => {
					return (
						<Flex className={styles.toolsWrap} vertical gap={6} justify="center">
							{showSelectedTools && (
								<Flex vertical gap={6} className={styles.tools} justify="center">
									{fields.map((field, i) => {
										const tool = form.getFieldValue([
											"option_tools",
											i,
										]) as ToolSelectedItem
										return (
											<ToolsSelectedCard
												key={field.key}
												tool={tool}
												field={field}
												removeFn={(index) =>
													removeFormListItem(
														form,
														["option_tools"],
														Number(index),
													)
												}
												form={form}
												index={i}
											/>
										)
									})}
								</Flex>
							)}
							{AddToolButtonComponent && (
								<AddToolButtonComponent onClick={openToolsPanel} />
							)}
							{!AddToolButtonComponent && (
								<Flex
									className={styles.addToolBtn}
									justify="center"
									align="center"
									gap={4}
									onClick={() => {
										// add()
										openToolsPanel()
									}}
								>
									<TSIcon type="ts-add" />
									{t("common.addTools", { ns: "flow" })}
								</Flex>
							)}
							<ToolsPanel
								open={isToolsPanelOpen}
								onClose={closeToolsPanel}
								onAddTool={async (tool) => {
									add(tool)

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
							/>
						</Flex>
					)
				}}
			</Form.List>
		</Form.Item>
	)
}
