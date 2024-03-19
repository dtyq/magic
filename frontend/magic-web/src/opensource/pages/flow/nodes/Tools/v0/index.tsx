import DropdownCard from "@dtyq/magic-flow/dist/common/BaseUI/DropdownCard"
import { useMemo } from "react"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import { Form, Switch, Flex, Select, Tooltip } from "antd"
import MagicJSONSchemaEditorWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicJsonSchemaEditorWrap"
import { DisabledField } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { IconHelp } from "@tabler/icons-react"
import { get, set } from "lodash-es"
import { useMemoizedFn, useMount } from "ahooks"
import { useFlowStore } from "@/opensource/stores/flow"
import { useNodeConfigActions } from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import usePrevious from "@/opensource/pages/flow/common/hooks/usePrevious"
import useToolsParameters from "@/opensource/pages/flow/components/ToolsSelect/components/ToolsSelectedCard/ToolsParameters/hooks/useToolsParameters"
import useCurrentNodeUpdate from "@/opensource/pages/flow/common/hooks/useCurrentNodeUpdate"
import NodeOutputWrap from "@/opensource/pages/flow/components/NodeOutputWrap/NodeOutputWrap"
import MagicExpression from "@/opensource/pages/flow/common/Expression"
import llmStyles from "@/opensource/pages/flow/nodes/LLM/v0/index.module.less"
import RenderLabelCommon from "@/opensource/pages/flow/components/RenderLabel/RenderLabel"
import { useTranslation } from "react-i18next"
import { findTargetTool } from "@/opensource/pages/flow/utils/helpers"
import { FlowRouteType } from "@/opensource/types/flow"
import { FlowApi } from "@/opensource/apis"
import styles from "./index.module.less"
import ModeSelect, { ToolsMode } from "./components/ModeSelect/ModeSelect"
import useParameterHandler from "../../LLM/v0/hooks/useParameterHandler"
import LLMParametersV0 from "../../LLM/v0/components/LLMParameters"
import { v0Template } from "./template"
import { getRoutePath } from "@/opensource/routes/history/helpers"
import { RouteName } from "@/opensource/routes/constants"

