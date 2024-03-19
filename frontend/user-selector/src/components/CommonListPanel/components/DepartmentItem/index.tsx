import { memo } from "react"
import { IconChevronRight, IconUsers } from "@tabler/icons-react"
import {
	NodeType,
	UserGroup,
	type Department,
	type TreeNode,
} from "@/components/UserSelector/types"
import Avatar from "@/components/IconAvatar"
import { cn } from "@/lib/utils"
import { useAppearance } from "@/context/AppearanceProvider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Props {
	data: Department | UserGroup
	showArrow?: boolean
	isMobile?: boolean
	onItemClick?: (node: TreeNode) => void
}

function DepartmentItem({ data, showArrow = true, isMobile = false, onItemClick }: Props) {
	const { getLocale } = useAppearance()
	const locale = getLocale()

	return (
		<TooltipProvider>
			<div
				className="flex h-full flex-1 cursor-pointer items-center justify-between gap-2.5 overflow-hidden"
				onClick={() => onItemClick?.(data)}
			>
				<div className="flex min-w-0 flex-1 items-center gap-2">
					{data.dataType === NodeType.UserGroup ? (
						<Avatar
							name={data.name}
							className="shrink-0 rounded-md"
							size={32}
							icon={<IconUsers size={16} />}
						/>
					) : (
						<Avatar name={data.name} className="shrink-0 rounded-md" size={32} />
					)}

					<div className="flex min-w-0 flex-1 items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<div
									className={cn(
										"text-sm font-medium leading-5 text-foreground truncate",
										data.name.length > 10 && "cursor-help",
									)}
								>
									{data.name}
								</div>
							</TooltipTrigger>
							{data.name.length > 10 && (
								<TooltipContent>
									<p>{data.name}</p>
								</TooltipContent>
							)}
						</Tooltip>
						{data.dataType === NodeType.Department && (
							<div className="shrink-0 truncate whitespace-nowrap text-sm font-medium leading-5 text-foreground">
								({data.employee_sum}
								{locale.people})
							</div>
						)}
					</div>
				</div>
				{isMobile ? (
					<div
						className={cn(
							"flex items-center gap-0.5 shrink-0 text-sm font-medium text-primary",
							!showArrow && "text-muted-foreground",
						)}
					>
						<IconChevronRight size={16} stroke={2} className="text-current" />
					</div>
				) : (
					showArrow && (
						<IconChevronRight
							size={16}
							className="shrink-0 text-muted-foreground"
							stroke={2}
						/>
					)
				)}
			</div>
		</TooltipProvider>
	)
}

export default memo(DepartmentItem)
