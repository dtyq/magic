import { useState, useEffect, useMemo } from "react"
import { Flex } from "antd"
import { useMemoizedFn } from "ahooks"
import { cx } from "antd-style"
import { KnowledgeApi } from "@/apis"
import type { Knowledge } from "@/types/knowledge"
import { useVectorKnowledgeConfigurationStyles } from "../styles"

interface EmbeddingModel {
	id: string
	name: string
	icon: string
	provider: string
}

/**
 * 嵌入模型Hook，用于获取和处理嵌入模型列表
 */
export function useEmbeddingModels() {
	const { styles } = useVectorKnowledgeConfigurationStyles()

	// 嵌入模型分组选项
	const [embeddingModelGroup, setEmbeddingModelGroup] = useState<Knowledge.ServiceProvider[]>([])
	// 铺平的所有嵌入模型
	const [embeddingModels, setEmbeddingModels] = useState<EmbeddingModel[]>([])

	// 获取嵌入模型列表
	const fetchEmbeddingModelList = useMemoizedFn(async () => {
		const res = await KnowledgeApi.getEmbeddingModelList()
		if (res) {
			setEmbeddingModelGroup(res)
			const arr = []
			for (const item of res) {
				for (const model of item.models) {
					arr.push({
						id: model.id,
						name: model.name,
						icon: model.icon,
						provider: item.name,
					})
				}
			}
			setEmbeddingModels(arr)
		}
	})

	/** 嵌入模型选项 */
	const embeddingModelOptions = useMemo(() => {
		return embeddingModelGroup.map((item) => ({
			label: item.name,
			title: item.name,
			options: item.models.map((model) => ({
				label: (
					<Flex align="center" gap={8}>
						<img width={20} src={model.icon} alt="" />
						<div>{model.name}</div>
						<div className={cx(styles.optionProvider, "optionProvider")}>
							{item.name}
						</div>
					</Flex>
				),
				title: model.name,
				value: model.id,
			})),
		}))
	}, [embeddingModelGroup, styles])

	// 获取嵌入模型列表
	useEffect(() => {
		fetchEmbeddingModelList()
	}, [])

	return {
		embeddingModels,
		embeddingModelOptions,
		getEmbeddingModelList: fetchEmbeddingModelList,
	}
}