export default function ToolsV0() {
	const { t } = useTranslation()
	const { currentNode } = useCurrentNode()

	const [form] = Form.useForm()
	const { updateNodeConfig } = useNodeConfigActions()

	const { expressionDataSource } = usePrevious()

	const { useableToolSets, updateToolInputOutputMap, toolInputOutputMap } = useFlowStore()

	const { asyncCall } = useToolsParameters()

	// 处理直接从左侧物料面板工具出来时
	useMount(() => {
		if (!currentNode) return
		const toolId = get(currentNode, ["params", "tool_id"])
		const toolOutput = get(currentNode, ["output"])
		if (toolId && !toolOutput) {
			FlowApi.getAvailableTools([toolId]).then((toolResponse) => {
				const tool = toolResponse?.list?.[0]
				const toolDetail = findTargetTool(toolId)
				if (toolDetail) {
					set(currentNode, ["params", "avatar"], toolDetail.icon)
					set(currentNode, ["output"], tool?.output)

					set(currentNode, ["input"], tool?.input)
					set(currentNode, ["params", "custom_system_input"], tool?.custom_system_input)
					form.setFieldsValue({
						input: null,
						custom_system_input: null,
					})
					form.setFieldsValue({
						input: tool?.input,
						custom_system_input: tool?.custom_system_input,
					})
					updateNodeConfig({ ...currentNode })
				}
			})
		}
	})

	const toolOptions = useMemo(() => {
		const resultTools: any[] = []
		useableToolSets.forEach((toolSet) => {
			return toolSet.tools.forEach((tool) => {
				resultTools.push({
					label: (
						<RenderLabelCommon
							name={tool.name}
							url={`${getRoutePath({
								name: RouteName.FlowDetail,
								params: {
									id: tool.code as string,
									type: FlowRouteType.Tools,
								},
							})}`}
						/>
					),
					value: tool.code,
					realLabel: tool.name,
					input: tool.input,
					output: tool.output,
					custom_system_input: tool.custom_system_input,
				})
			})
		})
		return resultTools
	}, [useableToolSets])

	const initialValues = useMemo(() => {
		return {
			...{ ...v0Template.params, ...currentNode?.params },
			input: currentNode?.input,
			output: currentNode?.output,
			custom_system_input: currentNode?.params?.custom_system_input,
		}
	}, [currentNode?.input, currentNode?.output, currentNode?.params])

	const { handleModelConfigChange } = useParameterHandler()

	const onValuesChange = useMemoizedFn(async (changeValues) => {
		if (!currentNode) return
		if (changeValues.model_config) {
			handleModelConfigChange(changeValues)
		} else if (Reflect.has(changeValues, "tool_id")) {
			const toolId = changeValues.tool_id
			const cacheDetail = toolInputOutputMap?.[toolId]
			const toolsDetail = cacheDetail
				? { list: [cacheDetail] }
				: await FlowApi.getAvailableTools([toolId])
			if (toolsDetail.list.length > 0) {
				const targetToolDetail = toolsDetail.list[0]
				updateToolInputOutputMap({
					...toolInputOutputMap,
					[toolId]: targetToolDetail,
				})
				set(currentNode, ["output"], targetToolDetail.output)
				set(currentNode, ["input"], targetToolDetail.input)
				set(
					currentNode,
					["params", "custom_system_input"],
					targetToolDetail.custom_system_input,
				)
				set(currentNode, ["params", "tool_id"], toolId)
				set(currentNode, ["params", "avatar"], targetToolDetail.icon)
				// 需要先重置，避免缓存数据
				form.setFieldsValue({
					input: null,
					custom_system_input: null,
				})
				form.setFieldsValue({
					input: targetToolDetail.input,
					custom_system_input: targetToolDetail.custom_system_input,
				})
			}
		} else if (changeValues.input) {
			set(currentNode, ["input"], changeValues.input)
		} else {
			Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
				set(currentNode, ["params", changeKey], changeValue)
			})
		}
		updateNodeConfig({ ...currentNode })
	})

	useCurrentNodeUpdate({
		form,
		initialValues,
	})

	return (
		<NodeOutputWrap>
			<Form
				form={form}
				initialValues={initialValues}
				className={styles.tools}
				layout="vertical"
				onValuesChange={onValuesChange}
			>
				<Form.Item
					name="tool_id"
					className={styles.select}
					label={t("tools.selectTools", { ns: "flow" })}
				>
					<Select
						options={toolOptions}
						style={{ width: "100%" }}
						popupClassName="nowheel"
						className="nodrag"
						getPopupContainer={(triggerNode) => triggerNode.parentNode}
						labelRender={(props: any) => {
							if (!props.value) return undefined
							if (!props.label) {
								return (
									<RenderLabelCommon
										name={t("tools.invalidTools", { ns: "flow" })}
										url={`${getRoutePath({
											name: RouteName.FlowDetail,
											params: {
												id: props.value as string,
												type: FlowRouteType.Tools,
											},
										})}`}
										danger
									/>
								)
							}
							return props.label
						}}
						showSearch
						// 搜索key
						optionFilterProp="realLabel"
						// 排序
						filterSort={(optionA, optionB) => {
							return (optionA?.realLabel ?? "")
								.toLowerCase()
								.localeCompare((optionB?.realLabel ?? "").toLowerCase())
						}}
					/>
				</Form.Item>
				<Form.Item
					name="mode"
					label={t("tools.mode", { ns: "flow" })}
					className={styles.formItem}
				>
					<ModeSelect />
				</Form.Item>
				<div className={styles.input}>
					<DropdownCard
						title={t("common.customSystemInput", { ns: "flow" })}
						height="auto"
					>
						<Form.Item name={["custom_system_input", "form"]}>
							<MagicJSONSchemaEditorWrap
								allowExpression
								expressionSource={expressionDataSource}
								displayColumns={[
									ShowColumns.Key,
									// ShowColumns.Type,
									ShowColumns.Value,
									ShowColumns.Required,
								]}
								showImport={false}
								disableFields={[
									DisabledField.Name,
									DisabledField.Type,
									DisabledField.Required,
								]}
								allowAdd={false}
								oneChildAtLeast={false}
								showAdd={false}
								allowOperation={false}
							/>
						</Form.Item>
					</DropdownCard>
					<Flex className={styles.parameters} align="center">
						<div className={styles.left}>
							<span className={styles.title}>{asyncCall.label}</span>
							<Tooltip title={asyncCall.tooltips}>
								<IconHelp size={16} color="#1C1D2399" className={styles.icon} />
							</Tooltip>
						</div>
						<Form.Item name={["async"]} valuePropName="checked">
							<Switch />
						</Form.Item>
					</Flex>
				</div>
				{currentNode?.params?.mode === ToolsMode.LLM && (
					<>
						<div className={styles.llmSelect}>
							<LLMParametersV0 />
						</div>
						<div className={llmStyles.inputBody} style={{ borderBottom: "none" }}>
							<DropdownCard
								title={t("common.prompt", { ns: "flow" })}
								headerClassWrapper={llmStyles.promptWrapper}
								height="auto"
							>
								<MagicExpression
									label="User"
									name="user_prompt"
									placeholder={t("common.allowExpressionPlaceholder", {
										ns: "flow",
									})}
									className={llmStyles.LLMInput}
									dataSource={expressionDataSource}
								/>
							</DropdownCard>
						</div>
					</>
				)}

				{currentNode?.params?.mode === ToolsMode.Parameter && (
					<div className={styles.input} style={{ borderBottom: "none" }}>
						<DropdownCard title={t("common.input", { ns: "flow" })} height="auto">
							<Form.Item name={["input", "form"]}>
								<MagicJSONSchemaEditorWrap
									allowExpression
									expressionSource={expressionDataSource}
									displayColumns={[
										ShowColumns.Key,
										// ShowColumns.Type,
										ShowColumns.Value,
										ShowColumns.Required,
									]}
									showImport={false}
									disableFields={[
										DisabledField.Name,
										DisabledField.Type,
										DisabledField.Required,
									]}
									allowAdd={false}
									oneChildAtLeast={false}
									showAdd={false}
									allowOperation={false}
								/>
							</Form.Item>
						</DropdownCard>
					</div>
				)}
			</Form>
		</NodeOutputWrap>
	)
}
