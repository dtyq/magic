import { useNodeConfigActions } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { ShowColumns } from "@/MagicJsonSchemaEditor/constants"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import DropdownCard from "@/common/BaseUI/DropdownCard"
import JSONSchemaRenderer from "@/common/BaseUI/JSONSchemaRenderer"
import MagicSelect from "@/common/BaseUI/Select"
import { MagicJsonSchemaEditor } from "@/index"
import { Form } from "antd"
import { useMemoizedFn, useMount, useUpdateEffect } from "ahooks"
import _ from "lodash"
import React, { useMemo, useState } from "react"
import usePrevious from "../../../common/hooks/usePrevious"
import { customNodeType, templateMap } from "../../../constants"
import { mockFlowList } from "../../../mock/flowList"
import styles from "./index.module.less"

export default function SubFlowV1() {
	const [form] = Form.useForm()
	const { currentNode } = useCurrentNode()
	const [input, setInput] = useState<Schema>()
	const { updateNodeConfig } = useNodeConfigActions()

	const { expressionDataSource } = usePrevious()

	const subFlowOptions = useMemo(() => {
		return mockFlowList.map((flow) => {
			return {
				label: flow.name,
				value: flow.id,
				realLabel: flow.name,
			}
		})
	}, [])

	/** 上游同步下游 */
	useMount(() => {
		const serverInput = _.get(currentNode, ["input", "form", "structure"])
		setInput(serverInput)
	})

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode) return
		if (changeValues.sub_flow_id) {
			const targetFlow = mockFlowList.find((flow) => flow.id === changeValues.sub_flow_id)
			_.set(currentNode, ["name"], targetFlow?.name)
			_.set(currentNode, ["params", "sub_flow_id"], changeValues.sub_flow_id)
			_.set(currentNode, ["params", "avatar"], targetFlow?.icon)
			// _.set(currentNode, ["output"], targetFlow?.output)
			// _.set(currentNode, ["input"], targetFlow?.input)
		}
		updateNodeConfig({ ...currentNode })
	})

	/** input更新时同步到节点 */
	useUpdateEffect(() => {
		if (!currentNode) return
		_.set(currentNode, ["input", "form", "structure"], input)
		const subFlowId = _.get(currentNode, ["params", "sub_flow_id"])
		form.setFieldsValue({
			sub_flow_id: subFlowId,
		})
	}, [input])

	const initialValues = useMemo(() => {
		return {
			input: currentNode?.input || templateMap[customNodeType.Sub].v1.input,
			output: currentNode?.output || templateMap[customNodeType.Sub].v1.output,
			...{ ...templateMap[customNodeType.Sub].v1.params, ...currentNode?.params },
		}
	}, [currentNode?.input, currentNode?.output, currentNode?.params])

	return (
		<Form
			form={form}
			className={styles.subFlow}
			layout="vertical"
			onValuesChange={onValuesChange}
			initialValues={initialValues}
		>
			<Form.Item name="sub_flow_id" className={styles.select} label="选择子流程">
				<MagicSelect
					options={subFlowOptions}
					style={{ width: "100%" }}
					popupClassName="nowheel"
					className="nodrag"
					showSearch
				/>
			</Form.Item>
			<div className={styles.input}>
				<DropdownCard title="输入" height="auto">
					<MagicJsonSchemaEditor
						data={input}
						onChange={setInput}
						allowExpression
						expressionSource={expressionDataSource}
						displayColumns={[ShowColumns.Key, ShowColumns.Value, ShowColumns.Type]}
						columnNames={{
							[ShowColumns.Key]: "变量名",
							[ShowColumns.Type]: "变量类型",
							[ShowColumns.Value]: "变量值",
							[ShowColumns.Label]: "显示名称",
							[ShowColumns.Description]: "变量描述",
							[ShowColumns.Encryption]: "是否加密",
							[ShowColumns.Required]: "必填",
						}}
					/>
				</DropdownCard>
			</div>

			<div className={styles.output}>
				<DropdownCard title="输出" height="auto">
					{/* @ts-ignore */}
					<JSONSchemaRenderer form={currentNode?.output?.form?.structure} />
				</DropdownCard>
			</div>
		</Form>
	)
}
