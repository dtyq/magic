import { useState, Fragment, type ReactElement } from "react"
import type { SelectedPath, Organization } from "@/components/UserSelector/types"
import Avatar from "@/components/Avatar"
import defaultAvatar from "@/assets/org_avatar.png"
import {
	Breadcrumb,
	BreadcrumbList,
	BreadcrumbItem,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Props {
	organization?: Organization
	selectedPath: SelectedPath[]
	onItemClick: (index: number) => void
}

const ITEMS_TO_DISPLAY = 2
const BREADCRUMB_LABEL_CLASS = "line-clamp-1 max-w-50 break-all text-left sm:max-w-50 md:max-w-50"

const BreadcrumbNameTooltip = ({ name, children }: { name: string; children: ReactElement }) => (
	<Tooltip>
		<TooltipTrigger asChild>{children}</TooltipTrigger>
		<TooltipContent className="max-w-64 break-words">
			<p>{name}</p>
		</TooltipContent>
	</Tooltip>
)

interface CommonBreadCrumbProps extends Omit<Props, "organization"> {}

export const CommonBreadCrumb = ({ selectedPath, onItemClick }: CommonBreadCrumbProps) => {
	const [open, setOpen] = useState(false)
	return (
		<>
			{selectedPath.length > ITEMS_TO_DISPLAY && (
				<>
					<BreadcrumbSeparator />
					<BreadcrumbItem className="min-w-0">
						<DropdownMenu open={open} onOpenChange={setOpen}>
							<DropdownMenuTrigger
								className="flex items-center gap-1"
								aria-label="Toggle menu"
							>
								<BreadcrumbEllipsis className="size-4" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="z-popup">
								{selectedPath.slice(0, -ITEMS_TO_DISPLAY).map((item, index) => (
									<DropdownMenuItem key={index}>
										<button
											className={BREADCRUMB_LABEL_CLASS}
											title={item.name}
											onClick={() => onItemClick(index)}
										>
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
						<BreadcrumbItem className="min-w-0">
							{!isLast ? (
								<BreadcrumbNameTooltip name={item.name}>
									<button
										className={`${BREADCRUMB_LABEL_CLASS} transition-colors hover:text-foreground`}
										onClick={() => onItemClick(actualIndex)}
									>
										{item.name}
									</button>
								</BreadcrumbNameTooltip>
							) : (
								<BreadcrumbNameTooltip name={item.name}>
									<BreadcrumbPage className={BREADCRUMB_LABEL_CLASS}>
										{item.name}
									</BreadcrumbPage>
								</BreadcrumbNameTooltip>
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
		<TooltipProvider>
			<div className="flex min-w-0 flex-wrap items-center gap-1.5 py-1.5">
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
				<Breadcrumb className="min-w-0">
					<BreadcrumbList className="min-w-0">
						{organization && (
							<BreadcrumbItem className="min-w-0">
								<BreadcrumbNameTooltip name={organization.name}>
									<button
										className={`${BREADCRUMB_LABEL_CLASS} transition-colors hover:text-foreground`}
										onClick={() => onItemClick(-1)}
									>
										{organization?.name}
									</button>
								</BreadcrumbNameTooltip>
							</BreadcrumbItem>
						)}
						<CommonBreadCrumb onItemClick={onItemClick} {...rets} />
					</BreadcrumbList>
				</Breadcrumb>
			</div>
		</TooltipProvider>
	)
}

export default SelectorBreadcrumb
