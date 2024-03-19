import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import IconButton from "../ui/custom/IconButton"
import styles from "./index.module.css"
import { useMemo, useState } from "react"
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

	const activeChild = useMemo(() => {
		return item.children?.find((child) => child.value === activeTool)
	}, [activeTool, item.children])

	const isChildActive = !!activeChild

	// 显示图标：如果有激活的子工具，显示子工具的图标；否则显示第一个子工具的图标或父工具的图标
	const IconComponent = activeChild?.icon || item.children?.[0]?.icon || item.icon

	if (!IconComponent) return null

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger>
				<div>
					<IconButton className={styles.toolItem} selected={isChildActive}>
						<IconComponent size={16} />
					</IconButton>
				</div>
			</PopoverTrigger>
			<PopoverContent
				side="right"
				sideOffset={8}
				className="border-base-border w-auto bg-white p-1"
			>
				<div className={styles.popoverContent}>
					{item.children?.map((child) => {
						const ChildIcon = child.icon
						if (!ChildIcon) return null
						return (
							<IconButton
								key={child.value}
								className={styles.toolItem}
								selected={child.value === activeTool}
								onClick={() => {
									if (child.value) {
										setActiveTool(child.value)
										setOpen(false)
									}
								}}
							>
								<ChildIcon size={16} />
							</IconButton>
						)
					})}
				</div>
			</PopoverContent>
		</Popover>
	)
}
