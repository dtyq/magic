import { TabObject } from "@/MagicFlow/components/FlowMaterialPanel/constants"
import {
	installNodes,
	registerBranchNodes,
	registerCanReferenceNodeTypes,
	registerLoopBodyType,
	registerLoopNodeType,
	registerLoopStartConfig,
	registerLoopStartType,
	registerMaterialNodeTypeMap,
	registerNodeGroups,
	registerNodeType2ReferenceKey,
	registerStartNodeType,
	registerVariableNodeTypes,
} from "@/MagicFlow/register/node"
import { IconArrowLeftFromArc } from "@tabler/icons-react"
import React from "react"
import { customNodeType } from "../constants"
import { generateNodeVersionSchema } from "./version"

export const installAllNodes = () => {
	/**
	 * 注册分支节点，为了走分支相关的路径，next_nodes会加在branches里面
	 */
	registerBranchNodes([
		customNodeType.Start,
		customNodeType.If,
		customNodeType.IntentionRecognition,
	])

	/**
	 * 注册可饮用类型节点，计算上文节点可引用数据源时，会以此为依据：
	 *  不在此列的，不做为可以引用类型的节点
	 */
	registerCanReferenceNodeTypes([
		customNodeType.Start,
		customNodeType.Code,
		customNodeType.LLM,
		customNodeType.Variable,
		customNodeType.Loader,
		// TODO Vertor可以引用什么
		customNodeType.Vector,
		customNodeType.HTTP,
		customNodeType.Sub,
		customNodeType.Knowledge,
		customNodeType.Tools,
	])

	/** 指定引用大语言模型时，不再是node_id.value  而是LLM.value */
	registerNodeType2ReferenceKey({
		[customNodeType.VariableSave]: "variables",
	})

	/** 指定引用大语言模型时，不再是node_id.value  而是LLM.value */
	registerVariableNodeTypes([customNodeType.VariableSave])

	/** 指定开始节点时，空白画布默认会新增一个开始节点 */
	registerStartNodeType(customNodeType.Start)

	/** 指定循环节点，会默认携带一个循环体 */
	registerLoopNodeType(customNodeType.Loop)

	/** 指定循环体类型 */
	registerLoopBodyType(customNodeType.LoopBody)

	/** 指定循环起始节点类型 */
	registerLoopStartType(customNodeType.Start)

	/** 注册循环起始节点配置 */
	registerLoopStartConfig({
		height: 128,
	})

	/** 注册节点分组信息 */
	registerNodeGroups([
		{
			groupName: "基础",
			desc: "",
			nodeTypes: [
				customNodeType.Start,
				customNodeType.Code,
				customNodeType.Variable,
				customNodeType.SearchUsers,
				customNodeType.Tools,
				customNodeType.Sub,
				customNodeType.Loop,
			],
		},

		{
			groupName: "数据处理",
			desc: "",
			nodeTypes: [
				customNodeType.Vector,
				customNodeType.HTTP,
				customNodeType.Knowledge,
				customNodeType.LLM,
				customNodeType.If,
			],
			children: [
				{
					groupName: "多维表格",
					desc: "",
					color: "#32C436",
					icon: <IconArrowLeftFromArc color="#fff" stroke={2} size={18} />,
					nodeTypes: [customNodeType.LLM, customNodeType.Tools, customNodeType.If],
				},
			],
		},
	])

	registerMaterialNodeTypeMap({
		[TabObject.Tools]: customNodeType.Tools,
		[TabObject.Flow]: customNodeType.Sub,
		[TabObject.Agent]: customNodeType.Agent,
	})

	/**
	 * 注册所有节点schema
	 */
	// @ts-ignore
	installNodes(generateNodeVersionSchema())
}
