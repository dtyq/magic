import { memo } from "react"
import type { ErrorViewProps } from "../types"

/**
 * 错误视图组件
 *
 * 用于显示创建过程中的错误信息
 *
 * @param message - 错误主消息
 * @param description - 错误描述（可选）
 */
export const ErrorView = memo(function ErrorView({ message, description }: ErrorViewProps) {
	return (
		<div className="flex h-full items-center justify-center">
			<div className="text-center">
				<h2 className="text-lg font-semibold text-foreground">{message}</h2>
				{description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
			</div>
		</div>
	)
})
