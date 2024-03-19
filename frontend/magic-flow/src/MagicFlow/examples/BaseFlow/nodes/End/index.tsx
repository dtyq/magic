import { FormItemType } from "@/MagicExpressionWidget/types"
import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { Schema } from "@/MagicJsonSchemaEditor/components/editor/genson-js"
import { ShowColumns } from "@/MagicJsonSchemaEditor/constants"
import { MagicJsonSchemaEditor } from "@/index"
import { Form } from "antd"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import React, { useMemo } from "react"
import usePrevious from "../../common/hooks/usePrevious"
import styles from "./index.module.less"

export default function End() {
	const [form] = Form.useForm()
	const { nodeConfig, updateNodeConfig } = useFlow()

	const { currentNode } = useCurrentNode()

	const { expressionDataSource } = usePrevious()

	const onValuesChange = useMemoizedFn((changeValues) => {
		if (!currentNode || !nodeConfig || !nodeConfig[currentNode?.node_id]) return
		const currentNodeConfig = nodeConfig[currentNode?.node_id]

		Object.entries(changeValues).forEach(([changeKey, changeValue]) => {
			if (changeKey === "output") {
				_.set(currentNodeConfig, ["output", "form", "structure"], changeValue as Schema)
				return
			}
			_.set(currentNodeConfig, ["params", changeKey], changeValue)
		})

		updateNodeConfig({
			...currentNodeConfig,
		})
	})

	const initialValues = useMemo(() => {
		return {
			output: currentNode?.output?.form?.structure,
		}
	}, [currentNode?.output?.form?.structure])

	return (
		<div className={styles.endWrapper}>
			<Form
				form={form}
				layout="vertical"
				initialValues={initialValues}
				onValuesChange={onValuesChange}
			>
				<Form.Item name={["output"]} className={styles.output} valuePropName="data">
					<MagicJsonSchemaEditor
						allowExpression
						expressionSource={expressionDataSource}
						displayColumns={[
							ShowColumns.Key,
							ShowColumns.Label,
							ShowColumns.Type,
							ShowColumns.Value,
						]}
						customOptions={{
							root: [FormItemType.Object],
							normal: [FormItemType.Number, FormItemType.String],
						}}
					/>
				</Form.Item>
			</Form>
		</div>
	)
}
