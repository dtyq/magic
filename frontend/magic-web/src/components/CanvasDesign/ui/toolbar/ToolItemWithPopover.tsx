import { Popover, PopoverAnchor, PopoverContent } from "../primitives/shadcn/popover"
import IconButton from "../primitives/custom/IconButton/index"
import styles from "./index.module.css"
import { useEffect, useMemo, useRef, useState } from "react"
import { cn } from "../../runtime/shared/lib/utils"
import { type ToolType } from "../../runtime/document/types"
import type { ToolOptionItem } from "./types"

const HOVER_CLOSE_DELAY_MS = 120

// 带 Popover 的工具项组件（hover 展开菜单，无标题 tooltip）
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
	const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const activeChild = useMemo(() => {
		return item.children?.find((child) => child.value === activeTool)
	}, [activeTool, item.children])

	const isChildActive = !!activeChild

	// 显示图标：优先显示激活子项图标，其次显示父项图标，最后回退到第一个子项图标
	const IconComponent = activeChild?.icon || item.icon || item.children?.[0]?.icon

	useEffect(() => {
		return () => {
			if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
		}
	}, [])

	const clearCloseTimer = () => {
		if (!closeTimerRef.current) return
		clearTimeout(closeTimerRef.current)
		closeTimerRef.current = null
	}

	const handleHoverOpen = () => {
		clearCloseTimer()
		setOpen(true)
	}

	const handleHoverClose = () => {
		clearCloseTimer()
		closeTimerRef.current = setTimeout(() => {
			setOpen(false)
			closeTimerRef.current = null
		}, HOVER_CLOSE_DELAY_MS)
	}

	if (!IconComponent) return null

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverAnchor asChild>
				<div onMouseEnter={handleHoverOpen} onMouseLeave={handleHoverClose}>
					<IconButton className={styles.toolItem} selected={isChildActive}>
						<IconComponent size={16} />
					</IconButton>
				</div>
			</PopoverAnchor>
			<PopoverContent
				align="center"
				side="top"
				sideOffset={8}
				className="border-base-border w-auto bg-white p-1"
				onOpenAutoFocus={(event) => event.preventDefault()}
				onCloseAutoFocus={(event) => event.preventDefault()}
				onMouseEnter={handleHoverOpen}
				onMouseLeave={handleHoverClose}
			>
				<div className={styles.popoverContent}>
					{item.children?.map((child) => {
						const ChildIcon = child.icon
						const isSelected = !!child.value && child.value === activeTool
						return (
							<button
								key={child.value || child.label}
								type="button"
								className={cn(
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
