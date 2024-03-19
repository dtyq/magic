import { FormItemType } from "@/MagicExpressionWidget/types"
import { nodeManager } from "@/MagicFlow"
import i18next from "i18next"


/** 获取bool值的常量引用 */
export const getDefaultBooleanConstantSource = () => {

	const variableNodeType = nodeManager.variableNodeTypes?.[0]

	return [{
		"title": i18next.t("common.constants", { ns: "magicFlow" }),
		"key": "",
		"nodeId": "Wrapper",
		"nodeType": variableNodeType,
		"type": "",
		"isRoot": true,
		"children": [
			{
				"title": i18next.t("common.real", { ns: "magicFlow" }),
				"key": "true",
				"nodeId": "",
				"nodeType": variableNodeType,
				"type": FormItemType.Boolean,
				"isRoot": false,
				"children": [],
				"isConstant": true
			},
			{
				"title": i18next.t("common.artifact", { ns: "magicFlow" }),
				"key": "false",
				"nodeId": "",
				"nodeType": variableNodeType,
				"type": FormItemType.Boolean,
				"isRoot": false,
				"children": [],
				"isConstant": true
			}
		]
	}]
}


