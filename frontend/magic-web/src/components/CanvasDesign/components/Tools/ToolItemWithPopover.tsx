import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import IconButton from "../ui/custom/IconButton"
import { usePortalContainer } from "../ui/custom/PortalContainerContext"
import styles from "./index.module.css"
import { useMemo, useState } from "react"
import classNames from "classnames"
import { type ToolType } from "../../canvas/types"
import type { ToolOptionItem } from "./types"

// 带 Popover 的工具项组件
export default function ToolItemWithPopover({
	item,
	activeTool,
	setActiveTool,
}: {
	item: ToolOptionItem
	activeTool: ToolType | null
	setActiveTool: (tool: ToolType | null) => void
}) {
	const [open, setOpen] = useState(false)
	const portalContainer = usePortalContainer()

	const activeChild = useMemo(() => {
		return item.children?.find((child) => child.value === activeTool)
	}, [activeTool, item.children])

	const isChildActive = !!activeChild

	// 显示图标：优先显示激活子项图标，其次显示父项图标，最后回退到第一个子项图标
	const IconComponent = activeChild?.icon || item.icon || item.children?.[0]?.icon

	if (!IconComponent) return null

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<Tooltip>
				<TooltipTrigger asChild>
					<PopoverTrigger asChild>
						<div>
							<IconButton className={styles.toolItem} selected={isChildActive}>
								<IconComponent size={16} />
							</IconButton>
						</div>
					</PopoverTrigger>
				</TooltipTrigger>
				<TooltipPrimitive.Portal container={portalContainer || undefined}>
					<TooltipContent side="right" sideOffset={8} className="border-black bg-black">
						<div>
							<span className={styles.tooltipLabel}>{item.label}</span>
						</div>
						<TooltipPrimitive.Arrow className="fill-black" />
					</TooltipContent>
				</TooltipPrimitive.Portal>
			</Tooltip>
			<PopoverContent
				align="start"
				side="right"
				sideOffset={8}
				className="border-base-border w-auto bg-white p-1"
			>
				<div className={styles.popoverContent}>
					{item.children?.map((child) => {
						const ChildIcon = child.icon
						const isSelected = !!child.value && child.value === activeTool
						return (
							<button
								key={child.value || child.label}
								type="button"
								className={classNames(
									styles.popoverMenuItem,
									isSelected && styles.popoverMenuItemSelected,
								)}
								onClick={() => {
									if (child.value) {
										setActiveTool(child.value)
									}
									child.onClick?.()
									setOpen(false)
								}}
							>
								{ChildIcon ? <ChildIcon size={16} /> : null}
								<span>{child.label}</span>
							</button>
						)
					})}
				</div>
			</PopoverContent>
		</Popover>
	)
}
