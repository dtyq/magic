import { useFlowStore } from "@/opensource/stores/flow"
import { useMemoizedFn } from "ahooks"
import { cloneDeep, castArray, set } from "lodash-es"
import { ComponentTypes } from "@/opensource/types/flow"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { defaultExpressionValue } from "@dtyq/magic-flow/dist/MagicExpressionWidget/constant"
import type { Knowledge } from "@/opensource/types/knowledge"
import { LabelTypeMap } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import { genDefaultComponent, generateSnowFlake } from "@/opensource/pages/flow/utils/helpers"
import { useTranslation } from "react-i18next"

/**
 * 针对旧知识库字段的兼容处理
 */
export default function useOldKnowledgeHandle() {
	const { t } = useTranslation()
	const { currentNode } = useCurrentNode()
	// 获取所有可用的知识库
	const { useableDatabases } = useFlowStore()

	const findTargetDatabaseById = useMemoizedFn((id: string) => {
		return useableDatabases?.find?.((database) => {
			return database.id === id
		}) as Knowledge.KnowledgeItem
	})

	// 兼容旧数据处理方法
	const handleOldKnowledge = useMemoizedFn(
		(params: Record<string, any>, oldKey = "knowledge_code", newKey = "vector_database_id") => {
			const cloneParams = cloneDeep(params)
			const oldValue = castArray(cloneParams?.[oldKey]) || []
			const newValue = cloneParams[newKey] || []
			// 如果新知识库列表为空，且旧知识库列表不为空，则取旧知识库列表的值作为新知识库列表的值
			if (newValue?.length === 0 && oldValue?.length > 0) {
				const newKnowledgeResult = genDefaultComponent(ComponentTypes.Value, {
					...defaultExpressionValue,
					const_value: [
						{
							// @ts-ignore
							type: LabelTypeMap.LabelNames,
							uniqueId: generateSnowFlake(),
							value: "",
							names_value: [],
						},
					],
				})
				oldValue.forEach((databaseId: string) => {
					if (typeof databaseId === "string") {
						const targetDatabase = findTargetDatabaseById(databaseId)
						newKnowledgeResult?.structure?.const_value?.[0]?.names_value?.push?.({
							id: targetDatabase?.id,
							name:
								targetDatabase?.name ||
								t("common.invalidKnowledgeDatabase", { ns: "flow" }),
						})
					}
					return databaseId
				})
				if (currentNode) set(currentNode, ["params", newKey], newKnowledgeResult)
				cloneParams[newKey] = newKnowledgeResult
			}
			return cloneParams
		},
	)

	return {
		handleOldKnowledge,
	}
}
