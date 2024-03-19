import { memo } from "react"
import { type User, type TreeNode, type Group, type Partner } from "@/components/UserSelector/types"
import Avatar from "@/components/Avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Props {
	data: User | Group | Partner
	onItemClick?: (node: TreeNode) => void
}

function MemberItem({ data, onItemClick }: Props) {
	const desc =
		`${
			data?.department && data?.position
				? `${data?.department}/${data?.position}`
				: data?.department || data?.position || ""
		}` ||
		`${
			Array.isArray(data?.path_nodes) && data.path_nodes.length > 0
				? data.path_nodes.map((i) => i.department_name).join("/")
				: ""
		}${data.job_title ? `/${data.job_title}` : ""}`

	return (
		<TooltipProvider>
			<div
				className="flex h-full flex-1 cursor-pointer items-center gap-2 overflow-hidden"
				onClick={() => onItemClick?.(data)}
			>
				<Avatar
					shape="square"
					size={32}
					src={data?.avatar_url || data?.avatar}
					className="shrink-0 rounded-md"
				>
					{String(data.name ?? data?.real_name ?? "")}
				</Avatar>

				<div className="flex min-w-0 flex-1 flex-col">
					<div className="truncate text-sm font-medium leading-5 text-foreground">
						{String(data.name ?? data?.real_name ?? "")}
					</div>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="truncate text-xs leading-4 text-muted-foreground">
								{desc}
							</div>
						</TooltipTrigger>
						{desc && desc.length > 10 && (
							<TooltipContent>
								<p>{desc}</p>
							</TooltipContent>
						)}
					</Tooltip>
				</div>
			</div>
		</TooltipProvider>
	)
}

export default memo(MemberItem)
