import {
	installNodes,
	registerBranchNodes,
	registerCanReferenceNodeTypes,
	registerLoopBodyType,
	registerLoopNodeType,
	registerLoopStartType,
	registerNodeType2ReferenceKey,
	registerVariableNodeTypes,
	// @ts-ignore
	registerNodeGroups,
	registerLoopStartConfig,
	registerMaterialNodeTypeMap,
} from "@dtyq/magic-flow/dist/MagicFlow/register/node"
import {
	IconAlignBoxLeftMiddle,
	IconDatabase,
	IconFileTextAi,
	IconHistory,
	IconVariable,
	IconVocabulary,
} from "@tabler/icons-react"
import i18next from "i18next"
import { TabObject } from "@dtyq/magic-flow/dist/MagicFlow/components/FlowMaterialPanel/constants"
import { customNodeType } from "../constants"
import { generateNodeVersionSchema } from "./version"
import { BaseFlowProps } from ".."

export const installAllNodes = (extraData?: BaseFlowProps["extraData"]) => {
	/**
	 * 注册分支节点，为了走分支相关的路径，next_nodes会加在branches里面
	 */
	registerBranchNodes([
		customNodeType.Start,
		customNodeType.If,
		customNodeType.IntentionRecognition,
	])

	/**
	 * 注册可引用的类型节点，计算上文节点可引用数据源时，会以此为依据：
	 *  不在此列的，不做为可以引用类型的节点
	 */
	registerCanReferenceNodeTypes([
		customNodeType.Start,
		customNodeType.Code,
		customNodeType.LLM,
		customNodeType.VariableSave,
		customNodeType.Loader,
		customNodeType.HTTP,
		customNodeType.Sub,
		customNodeType.VectorSearch,
		customNodeType.MessageSearch,
		customNodeType.CacheGetter,
		customNodeType.TextSplit,
		customNodeType.WaitForReply,
		customNodeType.SearchUsers,
		customNodeType.Excel,
		customNodeType.Tools,
		customNodeType.VectorDatabaseMatch,
		customNodeType.Text2Image,
		customNodeType.Instructions,
		customNodeType.KnowledgeSearch,
		...(extraData?.canReferenceNodeTypes || []),
	])

	/** 指定引用大语言模型时，不再是node_id.value  而是LLM.value */
	registerVariableNodeTypes([customNodeType.VariableSave])

	/** 指定引用变量时，不再是[node_id].xxx  而是variable.xxx */
	registerNodeType2ReferenceKey({
		[customNodeType.VariableSave]: "variables",
		[customNodeType.Instructions]: "instructions",
	})

	/** 指定开始节点时，空白画布默认会新增一个开始节点 */
	// registerStartNodeType(customNodeType.Start)

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

	registerNodeGroups([
		{
			groupName: i18next.t("common.base", { ns: "flow" }),
			desc: "",
			nodeTypes: [
				customNodeType.Start,
				customNodeType.End,
				customNodeType.ReplyMessage,
				customNodeType.WaitForReply,
			],
		},

		{
			groupName: i18next.t("common.bigModel", { ns: "flow" }),
			desc: "",
			nodeTypes: [
				customNodeType.LLM,
				// customNodeType.LLMCall,
				customNodeType.IntentionRecognition,
			],
		},

		{
			groupName: i18next.t("common.operation", { ns: "flow" }),
			desc: "",
			nodeTypes: [
				customNodeType.If,
				customNodeType.Code,
				customNodeType.HTTP,
				customNodeType.Tools,
				customNodeType.Sub,
				customNodeType.Loop,
				customNodeType.LoopEnd,
				customNodeType.SearchUsers,
				...(extraData?.extraNodeInfos?.operation ?? []),
				customNodeType.Text2Image,
				customNodeType.GroupChat,
			],
		},

		{
			groupName: i18next.t("common.dataHandler", { ns: "flow" }),
			desc: "",
			nodeTypes: [
				customNodeType.MessageSearch,
				customNodeType.MessageMemory,
				customNodeType.VectorSearch,
			],
			children: [
				{
					groupName: i18next.t("historyMessage.name", { ns: "flow" }),
					desc: i18next.t("historyMessage.desc", { ns: "flow" }),
					icon: <IconHistory color="#fff" stroke={1} size={18} />,
					color: "#6431E5",
					nodeTypes: [customNodeType.MessageSearch, customNodeType.MessageMemory],
				},

				{
					groupName: i18next.t("vectorDatabase.name", { ns: "flow" }),
					desc: i18next.t("vectorDatabase.desc", { ns: "flow" }),
					color: "#007EFF",
					icon: <IconFileTextAi color="#fff" stroke={2} size={18} />,
					nodeTypes: [
						customNodeType.VectorStorage,
						customNodeType.VectorSearch,
						customNodeType.VectorDelete,
						customNodeType.VectorDatabaseMatch,
					],
				},

				{
					groupName: i18next.t("cache.name", { ns: "flow" }),
					desc: i18next.t("cache.desc", { ns: "flow" }),
					color: "#00C1D2",
					icon: <IconDatabase color="#fff" stroke={2} size={18} />,
					nodeTypes: [customNodeType.CacheSetter, customNodeType.CacheGetter],
				},

				{
					groupName: i18next.t("variable.name", { ns: "flow" }),
					desc: i18next.t("variable.desc", { ns: "flow" }),
					color: "#FFC900",
					icon: <IconVariable color="#fff" stroke={2} size={18} />,
					nodeTypes: [customNodeType.VariableSave],
				},

				...(extraData?.extraNodeInfos?.dataHandler?.magicTable ?? []),

				{
					groupName: i18next.t("file.name", { ns: "flow" }),
					desc: i18next.t("file.desc", { ns: "flow" }),
					color: "#00C1D2",
					icon: <IconVocabulary color="#fff" stroke={2} size={18} />,
					nodeTypes: [
						customNodeType.Loader,
						customNodeType.Excel,
						...(extraData?.extraNodeInfos?.dataHandler?.file ?? []),
					],
				},

				{
					groupName: i18next.t("text.name", { ns: "flow" }),
					desc: i18next.t("text.desc", { ns: "flow" }),
					color: "#00C1D2",
					icon: <IconAlignBoxLeftMiddle color="#fff" stroke={2} size={18} />,
					nodeTypes: [customNodeType.TextSplit],
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
	installNodes(
		generateNodeVersionSchema(
			extraData?.enterpriseNodeComponentVersionMap || {},
			extraData?.getEnterpriseSchemaConfigMap || (() => ({})),
			extraData?.enterpriseNodeTypes || {},
		),
	)
}
