import { NodeSchema, NodeWidget } from "@/MagicFlow/register/node"
import { IconArrowLeftFromArc, IconArrowsSplit2, IconBrain, IconRepeat, IconRepeatOff, IconTimeline, IconVariable } from "@tabler/icons-react"
import _ from "lodash"
import React from "react"
import { customNodeType, templateMap } from "../constants"
import { nodeComponentVersionMap } from "../nodes"

const commonSchemaConfigMap: Record<string, NodeSchema> = {
	[customNodeType.Start]: {
		label: "开始节点",
		icon: <IconArrowLeftFromArc color="#fff" stroke={2} size={18} />,
		color: "#315CEC",
		id: customNodeType.Start,
		desc: "当以下事件被触发时，流程将会从这个模块开始执行",
		handle: {
			withSourceHandle: false,
			withTargetHandle: false,
		},
		changeable: {
			nodeType: false,
			operation: true,
		},
		style: {
			width: "480px",
		},
	},
	[customNodeType.Sub]: {
		label: "子流程",
		icon: <IconTimeline color="#fff" stroke={1} size={18} />,
		color: "#9DC900",
		id: customNodeType.Sub,
		desc: "可以将部分功能模块分配给子流程来进行编排，从而避免主流程过于庞大",
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "800px",
		},
	},
	[customNodeType.VariableSave]: {
		label: "变量保存",
		icon: <IconVariable color="#fff" stroke={1} size={18} />,
		color: "#FFC900",
		id: customNodeType.VariableSave,
		desc: "新增变量，并对变量进行赋值",
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "900px",
		},
	},
	[customNodeType.LLM]: {
		label: "AI 聊天",
		icon: <IconBrain color="#fff" stroke={1} size={18} />,
		color: "#00A8FF",
		id: customNodeType.LLM,
		desc: "调用大语言模型，使用变量和提示词生成回复",
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},
	[customNodeType.Tools]: {
		label: "工具",
		icon: <IconTimeline color="#fff" stroke={1} size={18} />,
		color: "#555761",
		id: customNodeType.Tools,
		desc: "工具",
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},

	[customNodeType.Loop]: {
		label: "循环",
		icon: <IconRepeat color="#fff" stroke={1} size={18} />,
		color: "#A61CCB",
		id: customNodeType.Loop,
		desc: "循环",
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "800px",
		},
	},
	[customNodeType.LoopEnd]: {
		label: "循环结束",
		icon: <IconRepeatOff color="#fff" stroke={1} size={18} />,
		color: "#7885ff",
		id: customNodeType.LoopEnd,
		desc: "循环结束",
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "480px",
		},
		addable: false,
	},

	[customNodeType.LoopBody]: {
		label: "循环体",
		icon: <IconRepeatOff color="#fff" stroke={1} size={18} />,
		color: "#7885ff",
		id: customNodeType.LoopBody,
		desc: "循环体",
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "480px",
		},
		addable: false,
	},

	[customNodeType.If]: {
		label: "选择器",
		icon: <IconArrowsSplit2 color="#fff" stroke={1} size={18} />,
		color: "#FFA400",
		id: customNodeType.If,
		desc: "",
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "900px",
		},
	},
}

type Version = string

export const generateNodeVersionSchema = () => {
	const versionTemplate = Object.entries(templateMap).reduce(
		(accVersionTemplate, [nodeType, versionMap]) => {
			return {
				[nodeType]: Object.entries(versionMap).reduce(
					(versionTemplate, [version, nodeSchema]) => {
						/** 需要进行版本化的配置 */
                        // @ts-ignore
						const versionConfig = _.pick(nodeSchema as NodeSchema, [
							"input",
							"output",
							"params",
						])
						/** 拿到具体版本的组件 */
						const versionComp = _.get(nodeComponentVersionMap, [nodeType, version])
						versionTemplate[version] = {
							schema: {
								...commonSchemaConfigMap[nodeType],
								...versionConfig,
							},
							component: versionComp,
						}
						return versionTemplate
					},
					{} as Record<Version, NodeWidget>,
				),
				...accVersionTemplate,
			}
		},
		{},
	)
	console.log("versionTemplate", versionTemplate)
	return versionTemplate
}
