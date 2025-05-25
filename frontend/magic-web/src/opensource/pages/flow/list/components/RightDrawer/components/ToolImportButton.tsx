import MagicButton from "@/opensource/components/base/MagicButton"
import { Form } from "antd"
import { useTranslation } from "react-i18next"
import { useStyles } from "./styles"
import { useMemoizedFn, useMount } from "ahooks"
import { FlowApi } from "@/apis"
import { useFlowStore } from "@/opensource/stores/flow"
import { useMemo } from "react"
import { DataType, DrawerItem } from ".."
import McpToolSelect from "./ToolsSelect/ToolsSelect"
import { ToolSelectedItem } from "@/opensource/pages/flow/components/ToolsSelect/types"
import { Flow } from "@/types/flow"

const AddToolButtonComponent = ({ onClick }: { onClick: () => void }) => {
	const { t } = useTranslation()
	const { updateUseableToolSets } = useFlowStore()

	const initUseableToolSets = useMemoizedFn(async () => {
		try {
			const response = await FlowApi.getUseableToolList()
			console.log("FlowApi.getUseableToolList()", response)
			if (response && response.list) {
				updateUseableToolSets(response.list)
			}
		} catch (e) {
			console.log("initUseableToolSets error", e)
		}
	})

	const onClickFn = useMemoizedFn(() => {
		initUseableToolSets()
		onClick()
	})

	return (
		<MagicButton
			key="import-tools"
			type="primary"
			style={{ width: "100%" }}
			onClick={onClickFn}
		>
			{t("mcp.importTools", { ns: "flow" })}
		</MagicButton>
	)
}

export default function ToolImportButton({
	drawerItems,
	data,
	getDrawerItem,
	setCurrentFlow,
}: {
	drawerItems: DrawerItem[]
	data: DataType
	getDrawerItem: () => void
	setCurrentFlow: (flow: DataType) => void
}) {
	const [form] = Form.useForm()
	const { styles } = useStyles()

	const initialValues = useMemo(() => {
		return {
			option_tools: drawerItems.map((item) => {
				const rawData = item.rawData as Flow.Mcp.ListItem
				return {
					tool_id: rawData.rel_code,
					name: rawData.name,
					description: rawData.description,
					tool_set_id: rawData.rel_info?.tool_set_id,
					async: rawData.async,
					custom_system_input: rawData.custom_system_input,
				}
			}),
		}
	}, [drawerItems])

	const addFn = useMemoizedFn(async (tool: ToolSelectedItem) => {
		console.log(tool)
		const formValues = form.getFieldsValue()
		const toolHasAdd = formValues.option_tools.find(
			(item: any) => item.rel_code === tool.tool_id,
		)
		if (!toolHasAdd && data?.id) {
			const newTool = {
				rel_code: tool.tool_id,
				name: tool.name ?? "",
				description: tool.description ?? "",
				enabled: true,
				source: Flow.Mcp.ToolSource.Toolset,
				rel_info: {
					tool_set_id: tool.tool_set_id,
				},
			}
			await FlowApi.saveMcpTool(newTool, data.id)
			const newValues = {
				option_tools: [...formValues.option_tools, newTool],
			}
			form.setFieldsValue(newValues)
			getDrawerItem()
			setCurrentFlow((prev) => {
				return {
					...prev,
					tools_count: (prev as Flow.Mcp.Detail).tools_count + 1,
				}
			})
		}
	})

	return (
		<>
			<Form form={form} initialValues={initialValues} className={styles.form}>
				<McpToolSelect
					form={form}
					AddToolButtonComponent={AddToolButtonComponent}
					showLabel={false}
					className={styles.toolSelect}
					addFn={addFn}
					selectedTools={initialValues.option_tools}
				/>
			</Form>
		</>
	)
}
