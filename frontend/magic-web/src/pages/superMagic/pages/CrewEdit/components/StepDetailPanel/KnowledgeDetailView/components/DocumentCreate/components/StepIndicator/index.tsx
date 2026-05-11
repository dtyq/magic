import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import type { StepIndicatorProps } from "./types"

/**
 * 步骤指示器组件
 * 显示创建文档的步骤流程
 * 设计稿: https://www.figma.com/design/6Y4cUmZyEJnas4qKtbcJ5Y/Magic---SuperMagic-Shadcn?node-id=14854-1847154
 */
export function StepIndicator({ steps, className }: StepIndicatorProps) {
	const { t } = useTranslation("crew/create")

	return (
		<div className={cn("flex items-center justify-center gap-20 px-8 py-3.5", className)}>
			{steps.map((step) => (
				<div key={step.number} className="flex flex-col items-center gap-3">
					{/* 步骤圆圈 - 32x32px */}
					<div
						className={cn(
							"flex size-8 items-center justify-center rounded-full text-sm font-semibold leading-none transition-colors",
							step.status === "current" && "bg-primary text-primary-foreground",
							step.status === "pending" &&
								"border border-border bg-background text-muted-foreground",
							step.status === "completed" && "bg-primary text-primary-foreground",
						)}
					>
						{step.status === "completed" ? (
							<Check className="size-4" />
						) : (
							<span>{step.number}</span>
						)}
					</div>

					{/* 步骤标签 */}
					<span
						className={cn(
							"text-sm leading-none transition-colors",
							step.status === "current" && "text-foreground",
							step.status === "pending" && "text-muted-foreground",
							step.status === "completed" && "text-foreground",
						)}
					>
						{t(step.i18nKey)}
					</span>
				</div>
			))}
		</div>
	)
}
