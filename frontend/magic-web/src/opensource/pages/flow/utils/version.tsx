import type { NodeSchema, NodeWidget } from "@dtyq/magic-flow/dist/MagicFlow"
import {
	IconArrowLeftFromArc,
	IconArrowBounce,
	IconArrowIteration,
	IconArrowRightToArc,
	IconArrowsSplit2,
	IconBrain,
	IconClockPause,
	IconCode,
	IconDatabaseExport,
	IconDatabaseImport,
	IconFileSpreadsheet,
	IconFileTextAi,
	IconHealthRecognition,
	IconMessage,
	IconMessageSearch,
	IconPhotoAi,
	IconPlaylistX,
	IconRepeat,
	IconRepeatOff,
	IconTimeline,
	IconUserSearch,
	IconVariable,
	IconVocabulary,
	IconWorldShare,
	IconWand,
} from "@tabler/icons-react"
import { get, pick } from "lodash-es"
import i18next from "i18next"
import type { ReactElement } from "react"
import { customNodeType } from "../constants"
import type { ComponentVersionMap } from "../nodes"
import { nodeComponentVersionMap } from "../nodes"

const getCommonSchemaConfigMap: () => Record<string, NodeSchema> = () => ({
	[customNodeType.Start]: {
		label: i18next.t("start.name", { ns: "flow" }),
		icon: <IconArrowLeftFromArc color="#fff" stroke={1} size={18} />,
		color: "#315CEC",
		id: customNodeType.Start,
		desc: i18next.t("start.desc", { ns: "flow" }),
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
	[customNodeType.SearchUsers]: {
		label: i18next.t("searchMembers.name", { ns: "flow" }),
		icon: <IconUserSearch color="#fff" stroke={1} size={18} />,
		color: "#00C1D2",
		id: customNodeType.SearchUsers,
		desc: i18next.t("searchMembers.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "696px",
		},
	},
	[customNodeType.Text2Image]: {
		label: i18next.t("text2Image.name", { ns: "flow" }),
		icon: <IconPhotoAi color="#fff" stroke={1} size={18} />,
		color: "#00C1D2",
		id: customNodeType.Text2Image,
		desc: i18next.t("text2Image.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},
	[customNodeType.GroupChat]: {
		label: i18next.t("groupChat.name", { ns: "flow" }),
		icon: <IconUserSearch color="#fff" stroke={1} size={18} />,
		color: "#00C1D2",
		id: customNodeType.GroupChat,
		desc: i18next.t("groupChat.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "576px",
		},
	},
	[customNodeType.WaitForReply]: {
		label: i18next.t("waitForReply.name", { ns: "flow" }),
		icon: <IconClockPause color="#fff" stroke={1} size={18} />,
		color: "#3A57D1",
		id: customNodeType.WaitForReply,
		desc: i18next.t("waitForReply.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "480px",
		},
	},
	[customNodeType.ReplyMessage]: {
		label: i18next.t("reply.name", { ns: "flow" }),
		icon: <IconMessage color="#fff" stroke={1} size={18} />,
		color: "#32C436",
		id: customNodeType.ReplyMessage,
		desc: i18next.t("reply.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},
	[customNodeType.LLM]: {
		label: i18next.t("llm.name", { ns: "flow" }),
		icon: <IconBrain color="#fff" stroke={1} size={18} />,
		color: "#00A8FF",
		id: customNodeType.LLM,
		desc: i18next.t("llm.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},
	[customNodeType.If]: {
		label: i18next.t("branch.name", { ns: "flow" }),
		icon: <IconArrowsSplit2 color="#fff" stroke={1} size={18} />,
		color: "#FFA400",
		id: customNodeType.If,
		desc: i18next.t("branch.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "900px",
		},
	},
	[customNodeType.HTTP]: {
		label: i18next.t("http.name", { ns: "flow" }),
		icon: <IconWorldShare color="#fff" stroke={1} size={18} />,
		color: "#BB42D5",
		id: customNodeType.HTTP,
		desc: i18next.t("http.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "900px",
		},
	},
	[customNodeType.Code]: {
		label: i18next.t("code.name", { ns: "flow" }),
		icon: <IconCode color="#fff" stroke={1} size={18} />,
		color: "#00BF9A",
		id: customNodeType.Code,
		desc: i18next.t("code.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "900px",
		},
	},
	[customNodeType.Sub]: {
		label: i18next.t("sub.name", { ns: "flow" }),
		icon: <IconTimeline color="#fff" stroke={1} size={18} />,
		color: "#9DC900",
		id: customNodeType.Sub,
		desc: i18next.t("sub.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "850px",
		},
	},

	[customNodeType.VariableSave]: {
		label: i18next.t("variableSave.name", { ns: "flow" }),
		icon: <IconVariable color="#fff" stroke={1} size={18} />,
		color: "#FFC900",
		id: customNodeType.VariableSave,
		desc: i18next.t("variableSave.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "900px",
		},
	},

	[customNodeType.End]: {
		label: i18next.t("end.name", { ns: "flow" }),
		icon: <IconArrowRightToArc color="#fff" stroke={1} size={18} />,
		color: "#FF4D3A",
		id: customNodeType.End,
		desc: i18next.t("end.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "900px",
		},
	},

	[customNodeType.VectorStorage]: {
		label: i18next.t("vectorStorage.name", { ns: "flow" }),
		icon: <IconArrowIteration color="#fff" stroke={1} size={18} />,
		color: "#007EFF",
		id: customNodeType.VectorStorage,
		desc: i18next.t("vectorStorage.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "800px",
		},
	},

	[customNodeType.VectorSearch]: {
		label: i18next.t("vectorSearch.name", { ns: "flow" }),
		icon: <IconArrowBounce color="#fff" stroke={1} size={18} />,
		color: "#FF0974",
		id: customNodeType.VectorSearch,
		desc: i18next.t("vectorSearch.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "800px",
		},
	},

	[customNodeType.VectorDelete]: {
		label: i18next.t("vectorDelete.name", { ns: "flow" }),
		icon: <IconPlaylistX color="#fff" stroke={1} size={18} />,
		color: "#f24822",
		id: customNodeType.VectorDelete,
		desc: i18next.t("vectorDelete.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "800px",
		},
	},
	[customNodeType.MessageMemory]: {
		label: i18next.t("messageMemory.name", { ns: "flow" }),
		icon: <IconDatabaseImport color="#fff" stroke={1} size={18} />,
		color: "#00C1D2",
		id: customNodeType.MessageMemory,
		desc: i18next.t("messageMemory.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "480px",
		},
	},
	[customNodeType.IntentionRecognition]: {
		label: i18next.t("intentionRecognize.name", { ns: "flow" }),
		icon: <IconHealthRecognition color="#fff" stroke={1} size={18} />,
		color: "#FFC900",
		id: customNodeType.IntentionRecognition,
		desc: i18next.t("intentionRecognize.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},

	[customNodeType.Loop]: {
		label: i18next.t("loop.name", { ns: "flow" }),
		icon: <IconRepeat color="#fff" stroke={1} size={18} />,
		color: "#A61CCB",
		id: customNodeType.Loop,
		desc: i18next.t("loop.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "800px",
		},
	},
	[customNodeType.LoopEnd]: {
		label: i18next.t("loop.loopEnd", { ns: "flow" }),
		icon: <IconRepeatOff color="#fff" stroke={1} size={18} />,
		color: "#7885ff",
		id: customNodeType.LoopEnd,
		desc: i18next.t("loop.loopEndDesc", { ns: "flow" }),
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "480px",
		},
	},

	[customNodeType.LoopBody]: {
		label: i18next.t("loop.loopBody", { ns: "flow" }),
		icon: <IconRepeatOff color="#fff" stroke={1} size={18} />,
		color: "#7885ff",
		id: customNodeType.LoopBody,
		desc: i18next.t("loop.loopBodyDesc", { ns: "flow" }),
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "480px",
		},
		addable: false,
	},

	[customNodeType.Agent]: {
		label: i18next.t("agent.name", { ns: "flow" }),
		icon: <IconRepeatOff color="#fff" stroke={1} size={18} />,
		color: "#7885ff",
		id: customNodeType.Agent,
		desc: i18next.t("agent.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: false,
			withTargetHandle: true,
		},
		style: {
			width: "480px",
		},
	},
	// [customNodeType.LLMCall]: {
	// 	label: "大模型调用",
	// 	icon: <IconBrain color="#fff" stroke={1} size={18} />,
	// 	color: "#00A8FF",
	// 	id: customNodeType.LLMCall,
	// 	desc: "与 AI 聊天 节点的区别：1.手动加载记忆 2.模型选择支持引用之前节点输出",
	// 	handle: {
	// 		withSourceHandle: true,
	// 		withTargetHandle: true,
	// 	},
	// 	style: {
	// 		width: "600px",
	// 	},
	// },
	[customNodeType.MessageSearch]: {
		label: i18next.t("messageSearch.name", { ns: "flow" }),
		icon: <IconMessageSearch color="#fff" stroke={1} size={18} />,
		color: "#066fd1",
		id: customNodeType.MessageSearch,
		desc: i18next.t("messageSearch.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},
	[customNodeType.CacheSetter]: {
		label: i18next.t("cacheSetter.name", { ns: "flow" }),
		icon: <IconDatabaseImport color="#fff" stroke={1} size={18} />,
		color: "#7E57EA",
		id: customNodeType.CacheSetter,
		desc: i18next.t("cacheSetter.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},
	[customNodeType.CacheGetter]: {
		label: i18next.t("cacheGetter.name", { ns: "flow" }),
		icon: <IconDatabaseExport color="#fff" stroke={1} size={18} />,
		color: "#FF7D00",
		id: customNodeType.CacheGetter,
		desc: i18next.t("cacheGetter.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "880px",
		},
	},
	[customNodeType.Loader]: {
		label: i18next.t("loader.name", { ns: "flow" }),
		icon: <IconVocabulary color="#fff" stroke={1} size={18} />,
		color: "#00C1D2",
		id: customNodeType.Loader,
		desc: i18next.t("loader.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "700px",
		},
	},
	[customNodeType.TextSplit]: {
		label: i18next.t("textSplit.name", { ns: "flow" }),
		icon: <IconFileTextAi color="#fff" stroke={1} size={18} />,
		color: "#ff6f63",
		id: customNodeType.TextSplit,
		desc: i18next.t("textSplit.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},

	[customNodeType.Excel]: {
		label: i18next.t("excel.name", { ns: "flow" }),
		icon: <IconFileSpreadsheet color="#fff" stroke={1} size={18} />,
		color: "#54D055",
		id: customNodeType.Excel,
		desc: i18next.t("excel.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "700px",
		},
	},
	[customNodeType.Tools]: {
		label: i18next.t("tools.name", { ns: "flow" }),
		icon: <IconTimeline color="#fff" stroke={1} size={18} />,
		color: "#555761",
		id: customNodeType.Tools,
		desc: i18next.t("tools.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},

	[customNodeType.VectorDatabaseMatch]: {
		label: i18next.t("vectorDatabaseMatch.name", { ns: "flow" }),
		icon: <IconVocabulary color="#fff" stroke={1} size={18} />,
		color: "#00C1D2",
		id: customNodeType.VectorDatabaseMatch,
		desc: i18next.t("vectorDatabaseMatch.desc", { ns: "flow" }),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "700px",
		},
	},

	[customNodeType.Instructions]: {
		label: i18next.t("flow:flowInstructions.name"),
		icon: <IconWand color="#fff" stroke={1} size={18} />,
		color: "#41434C",
		id: customNodeType.Instructions,
		desc: i18next.t("flow:flowInstructions.desc"),
		handle: {
			withSourceHandle: true,
			withTargetHandle: true,
		},
		style: {
			width: "600px",
		},
	},
})

type Version = string

export const generateNodeVersionSchema = (
	enterpriseNodeComponentVersionMap: Record<string, Record<string, ComponentVersionMap>>,
	getEnterpriseSchemaConfigMap: () => Record<string, NodeSchema>,
	enterpriseNodeTypes: Record<string, string>,
) => {
	const result = Object.values({ ...customNodeType, ...enterpriseNodeTypes }).reduce(
		(accVersionTemplate, nodeType) => {
			if (
				!nodeComponentVersionMap[nodeType] &&
				!enterpriseNodeComponentVersionMap[nodeType]
			) {
				console.error(`nodeComponentVersionMap 不存在 ${nodeType}`)
				return accVersionTemplate
			}
			const nodeVersionMap =
				nodeComponentVersionMap[nodeType] || enterpriseNodeComponentVersionMap[nodeType]
			return {
				[nodeType]: Object.entries(nodeVersionMap).reduce(
					(versionTemplate, [nodeVersion, nodeMap]) => {
						/** 需要进行版本化的配置 */
						const versionConfig = pick(nodeMap.template, [
							"input",
							"output",
							"params",
							"system_output",
						])
						/** 拿到具体版本的组件 */
						const versionComp = nodeMap

						const commonSchemaConfigMap = getCommonSchemaConfigMap()

						const enterpriseSchemaConfigMap = getEnterpriseSchemaConfigMap()

						const targetNodeSchema =
							enterpriseSchemaConfigMap[nodeType] || commonSchemaConfigMap[nodeType]

						versionTemplate[nodeVersion] = {
							schema: {
								...targetNodeSchema,
								...versionConfig,
								headerRight: versionComp?.headerRight as ReactElement,
							},
							component: versionComp.component,
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

	return result as Record<customNodeType, Record<Version, NodeWidget>>
}
