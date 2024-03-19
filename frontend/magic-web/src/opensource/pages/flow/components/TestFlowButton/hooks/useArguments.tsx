/**
 * 参数调用相关的状态
 */

import { customNodeType } from "@/opensource/pages/flow/constants"
import { TriggerType } from "@/opensource/pages/flow/nodes/Start/v0/constants"
import type { MutableRefObject } from "react"
import { useEffect, useMemo, useState } from "react"
import type { FormInstance } from "antd"
import { Form } from "antd"
import { getComponent } from "@/opensource/pages/flow/utils/helpers"
import type { FormItemType } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { FlowType } from "@/opensource/types/flow"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { MagicFlowInstance } from "@dtyq/magic-flow/dist/MagicFlow"
import { transformSchemaToDynamicFormItem } from "../helpers"

export type DynamicFormItem = {
	label: string
	type: string
	key: string
	required: boolean
}

type UseArgumentsProps = {
	open: boolean
	form: FormInstance
	flow?: MagicFlow.Flow
	onValuesChange: (this: any, changeValues: any) => void
	flowInstance: MutableRefObject<MagicFlowInstance | null>
}

export default function useArguments({
	open,
	form,
	flow,
	flowInstance,
	onValuesChange,
}: UseArgumentsProps) {
	const [dynamicFormItems, setDynamicFormItems] = useState([] as DynamicFormItem[])

	const isArgumentsFlow = useMemo(() => {
		// @ts-ignore
		return flow?.type === FlowType.Sub || flow?.type === FlowType.Tools
	}, [flow])

	useEffect(() => {
		if (isArgumentsFlow && open) {
			const latestFlow = flowInstance?.current?.getFlow?.()
			const startNode = latestFlow?.nodes?.find?.(
				(n: MagicFlow.Node) => `${n.node_type}` === customNodeType.Start,
			)
			const argumentsBranch = startNode?.params?.branches?.find?.(
				// @ts-ignore
				(branch) => branch.trigger_type === TriggerType.Arguments,
			)

			// 处理 output
			const outputSchema = argumentsBranch?.output?.form?.structure
			const outputDynamicItems = transformSchemaToDynamicFormItem(outputSchema!)

			// 处理 custom_system_output
			// @ts-ignore
			const customSystemOutputSchema = argumentsBranch?.custom_system_output?.form?.structure
			const customSystemOutputDynamicItems = transformSchemaToDynamicFormItem(
				customSystemOutputSchema!,
			)

			// 合并两部分动态表单项
			const combinedDynamicItems = [...outputDynamicItems, ...customSystemOutputDynamicItems]
			setDynamicFormItems(combinedDynamicItems)
		}
	}, [open, isArgumentsFlow, flowInstance])

	const DynamicFormItemComponents = useMemo(() => {
		return dynamicFormItems.map((field) => {
			return (
				<Form.Item
					name={["trigger_data", field.key]}
					label={field.label}
					required={field.required}
					rules={[{ required: true }]}
					key={field.key}
				>
					{getComponent(field.type as FormItemType)}
				</Form.Item>
			)
		})
	}, [dynamicFormItems])

	useEffect(() => {
		if (isArgumentsFlow && open) {
			form?.setFieldsValue?.({
				trigger_type: TriggerType.Arguments,
			})
			// 手动触发 onValuesChange
			onValuesChange({
				trigger_type: TriggerType.Arguments,
			})
		}
	}, [flow, form, isArgumentsFlow, onValuesChange, open])

	return {
		DynamicFormItemComponents,
		isArgumentsFlow,
		dynamicFormItems,
	}
}
