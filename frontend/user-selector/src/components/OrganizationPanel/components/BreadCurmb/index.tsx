import { useState, Fragment } from "react"
import type { SelectedPath, Organization } from "@/components/UserSelector/types"
import Avatar from "@/components/Avatar"
import defaultAvatar from "@/assets/org_avatar.png"
import {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbSeparator,
	BreadcrumbEllipsis,
	BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Props {
	organization?: Organization
	selectedPath: SelectedPath[]
	onItemClick: (index: number) => void
}

const ITEMS_TO_DISPLAY = 2

interface CommonBreadCrumbProps extends Omit<Props, "organization"> {}

export const CommonBreadCrumb = ({ selectedPath, onItemClick }: CommonBreadCrumbProps) => {
	const [open, setOpen] = useState(false)
	return (
		<>
			{selectedPath.length > ITEMS_TO_DISPLAY && (
				<>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<DropdownMenu open={open} onOpenChange={setOpen}>
							<DropdownMenuTrigger
								className="flex items-center gap-1"
								aria-label="Toggle menu"
							>
								<BreadcrumbEllipsis className="size-4" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start">
								{selectedPath.slice(0, -ITEMS_TO_DISPLAY).map((item, index) => (
									<DropdownMenuItem key={index}>
										<button onClick={() => onItemClick(index)}>
											{item.name}
										</button>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</BreadcrumbItem>
				</>
			)}
			{selectedPath.slice(-ITEMS_TO_DISPLAY).map((item, index) => {
				const actualIndex =
					selectedPath.length > ITEMS_TO_DISPLAY
						? selectedPath.length - ITEMS_TO_DISPLAY + index
						: index
				const isLast = actualIndex === selectedPath.length - 1
				return (
					<Fragment key={actualIndex}>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							{!isLast ? (
								<BreadcrumbLink asChild className="max-w-20 truncate md:max-w-none">
									<button onClick={() => onItemClick(actualIndex)}>
										{item.name}
									</button>
								</BreadcrumbLink>
							) : (
								<BreadcrumbPage className="max-w-20 truncate md:max-w-none">
									{item.name}
								</BreadcrumbPage>
							)}
						</BreadcrumbItem>
					</Fragment>
				)
			})}
		</>
	)
}

const SelectorBreadcrumb = ({ organization, onItemClick, ...rets }: Props) => {
	return (
		<div className="flex flex-wrap items-center gap-1.5 py-1.5">
			{organization && (
				<Avatar
					shape="square"
					size={24}
					className="shrink-0 rounded-md border border-border"
					src={organization.logo || defaultAvatar}
					fontSize={10}
				>
					{organization.name}
				</Avatar>
			)}
			<Breadcrumb>
				<BreadcrumbList>
					{organization && (
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<button onClick={() => onItemClick(-1)}>
									{organization?.name}
								</button>
							</BreadcrumbLink>
						</BreadcrumbItem>
					)}
					<CommonBreadCrumb onItemClick={onItemClick} {...rets} />
				</BreadcrumbList>
			</Breadcrumb>
		</div>
	)
}

export default SelectorBreadcrumb
