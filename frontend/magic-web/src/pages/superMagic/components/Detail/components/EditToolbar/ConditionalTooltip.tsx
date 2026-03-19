import { memo, ReactNode } from "react"
import { MagicTooltip } from "@/components/base"

interface ConditionalTooltipProps {
	/** Whether to show text instead of tooltip */
	showText: boolean
	/** Tooltip title text */
	title: string
	/** Child elements to wrap */
	children: ReactNode
	/** 全屏等场景下将 Tooltip 挂载到指定容器内 */
	getPopupContainer?: () => HTMLElement | null
}

/**
 * Conditional wrapper component that shows tooltip when text is hidden
 * When showText=true: renders children without tooltip
 * When showText=false: wraps children with MagicTooltip
 */
function ConditionalTooltip({
	showText,
	title,
	children,
	getPopupContainer,
}: ConditionalTooltipProps) {
	if (showText) {
		return <>{children}</>
	}

	return (
		<MagicTooltip title={title} getPopupContainer={getPopupContainer}>
			<span>{children}</span>
		</MagicTooltip>
	)
}

export default memo(ConditionalTooltip)
