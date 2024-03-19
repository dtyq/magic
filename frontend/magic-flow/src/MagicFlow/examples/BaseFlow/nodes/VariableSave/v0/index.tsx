import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { ShowColumns } from "@/MagicJsonSchemaEditor/constants"
import MagicJSONSchemaEditorWrap from "@/common/BaseUI/MagicJsonSchemaEditorWrap"
import { Form } from "antd"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import React, { useMemo } from "react"
import usePrevious from "../../../common/hooks/usePrevious"
import styles from "./index.module.less"

export default function VariableSaveV0() {
	const [form] = Form.useForm()
	const { nodeConfig, updateNodeConfig } = useFlow()

	const { currentNode } = useCurrentNode()

	const { expressionDataSource } = usePrevious()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode || !nodeConfig || !nodeConfig[currentNode?.node_id]) return
		const currentNodeConfig = nodeConfig[currentNode?.node_id]

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			_.set(currentNodeConfig, ["params", changeKey], changeValue)
		})

		updateNodeConfig({
			...currentNodeConfig,
		})
	})

	const initialValues = useMemo(() => {
		return currentNode?.params
	}, [currentNode])

	return (
		<div className={styles.variableWrapper}>
			<Form
				form={form}
				initialValues={initialValues}
				layout="vertical"
				onValuesChange={onValuesChange}
			>
				<Form.Item name={["variables", "form"]}>
					<MagicJSONSchemaEditorWrap
						allowExpression
						expressionSource={expressionDataSource}
						displayColumns={[
							ShowColumns.Key,
							ShowColumns.Label,
							ShowColumns.Type,
							ShowColumns.Value,
						]}
					/>
				</Form.Item>
			</Form>
		</div>
	)
}
