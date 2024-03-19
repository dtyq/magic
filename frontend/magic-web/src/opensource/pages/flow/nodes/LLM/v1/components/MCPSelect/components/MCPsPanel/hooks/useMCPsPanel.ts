/**
 * 工具集面板选择相关数据及行为管理
 */

import { useFlowStore } from "@/opensource/stores/flow"
import { useEffect, useState, useMemo } from "react"

type UseMCPPanelProps = {
	open: boolean
}

export default function useMCPsPanel({ open }: UseMCPPanelProps) {
	const [keyword, setKeyword] = useState("")

	const { useableMCPs } = useFlowStore()

	// use useMemo to cache the filtered results, avoid unnecessary repeated calculations
	const filteredUseableMCPs = useMemo(() => {
		if (!keyword.trim()) {
			return useableMCPs
		}

		return useableMCPs.filter((mcp) => {
			return (
				mcp?.name?.toLowerCase?.()?.includes?.(keyword.toLowerCase()) ||
				mcp?.description?.toLowerCase?.()?.includes?.(keyword.toLowerCase())
			)
		})
	}, [useableMCPs, keyword])

	// reset keyword when panel is opened
	useEffect(() => {
		if (open) {
			setKeyword("")
		}
	}, [open])

	return {
		useableMCPs,
		filteredUseableMCPs,
		keyword,
		setKeyword,
	}
}
