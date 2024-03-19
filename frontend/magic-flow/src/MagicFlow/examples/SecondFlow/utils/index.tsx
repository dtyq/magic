import { installNodes } from "@/MagicFlow/register/node"
import { nodeSchemaMap } from "../constants"

export const installAllNodes = () => {
	// registerNotMaterialNodeTypes([customNodeType.Start])
	/**
	 * 注册所有节点schema
	 */
	// @ts-ignore
	installNodes(nodeSchemaMap)
}
