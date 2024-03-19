import { memo, useMemo } from "react"
import type { MouseEvent, CSSProperties } from "react"
import { IconUsers, IconX } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { NodeType, type TreeNode } from "@/components/UserSelector/types"
import DepartmentAvatar from "@/components/IconAvatar"
import Avatar from "@/components/Avatar"
import { Badge } from "@/components/ui/badge"

export interface SelectedItemTagProps {
	/** 数据 */
	data: TreeNode
	/** 头像大小 */
	size?: number
	/** 禁选 */
	disabled?: boolean
	/** 关闭按钮事件 */
	onClose?: (e: MouseEvent<HTMLButtonElement>) => void
	/** 样式 */
	className?: string
	/** 样式 */
	style?: CSSProperties
}

function SelectItemTag({
	data,
	className,
	style,
	size = 16,
	onClose,
	disabled,
	...props
}: SelectedItemTagProps) {
	const getItem = useMemo(() => {
		switch (data.dataType) {
			case NodeType.Department:
				return (
					<div className="flex items-center gap-1.5">
						<DepartmentAvatar
							className="rounded-sm"
							name={data.name}
							size={size}
							iconSize={size - 4}
						/>
						<span className="max-w-[100px] truncate text-xs font-medium leading-4 text-secondary-foreground">
							{data.name}
						</span>
					</div>
				)
			case NodeType.UserGroup:
				return (
					<div className="flex items-center gap-1.5">
						<DepartmentAvatar
							name={data.name}
							className="rounded-sm"
							size={size}
							icon={<IconUsers size={size - 4} />}
						/>
						<span className="max-w-[100px] truncate text-xs font-medium leading-4 text-secondary-foreground">
							{data.name}
						</span>
					</div>
				)
			default:
				return (
					<div className="flex items-center gap-1.5">
						<Avatar
							shape="square"
							size={size}
							src={data.avatar_url || data.avatar}
							className="shrink-0 rounded-sm"
							fontSize={6}
							style={{
								color: "black",
							}}
						>
							{data.name}
						</Avatar>
						<span className="max-w-[100px] truncate text-xs font-medium leading-4 text-secondary-foreground">
							{data.name}
						</span>
					</div>
				)
		}
	}, [data, size])

	if (disabled) {
		return (
			<Badge
				className={cn(
					"flex h-6 items-center rounded-md border-none bg-secondary px-2 py-0 text-secondary-foreground shadow-none transition-none",
					className,
				)}
				style={style}
				{...props}
			>
				{getItem}
			</Badge>
		)
	}

	return (
		<Badge
			className={cn(
				"flex h-6 items-center rounded-md border-none bg-secondary px-2 py-0 text-secondary-foreground shadow-none hover:bg-secondary/80",
				className,
			)}
			style={style}
			{...props}
		>
			<div className="flex items-center gap-1">
				{getItem}
				{onClose && (
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation()
							onClose?.(e)
						}}
						className="ml-1 flex items-center justify-center text-secondary-foreground/50 transition-colors hover:text-secondary-foreground"
					>
						<IconX size={12} stroke={2.5} />
					</button>
				)}
			</div>
		</Badge>
	)
}

export default memo(SelectItemTag)
