/**
 * AiActionButton - 集成模型选择 + AI 操作的按钮组件
 *
 * 左侧显示模型图标（点击切换模型），右侧显示操作文字（点击执行 AI 操作）。
 * 生成中时隐藏左侧模型图标，仅显示操作区（停止/加载状态）。
 * 使用 MobX observer 确保模型切换和加载状态及时响应更新。
 */

import { useId, type ReactNode } from "react"
import { observer } from "mobx-react-lite"
import { cn } from "@/utils/cn"
import ModelSelector from "../picker/ModelSelector"

interface AiActionButtonProps {
	/** 当前选中的模型 ID */
	modelValue?: string
	/** 模型变更回调 */
	onModelChange: (modelId: string) => void
	/** 是否正在生成中 */
	loading?: boolean
	/** 是否禁用 */
	disabled?: boolean
	/** 禁用时的轻提示，不占用可见布局 */
	disabledReason?: string
	/** 点击操作区回调 */
	onClick: () => void
	/** 操作文字（非加载状态） */
	label: ReactNode
	/** 加载中文字 */
	loadingLabel?: ReactNode
	/** 样式变体：primary = 主按钮；outline = 次级按钮；accent = 强调按钮 */
	variant?: "primary" | "outline" | "accent"
	/** 尺寸：sm = 紧凑(11px)；md = 常规(12px) */
	size?: "sm" | "md"
	/** 额外 className */
	className?: string
}

export default observer(function AiActionButton({
	modelValue,
	onModelChange,
	loading = false,
	disabled = false,
	disabledReason,
	onClick,
	label,
	loadingLabel,
	variant = "outline",
	size = "md",
	className,
}: AiActionButtonProps) {
	const isPrimary = variant === "primary"
	const isAccent = variant === "accent"
	const isSm = size === "sm"
	const disabledReasonId = useId()
	const effectiveDisabledReason = disabled && !loading ? disabledReason : undefined

	return (
		<div
			title={effectiveDisabledReason}
			className={cn(
				"relative flex items-center overflow-hidden font-semibold transition-all duration-200",
				"rounded-full border shadow-xs",
				isSm ? "h-7 text-[11px]" : "h-9 text-xs",
				disabled && !loading && "opacity-40",
				isAccent
					? loading
						? "border-[#e4e4e7] bg-[#f4f4f5] text-[#71717a]"
						: "border-[#18181b] bg-[#18181b] text-white shadow-[0_10px_24px_rgba(24,24,27,0.12)] hover:bg-[#27272a] active:scale-[0.98]"
					: isPrimary
						? loading
							? "border-border bg-muted text-muted-foreground"
							: "border-primary bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
						: loading
							? "border-border bg-muted/50 text-muted-foreground"
							: "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground active:scale-[0.98]",
				className,
			)}
		>
			{effectiveDisabledReason && (
				<span id={disabledReasonId} className="sr-only">
					{effectiveDisabledReason}
				</span>
			)}
			{/* Model selector - hidden during loading */}
			{!loading && (
				<ModelSelector
					value={modelValue}
					onChange={onModelChange}
					mode="icon"
					disabled={disabled && !loading}
					disabledReason={effectiveDisabledReason}
					className={cn(
						"flex h-full items-center justify-center border-r pl-3.5 pr-2 transition-colors",
						isAccent
							? "border-white/15 text-white hover:bg-white/10"
							: isPrimary
								? "border-primary-foreground/20 hover:bg-primary-foreground/10"
								: "border-border hover:bg-accent",
					)}
				/>
			)}
			{/* Action button area */}
			<button
				type="button"
				className={cn(
					"flex h-full flex-shrink-0 items-center justify-center gap-1.5 font-semibold transition-all",
					isSm ? "px-2" : "px-5",
					!loading &&
					(isAccent
						? "hover:bg-white/10 active:opacity-95"
						: isPrimary
							? "hover:bg-white/5 active:opacity-90 dark:hover:bg-black/5"
							: "hover:text-zinc-900 active:opacity-90 dark:hover:text-zinc-50"),
				)}
				onClick={onClick}
				disabled={disabled && !loading}
				title={effectiveDisabledReason}
				aria-describedby={effectiveDisabledReason ? disabledReasonId : undefined}
				data-testid="ai-action-button"
			>
				{loading && (
					<span className="relative mr-1 flex h-2 w-2">
						<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
						<span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
					</span>
				)}
				{loading ? loadingLabel : label}
			</button>
		</div>
	)
})
