import * as React from "react"
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button, buttonVariants } from "@/components/shadcn-ui/button"
import type { VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import type { StepNavigationProps } from "./types"

/**
 * 本地带 loading 效果的 Button 组件
 * 基于 shadcn-ui Button 样式，新增 loading 属性
 */
const LoadingButton = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<"button"> &
		VariantProps<typeof buttonVariants> & {
			loading?: boolean
		}
>(function LoadingButton({ className, variant, size, loading = false, children, ...props }, ref) {
	return (
		<button
			ref={ref}
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			disabled={loading || props.disabled}
			{...props}
		>
			{loading && <Loader2 className="size-4 animate-spin" />}
			{children}
		</button>
	)
})

/**
 * 步骤导航组件
 * 显示上一步/下一步按钮
 */
export function StepNavigation({
	showPrevious = true,
	showNext = true,
	nextText,
	hideNextIcon = false,
	nextDisabled = false,
	nextLoading = false,
	onPrevious,
	onNext,
	className,
}: StepNavigationProps) {
	const { t } = useTranslation("crew/create")

	return (
		<div className={cn("flex items-center justify-end gap-3", className)}>
			{showPrevious && (
				<Button variant="outline" onClick={onPrevious} disabled={nextLoading}>
					<ArrowLeft className="size-4" />
					{t("documentCreate.navigation.previous")}
				</Button>
			)}

			{showNext && (
				<LoadingButton
					onClick={onNext}
					disabled={nextDisabled || nextLoading}
					loading={nextLoading}
				>
					{nextText || t("documentCreate.navigation.next")}
					{!nextLoading && !hideNextIcon && <ArrowRight className="size-4" />}
				</LoadingButton>
			)}
		</div>
	)
}
