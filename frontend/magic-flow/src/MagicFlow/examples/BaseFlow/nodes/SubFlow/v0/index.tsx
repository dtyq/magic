import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { ShowColumns } from "@/MagicJsonSchemaEditor/constants"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import DropdownCard from "@/common/BaseUI/DropdownCard"
import JSONSchemaRenderer from "@/common/BaseUI/JSONSchemaRenderer"
import { MagicJsonSchemaEditor } from "@/index"
import { Form } from "antd"
import { useMount } from "ahooks"
import _ from "lodash"
import React, { useState } from "react"
import usePrevious from "../../../common/hooks/usePrevious"
import styles from "./index.module.less"

export default function SubFlowV0() {
	const [form] = Form.useForm()
	const { currentNode } = useCurrentNode()
	const [input, setInput] = useState<Schema>()

	const { expressionDataSource } = usePrevious()

	/** 上游同步下游 */
	useMount(() => {
		const serverInput = _.get(currentNode, ["input", "form", "structure"])
		setInput(serverInput)
	})

	return (
		<Form form={form} className={styles.subFlow} layout="vertical">
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
