import { TFunction } from "i18next"

/** 知识数据类型 */
export enum KnowledgeType {
	/** 用户自建知识库 */
	UserKnowledgeDatabase = 1,
	/** 天书知识库 */
	TeamshareKnowledgeDatabase = 2,
	/** 云文档 */
	Document = 3,
}

export const getDefaultKnowledge = (isCommercial: boolean) => {
	return {
		knowledge_code: "",
		knowledge_type: isCommercial ? KnowledgeType.TeamshareKnowledgeDatabase : "",
		business_id: "",
		name: "",
		description: "",
	}
}

export const getKnowledgeTypeOptions = (t: TFunction, isCommercial: boolean) => [
	...(isCommercial
		? [
				{
					label: t("common.teamshareKnowledgeDatabase", { ns: "flow" }),
					value: KnowledgeType.TeamshareKnowledgeDatabase,
				},
				{
					label: t("common.userKnowledgeDatabase", { ns: "flow" }),
					value: KnowledgeType.UserKnowledgeDatabase,
				},
			]
		: [
				{
					label: t("common.userKnowledgeDatabase", { ns: "flow" }),
					value: KnowledgeType.UserKnowledgeDatabase,
				},
			]),
]

export const getLLMRoleConstantOptions = () => {
	return [
		{
			title: "常量",
			key: "",
			nodeId: "Wrapper",
			nodeType: "21",
			type: "",
			isRoot: true,
			children: [
				{
					title: "User",
					key: "user",
					nodeId: "",
					nodeType: "21",
					type: "string",
					isRoot: false,
					children: [],
					isConstant: true,
				},
				{
					title: "System",
					key: "system",
					nodeId: "",
					nodeType: "21",
					type: "string",
					isRoot: false,
					children: [],
					isConstant: true,
				},
			],
		},
	]
}
