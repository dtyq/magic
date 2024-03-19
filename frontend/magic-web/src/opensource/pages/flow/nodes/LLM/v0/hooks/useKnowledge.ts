/**
 * 知识数据相关状态及行为
 */

import type { Knowledge } from "@/opensource/types/knowledge"
import type { FormInstance } from "antd"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn } from "ahooks"
import { set } from "lodash-es"
import { getDefaultKnowledge } from "../helpers"
import { useCommercial } from "@/opensource/pages/flow/context/CommercialContext"

type UseKnowledgeProps = {
	form: FormInstance<any>
	onValuesChange: (values: any) => void // 值变化时触发的回调函数
}
export default function useKnowledge({ form, onValuesChange }: UseKnowledgeProps) {
	const { currentNode } = useCurrentNode()
	const extraData = useCommercial()

	const knowledgeValueChangeHandler = useMemoizedFn(() => {
		const latestValue = form.getFieldsValue()
		if (latestValue?.knowledge_config?.knowledge_list) {
			latestValue.knowledge_config.knowledge_list = (
				latestValue.knowledge_config.knowledge_list as Knowledge.KnowledgeDatabaseItem[]
			).filter((v) => !!v)
		}
		const oldKnowledgeConfig = currentNode?.params?.knowledge_config
		set(currentNode!, ["params", "knowledge_config"], {
			...oldKnowledgeConfig,
			...latestValue.knowledge_config,
		})
	})

	const handleAdd = useMemoizedFn(() => {
		const newKnowledge = getDefaultKnowledge(!!extraData) // 获取默认的知识项
		const currentKnowledgeConfig = form.getFieldValue("knowledge_config")
		const newKnowledgeConfig = {
			knowledge_config: {
				...currentKnowledgeConfig,
				knowledge_list: [...(currentKnowledgeConfig?.knowledge_list || []), newKnowledge],
			},
		}
		form.setFieldsValue(newKnowledgeConfig)
		// 手动触发 onValuesChange
		onValuesChange(newKnowledgeConfig)
	})

	return {
		knowledgeValueChangeHandler,
		handleAdd,
	}
}
