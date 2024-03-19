/**
 * 存放各节点单步调试相关的公共方法和状态
 */

import type { ReactNode } from "react"
import { useMemo } from "react"
import type {
	EXPRESSION_VALUE,
	InputExpressionValue,
} from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { FormItemType, LabelTypeMap } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { useBoolean, useMemoizedFn } from "ahooks"
import { Form, Input } from "antd"
import { useForm } from "antd/lib/form/Form"
import { useTranslation } from "react-i18next"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { cloneDeep, merge, uniqBy, get, set } from "lodash-es"
import {
	useFlowData,
	useNodeConfig,
} from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import type { DataSourceOption } from "@dtyq/magic-flow/dist/common/BaseUI/DropdownRenderer/Reference"
import type Schema from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import type { ResolveRule } from "@/opensource/types/flow"
import { ComponentTypes } from "@/opensource/types/flow"
import MagicJSONSchemaEditorWrap from "@dtyq/magic-flow/dist/common/BaseUI/MagicJsonSchemaEditorWrap"
import { ShowColumns } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/constants"
import { DisabledField } from "@dtyq/magic-flow/dist/MagicJsonSchemaEditor/types/Schema"
import { SystemNodeSuffix } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import antdStyles from "@/opensource/pages/flow/index.module.less"
import { cx } from "antd-style"
import MagicModal from "@/opensource/components/base/MagicModal"
import TestNodeBtn from "../TestNodeBtn"
import { useCustomFlow } from "../../context/CustomFlowContext/useCustomFlow"
import styles from "./testNode.module.less"
import {
	findFieldInDataSource,
	genDefaultComponent,
	getDefaultSchemaWithDefaultProps,
} from "../../utils/helpers"

import usePrevious from "./usePrevious"
import { customNodeType } from "../../constants"
import UpgradeVersionBtn from "../UpgradeVersionBtn/UpgradeVersion"

export type Field = {
	key: (string | number)[]
	label: string
	type: FormItemType
	sourceOption: DataSourceOption
}

type UseHeaderRightProps = {
	rules?: ResolveRule[]
	extraComponent?: ReactNode
}

