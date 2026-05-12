import { memo } from "react"
import { Spinner } from "@/components/shadcn-ui/spinner"

/**
 * 步骤加载骨架屏组件
 *
 * 在动态导入步骤组件时显示的加载状态
 */
export const StepLoadingSkeleton = memo(function StepLoadingSkeleton() {
	return (
		<div className="flex h-full items-center justify-center">
			<Spinner className="animate-spin" size={24} />
		</div>
	)
})
