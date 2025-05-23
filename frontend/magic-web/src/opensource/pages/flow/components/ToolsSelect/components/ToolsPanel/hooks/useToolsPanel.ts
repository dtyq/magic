/**
 * 工具集面板选择相关数据及行为管理
 */

import { useFlowStore } from "@/opensource/stores/flow"
import type { UseableToolSet } from "@/types/flow"
import { useEffect, useState, useMemo } from "react"

type UseToolPanelProps = {
	open: boolean
}

export default function useToolsPanel({ open }: UseToolPanelProps) {
	const [keyword, setKeyword] = useState("")

	const { useableToolSets } = useFlowStore()

	// 使用useMemo缓存过滤结果，避免不必要的重复计算
	const filteredUseableToolSets = useMemo(() => {
		if (!keyword.trim()) {
			return useableToolSets
		}

		return useableToolSets
			.map((useableToolSet) => {
				const filterTools = useableToolSet?.tools?.filter(
					(tool) =>
						tool?.name?.toLowerCase?.()?.includes?.(keyword.toLowerCase()) ||
						tool?.description?.toLowerCase?.()?.includes?.(keyword.toLowerCase()),
				)
				if (filterTools?.length > 0) {
					return {
						...useableToolSet,
						tools: filterTools,
					}
				}
				return null
			})
			.filter(Boolean) as UseableToolSet.Item[]
	}, [useableToolSets, keyword])

	// 在面板打开时重置关键词
	useEffect(() => {
		if (open) {
			setKeyword("")
		}
	}, [open])

	return {
		useableToolSets,
		filteredUseableToolSets,
		keyword,
		setKeyword,
	}
}