export default function useHeaderRight({ rules, extraComponent }: UseHeaderRightProps) {
	const [form] = useForm()
	const { t } = useTranslation()
	const { currentNode } = useCurrentNode()
	const { nodeConfig } = useNodeConfig()
	const { debuggerMode } = useFlowData()

	const [open, { setTrue, setFalse }] = useBoolean(false)

	const { testNode } = useCustomFlow()

	const { expressionDataSource } = usePrevious()

	// 获取所有引用块(包括固定值和表达式)
	const getAllExpressionLabelFields = useMemoizedFn((expression: InputExpressionValue) => {
		const result = [...(expression?.const_value || []), ...(expression?.expression_value || [])]
		return result.filter((node) => node.type === LabelTypeMap.LabelNode)
	})

	// 通过labelNode获取对应的数据源项
	const getDataSourceOption = useMemoizedFn((labelNode: EXPRESSION_VALUE) => {
		const [nodeId, ...fieldKeys] = labelNode?.value?.split?.(".") || []
		const pickNodeId = nodeId.split(SystemNodeSuffix)?.[0]
		let outputSource = expressionDataSource?.find?.(
			(dataSourceItem: DataSourceOption) => dataSourceItem?.nodeId === pickNodeId,
		)
		if (nodeId === "variables") {
			outputSource = expressionDataSource?.find?.((dataSourceItem: DataSourceOption) => {
				return dataSourceItem?.nodeType === customNodeType.VariableSave
			})
		}
		// console.log("fieldKeys", fieldKeys)

		const foundField = findFieldInDataSource(
			fieldKeys,
			(outputSource?.children || []) as DataSourceOption[],
		)
		return foundField
	})

	// 根据数据源项，生成对应的schema字段
	const generateSchemaFromSource = useMemoizedFn((sourceOption: DataSourceOption) => {
		const { rawSchema } = sourceOption
		const cloneSchema = cloneDeep(rawSchema)
		const mergeSchema = merge({}, cloneSchema, {
			encryption: false,
			encryption_value: null,
		})
		return mergeSchema as Schema
	})

	// 查找schema里面所有的表达式组件值，塞到result
	const searchExpressionFields = useMemoizedFn(
		(
			properties: Record<string, Schema>,
			result = [] as EXPRESSION_VALUE[],
		): EXPRESSION_VALUE[] => {
			Object.values(properties || {}).forEach((schema) => {
				if (schema.type === FormItemType.Object) {
					searchExpressionFields(schema.properties || {}, result)
				}

				result.push(getAllExpressionLabelFields(schema.value))
			})
			return uniqBy(result.flat() as EXPRESSION_VALUE[], "value")
		},
	)

	const generateListOrObjectFields = useMemoizedFn((currentRule, list) => {
		let result = []
		if (currentRule?.type === "expression") {
			result = list.reduce((acc: EXPRESSION_VALUE[], cur: object) => {
				const expressionValue = get(cur, [
					...(currentRule?.subKeys || ""),
				]) as InputExpressionValue
				return [...acc, ...getAllExpressionLabelFields(expressionValue)]
			}, [] as EXPRESSION_VALUE[])
		} else {
			result = list.reduce((acc: EXPRESSION_VALUE[], cur: object) => {
				const schema = get(cur, [...(currentRule?.subKeys || "")]) as Schema
				return [...acc, ...searchExpressionFields(schema?.properties || {})]
			}, [] as EXPRESSION_VALUE[])
		}
		return result
	})

	// 根据解析路径和解析类型对数据源进行动态计算，生成动态的schema
	const generateExpressionSourceForm = useMemoizedFn((resolveRules: ResolveRule[]) => {
		const defaultProps = {
			key: "root",
			title: "root",
		}
		// 普通的引用表单
		const referenceForm = genDefaultComponent(
			ComponentTypes.Form,
			// @ts-ignore
			getDefaultSchemaWithDefaultProps(FormItemType.Object, {
				...defaultProps,
			}),
		)
		// 环境变量的引用表单
		const globalVariableForm = genDefaultComponent(
			ComponentTypes.Form,
			// @ts-ignore
			getDefaultSchemaWithDefaultProps(FormItemType.Object, {
				...defaultProps,
			}),
		)

		resolveRules.forEach((currentRule) => {
			let allReferenceFields = [] as EXPRESSION_VALUE[]
			if (currentRule?.paramsType === "list") {
				const list = get(currentNode, currentRule.path, [])
				allReferenceFields = generateListOrObjectFields(currentRule, list)
			} else if (currentRule?.paramsType === "object") {
				const obj = get(currentNode, currentRule.path, {})
				const list = Object.values(obj) as object[]
				allReferenceFields = generateListOrObjectFields(currentRule, list)
			} else if (currentRule.type === "expression") {
				// 获取当前节点某个表达式组件的值
				const expressionValue = get(currentNode, currentRule.path) as InputExpressionValue
				// 获取当前节点某个表达式值里面的引用块
				allReferenceFields = getAllExpressionLabelFields(expressionValue)
			} else {
				// 获取schema
				const schema = get(currentNode, currentRule.path) as Schema
				// 获取当前节点某个表达式值里面的引用块
				allReferenceFields = searchExpressionFields(schema?.properties || {})
			}

			// 遍历引用块，生成schema字段并设置到对应的schema
			allReferenceFields.forEach((referenceField) => {
				const dataSourceOption = getDataSourceOption(referenceField)
				if (!dataSourceOption) return
				const schemaField = generateSchemaFromSource(dataSourceOption)
				if (schemaField && dataSourceOption.isGlobal) {
					// @ts-ignore
					set(globalVariableForm, ["structure", "properties", schemaField?.key], {
						...schemaField,
						// @ts-ignore
						title: `${schemaField.title || schemaField.key}`,
					})
				}
				if (schemaField && !dataSourceOption.isGlobal) {
					set(
						referenceForm,
						[
							"structure",
							"properties",
							// @ts-ignore
							`${dataSourceOption.nodeId}.${schemaField?.key}`,
						],
						{
							...schemaField,
							// @ts-ignore
							title: `${schemaField.title || schemaField.key}`,
						},
					)
				}
			})
		})

		return {
			referenceForm,
			globalVariableForm,
		}
	})

	const handleOk = useMemoizedFn(() => {
		if (!currentNode || !testNode) {
			return
		}
		const currentNodeConfig = nodeConfig?.[currentNode?.node_id]
		if (!currentNodeConfig) return
		form.validateFields().then((fields) => {
			testNode(currentNodeConfig, fields)
			setFalse()
		})
	})

	const handleCancel = useMemoizedFn(() => {
		setFalse()
	})

	const test = useMemoizedFn(() => {
		const { referenceForm, globalVariableForm } = generateExpressionSourceForm(rules || [])
		form.setFieldsValue({
			trigger_data_form: referenceForm,
			global_variable: globalVariableForm,
		})
		setTrue()
	})

	const showColumns = useMemo(() => {
		return [ShowColumns.Label, ShowColumns.Type, ShowColumns.Value]
	}, [])

	const disabledFields = useMemo(() => {
		return [DisabledField.Title, DisabledField.Type]
	}, [])

	const HeaderRight = useMemo(() => {
		return (
			<>
				{extraComponent}
				{(rules || []).length > 0 && <TestNodeBtn testFn={test} />}
				<UpgradeVersionBtn />

				<MagicModal
					title={t("common.inputArgs", { ns: "flow" })}
					open={open}
					onOk={handleOk}
					onCancel={handleCancel}
					closable
					okText={t("button.confirm", { ns: "interface" })}
					cancelText={t("button.cancel", { ns: "interface" })}
					centered
					className={cx(styles.modal, antdStyles.antdModal)}
					width={1000}
				>
					<Form
						form={form}
						validateMessages={{ required: t("form.required", { ns: "interface" }) }}
						className={styles.form}
						layout="vertical"
					>
						{!debuggerMode && (
							<Form.Item
								name="trigger_data_form"
								label={t("common.referenceArgsSettings", { ns: "flow" })}
							>
								<MagicJSONSchemaEditorWrap
									oneChildAtLeast={false}
									allowExpression={false}
									expressionSource={[]}
									displayColumns={showColumns}
									disableFields={disabledFields}
									columnNames={{
										[ShowColumns.Key]: t("common.variableName", { ns: "flow" }),
										[ShowColumns.Type]: t("common.variableType", {
											ns: "flow",
										}),
										[ShowColumns.Value]: t("common.variableValue", {
											ns: "flow",
										}),
										[ShowColumns.Label]: t("common.showName", { ns: "flow" }),
										[ShowColumns.Encryption]: t("common.encryption", {
											ns: "flow",
										}),
										[ShowColumns.Description]: t("common.variableDesc", {
											ns: "flow",
										}),
										[ShowColumns.Required]: t("common.required", {
											ns: "flow",
										}),
									}}
								/>
							</Form.Item>
						)}

						{!debuggerMode && (
							<Form.Item
								name="global_variable"
								label={t("common.environmentArgsSettings", { ns: "flow" })}
							>
								<MagicJSONSchemaEditorWrap
									oneChildAtLeast={false}
									allowExpression={false}
									expressionSource={[]}
									displayColumns={showColumns}
									disableFields={disabledFields}
									columnNames={{
										[ShowColumns.Key]: t("common.variableName", { ns: "flow" }),
										[ShowColumns.Type]: t("common.variableType", {
											ns: "flow",
										}),
										[ShowColumns.Value]: t("common.variableValue", {
											ns: "flow",
										}),
										[ShowColumns.Label]: t("common.showName", { ns: "flow" }),
										[ShowColumns.Encryption]: t("common.encryption", {
											ns: "flow",
										}),
										[ShowColumns.Description]: t("common.variableDesc", {
											ns: "flow",
										}),
										[ShowColumns.Required]: t("common.required", {
											ns: "flow",
										}),
									}}
								/>
							</Form.Item>
						)}

						{debuggerMode && (
							<Form.Item name="debug_data" label="调试">
								<Input.TextArea
									className={styles.debug}
									placeholder="假设你引用了开始节点.username，AI聊天节点.text,且开始节点id为xxx，AI聊天节点id为yyy，则请输入：
{
	xxx: {
		username: '自定义内容'
	},
	yyy: {
		text: '自定义内容2'
	}
}
									"
								/>
							</Form.Item>
						)}
					</Form>
				</MagicModal>
			</>
		)
	}, [
		debuggerMode,
		disabledFields,
		form,
		handleCancel,
		handleOk,
		open,
		rules,
		showColumns,
		t,
		test,
		extraComponent,
	])

	return {
		HeaderRight,
	}
}
