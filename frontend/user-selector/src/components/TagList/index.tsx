import { memo, useMemo } from "react"
import type { BaseProps, TreeNode } from "@/components/UserSelector/types"
import SelectedItemTag from "./components/SelectedItemTag"
import SelectedText from "../SelectedPanel/components/SelectedText"
import { cn } from "@/lib/utils"

export interface TagListProps extends BaseProps {
	/* 已选列表 */
	selected?: TreeNode[]
	/* 禁选列表 */
	disabledNodes?: TreeNode[]
	/* 移除按钮事件 */
	onClose?: (value: TreeNode) => void
}

function TagList({ selected, className, style, onClose, disabledNodes }: TagListProps) {
	const disabledMap = useMemo(
		() =>
			disabledNodes?.reduce(
				(acc, item) => {
					acc[item.id] = true
					return acc
				},
				{} as Record<string, boolean>,
			),
		[disabledNodes],
	)
	return (
		<div
			className={cn("flex flex-col h-full overflow-hidden gap-1.5", className)}
			style={style}
		>
			<SelectedText selected={selected} />
			<div className="flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto py-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5">
				{selected?.map((item) => (
					<SelectedItemTag
						key={item.id}
						data={item}
						disabled={disabledMap?.[item.id] ?? false}
						onClose={() => onClose?.(item)}
					/>
				))}
			</div>
		</div>
	)
}

export default memo(TagList)
