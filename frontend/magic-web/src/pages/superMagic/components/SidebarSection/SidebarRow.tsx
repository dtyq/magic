import type { ReactNode, RefObject } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/utils/cn"

export type SidebarLabelVariant = "default" | "section" | "item" | "navigation"

export function SidebarSectionToggle({
	label,
	isExpanded,
	onClick,
	disabled = false,
	menuHover = false,
}: {
	label: string
	isExpanded: boolean
	onClick: () => void
	disabled?: boolean
	menuHover?: boolean
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			aria-label={label}
			aria-expanded={isExpanded}
			data-header-chevron
			className={cn(
				"flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none",
				menuHover
					? "focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground"
					: "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
			)}
		>
			<ChevronRight
				className={cn(
					"h-4 w-4 transition-transform duration-200 ease-out",
					isExpanded && "rotate-90",
				)}
			/>
		</button>
	)
}

export interface SidebarRowProps {
	label: string
	onClick: () => void
	isActive?: boolean
	/** 分组与普通项目条目使用不同字重；未指定的调用方保留原样式。 */
	labelVariant?: SidebarLabelVariant
	labelClassName?: string
	/** 导航栏目沿用应用菜单的背景反馈，不改变标题位置或普通分组外观。 */
	menuHover?: boolean
	isExpanded?: boolean
	disabled?: boolean
	hideChevron?: boolean
	leading?: ReactNode
	trailing?: ReactNode
	testId: string
	className?: string
	/** 多板块依赖文字区分身份，允许标题换行并撑高；默认行高保持不变。 */
	wrapLabel?: boolean
	/** 工具区在窄面板另起一行，标题和交互节点保持原位置与状态。 */
	stackTrailing?: boolean
	description?: ReactNode
	rowRef?: RefObject<HTMLDivElement>
	labelRef?: RefObject<HTMLSpanElement>
}

export function SidebarRow({
	label,
	onClick,
	isActive = false,
	labelVariant = "default",
	labelClassName,
	menuHover = labelVariant === "navigation",
	isExpanded = false,
	disabled = false,
	hideChevron = false,
	leading,
	trailing,
	testId,
	className,
	wrapLabel = false,
	stackTrailing = false,
	description,
	rowRef,
	labelRef,
}: SidebarRowProps) {
	// 导航入口默认共用悬停与键盘焦点反馈；窗口关闭后仍可恢复焦点，不用描边模拟选中。
	return (
		<div
			ref={rowRef}
			onClick={(event) => {
				if (!disabled && event.target === event.currentTarget) onClick()
			}}
			className={cn(
				"flex h-10 w-full items-center gap-2 overflow-hidden px-2.5 text-left transition-[background-color,box-shadow] duration-200 ease-out",
				menuHover
					? "cursor-pointer rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
					: "hover:bg-accent/40",
				isActive && "bg-accent/50",
				disabled && "cursor-not-allowed opacity-60 hover:bg-transparent",
				className,
				wrapLabel && "h-auto min-h-10 py-2",
				labelVariant === "item" && "h-auto min-h-10 py-2 md:min-h-9",
				stackTrailing && "grid grid-cols-[minmax(0,1fr)_auto]",
			)}
		>
			{/* 标题与工具按钮并列，避免嵌套 button；操作菜单不会触发分组折叠。 */}
			<button
				type="button"
				disabled={disabled}
				onClick={onClick}
				aria-expanded={hideChevron ? undefined : isExpanded}
				data-testid={testId}
				className={cn(
					"flex min-w-0 flex-1 items-center gap-2 self-stretch overflow-hidden rounded-sm text-left outline-none",
					menuHover
						? "focus-visible:bg-sidebar-accent focus-visible:text-sidebar-accent-foreground"
						: "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring",
				)}
			>
				{leading && (
					<div
						data-header-leading
						className={cn(
							"flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground",
							labelVariant === "navigation" && "text-sidebar-foreground",
						)}
					>
						{leading}
					</div>
				)}
				<div
					className={cn(
						"min-w-0 text-sm font-medium text-foreground",
						(labelVariant === "section" || labelVariant === "item") &&
							"text-[13px] leading-5",
						labelVariant === "item" && "font-normal",
						labelVariant === "navigation" &&
							"text-sm font-normal leading-5 text-sidebar-foreground",
						!wrapLabel && "truncate",
						labelClassName,
					)}
				>
					<span
						ref={labelRef}
						className={cn(
							"inline-block",
							labelVariant === "navigation" && "block",
							wrapLabel
								? "whitespace-normal break-words text-left [overflow-wrap:anywhere]"
								: "whitespace-nowrap",
						)}
					>
						{label}
					</span>
					{description && <div className="[&>p]:p-0">{description}</div>}
				</div>
			</button>
			{trailing && (
				<div
					className={cn(
						"flex shrink-0 items-center gap-1",
						stackTrailing && "col-span-2 row-start-2 min-w-0",
					)}
					onClick={(event) => event.stopPropagation()}
					data-testid="sidebar-row"
				>
					{trailing}
				</div>
			)}
			{hideChevron ? null : (
				<SidebarSectionToggle
					label={label}
					disabled={disabled}
					onClick={onClick}
					isExpanded={isExpanded}
					menuHover={menuHover}
				/>
			)}
		</div>
	)
}
