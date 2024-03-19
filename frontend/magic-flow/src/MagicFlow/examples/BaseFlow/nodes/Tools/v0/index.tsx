import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import MagicSelect from "@/common/BaseUI/Select"
import { Form } from "antd"
import { useMemoizedFn } from "ahooks"
import _ from "lodash"
import React, { useMemo } from "react"
import NodeOutputWrap from "../../../common/NodeOutputWrap/NodeOutputWrap"
import usePrevious from "../../../common/hooks/usePrevious"
import { customNodeType, templateMap } from "../../../constants"
import { mockToolSets } from "../../../mock/toolsets"
import styles from "./index.module.less"

export default function ToolsV0() {
	const { currentNode } = useCurrentNode()

	const [form] = Form.useForm()
	const { updateNodeConfig } = useFlow()

	const { expressionDataSource } = usePrevious()

	const toolOptions = useMemo(() => {
		const resultTools: any[] = []
		mockToolSets.forEach((toolSet) => {
			return toolSet.tools.forEach((tool) => {
				resultTools.push({
					label: tool.name,
					value: tool.code,
					realLabel: tool.name,
				})
			})
		})
		return resultTools
	}, [])

	const initialValues = useMemo(() => {
		const nodeParams = {
			..._.cloneDeep(templateMap[customNodeType.Tools].v0.params),
			...currentNode?.params,
		}
		return {
			...nodeParams,
			input: currentNode?.input,
		}
	}, [currentNode?.input, currentNode?.params])

	const onValuesChange = useMemoizedFn(async (changeValues) => {
		if (!currentNode) return
		updateNodeConfig({ ...currentNode })
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
				<Form.Item name="tool_id" className={styles.select} label="选择工具">
					<MagicSelect options={toolOptions} style={{ width: "100%" }} showSearch />
				</Form.Item>
			</Form>
		</NodeOutputWrap>
	)
}
