import { EXPRESSION_ITEM } from "@/MagicExpressionWidget/types"
import { cloneDeep } from "lodash-es"
import React, { useMemo } from "react"
import { useGlobalContext } from "../../../context/GlobalContext/useGlobalContext"

interface LabelTextProps {
	config: EXPRESSION_ITEM
}

// 转义HTML特殊字符
function escapeHtml(text: string) {
	return text.replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function LabelTextBlock({ config }: LabelTextProps) {
	const { showMultipleLine } = useGlobalContext()

	// 通过 escapeHtml 转义 HTML 标签
	const escapedValue = useMemo(() => {
		let result = cloneDeep(config.value)
		if (!showMultipleLine) {
			result = result.replace(/\n/g, "")
		}
		result = escapeHtml(result)
		return result
	}, [config.value, showMultipleLine])

	return (
		<span
			key={config.uniqueId}
			id={config.uniqueId}
			data-id={config.uniqueId}
			data-type={config.type}
			dangerouslySetInnerHTML={{ __html: escapedValue }}
		/>
	)
}
