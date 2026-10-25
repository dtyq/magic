import type { ReactNode } from "react"
import { cn } from "@/utils/cn"
import { SidebarRow, type SidebarLabelVariant } from "./SidebarRow"

export { SidebarRow, SidebarSectionToggle } from "./SidebarRow"
export interface SidebarSectionOptions {
	isExpanded: boolean
	onClick: () => void
	leading?: ReactNode
	description?: ReactNode
	wrapLabel?: boolean
	labelVariant?: SidebarLabelVariant
	/** 由分组调用方调整标题外观，保留共用行的布局与交互。 */
	headerClassName?: string
}

export function SidebarExpandableItem({
	label,
	onClick,
	isActive = false,
	isExpanded = false,
	leading,
	trailing,
	testId,
	className,
	contentClassName,
	childrenClassName,
	children,
	header,
	headerClassName,
	wrapLabel = false,
	labelVariant,
	fill = false,
}: {
	label: string
	onClick: () => void
	isActive?: boolean
	isExpanded?: boolean
	leading?: ReactNode
	trailing?: ReactNode
	testId: string
	className?: string
	contentClassName?: string
	childrenClassName?: string
	children: ReactNode
	header?: ReactNode
	headerClassName?: string
	wrapLabel?: boolean
	labelVariant?: SidebarLabelVariant
	/** 导航栏目使用剩余高度，普通用户空间分组继续按内容高度展开。 */
	fill?: boolean
}) {
	return (
		<div
			className={cn(fill && "flex min-h-0 flex-col", className)}
			data-testid={`${testId}-section`}
		>
			{header ?? (
				<SidebarRow
					label={label}
					onClick={onClick}
					isActive={isActive}
					isExpanded={isExpanded}
					leading={leading}
					trailing={trailing}
					testId={testId}
					wrapLabel={wrapLabel}
					labelVariant={labelVariant}
					className={headerClassName}
				/>
			)}
			<div
				className={cn(
					"grid overflow-hidden transition-all duration-200 ease-out",
					isExpanded
						? "grid-rows-[minmax(0,1fr)] opacity-100"
						: "pointer-events-none grid-rows-[0fr] opacity-0",
					contentClassName,
					fill && (isExpanded ? "min-h-0 flex-1" : "h-0 flex-none"),
				)}
				data-testid={`${testId}-content`}
			>
				<div
					className={cn(
						"min-h-0 overflow-hidden bg-muted/20 transition-[transform,opacity] duration-200 ease-out",
						isExpanded ? "translate-y-0" : "-translate-y-1",
						fill && "flex flex-col",
					)}
				>
					<div
						className={cn(
							"duration-200",
							isExpanded && "animate-in fade-in slide-in-from-top-1",
							childrenClassName,
							fill && "flex min-h-0 flex-1 flex-col",
						)}
					>
						{children}
					</div>
				</div>
			</div>
		</div>
	)
}
