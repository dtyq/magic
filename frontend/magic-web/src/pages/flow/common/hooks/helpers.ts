import { getNodeVersion, schemaToDataSource } from "@dtyq/magic-flow/dist/MagicFlow/utils"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { NodeVersionMap } from "@dtyq/magic-flow/dist/common/context/NodeMap/Context"
import { customNodeType } from "../../constants"

/** 生成循环体内特殊可引用项数据源 */
export const generateLoopItemOptions = (
	loopNode: MagicFlow.Node,
	nodeSchemaMap: NodeVersionMap,
) => {
	const nodeVersion = getNodeVersion(loopNode)
	const loopNodeSchema = nodeSchemaMap[customNodeType.Loop]?.[nodeVersion]?.schema
	const loopOutput = {
		type: "object",
		key: "root",
		sort: 0,
		title: "root节点",
		description: "",
		required: ["item", "index"],
		value: null,
		items: null,
		properties: {
			item: {
				type: "",
				key: "item",
				sort: 0,
				title: "当前项",
				description: "",
				required: null,
				value: null,
				items: null,
				properties: null,
			},
			index: {
				type: "number",
				key: "index",
				sort: 1,
				title: "当前索引",
				description: "",
				required: null,
				value: null,
				items: null,
				properties: null,
			},
		},
	}
	const option = schemaToDataSource(
		{
			...loopNodeSchema,
			type: loopNodeSchema.id,
			id: loopNode.node_id,
			label: loopNode.name as string,
		},
		// @ts-ignore
		loopOutput,
	)

	return option
}

export default {}
