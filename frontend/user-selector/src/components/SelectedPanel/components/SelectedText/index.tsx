import type { PropsWithChildren } from "react"
import { memo, useMemo } from "react"
import { groupBy } from "lodash-es"
import type { BaseProps, TreeNode } from "@/components/UserSelector/types"
import { NodeType } from "@/components/UserSelector/types"
import { cn } from "@/lib/utils"
import { useAppearance } from "@/context/AppearanceProvider"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface SelectedTextProps extends PropsWithChildren, BaseProps {
	selected?: TreeNode[]
	checkbox?: boolean
	checkAll?: boolean
	checkSome?: boolean
	onCheckAll?: (checked: boolean) => void
}

function SelectedText({
	checkbox,
	selected,
	children,
	className,
	style,
	checkAll,
	checkSome,
	onCheckAll,
}: SelectedTextProps) {
	const { getLocale } = useAppearance()
	const locale = getLocale()

	const {
		[NodeType.Department]: departmentSelected = [],
		[NodeType.User]: userSelected = [],
		[NodeType.Group]: groupSelected = [],
		[NodeType.Partner]: partnerSelected = [],
		[NodeType.UserGroup]: userGroupSelected = [],
	} = useMemo(() => {
		return groupBy(selected, (item: TreeNode) => item.dataType)
	}, [selected])

	const statsParts = useMemo(() => {
		const parts: string[] = []
		if (departmentSelected.length > 0)
			parts.push(`${departmentSelected.length} ${locale.selectedDepartment}`)
		if (userSelected.length > 0) parts.push(`${userSelected.length} ${locale.selectedUser}`)
		if (groupSelected.length > 0) parts.push(`${groupSelected.length} ${locale.selectedGroup}`)
		if (partnerSelected.length > 0)
			parts.push(`${partnerSelected.length} ${locale.selectedPartner}`)
		if (userGroupSelected.length > 0)
			parts.push(`${userGroupSelected.length} ${locale.selectedUserGroup}`)
		return parts
	}, [
		departmentSelected.length,
		userSelected.length,
		groupSelected.length,
		partnerSelected.length,
		userGroupSelected.length,
		locale,
	])

	const statsText = statsParts.join(" · ")

	return (
		<div className={cn("flex h-9 items-center justify-between gap-2", className)} style={style}>
			<div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
				{checkbox && (
					<Checkbox
						checked={checkAll || checkSome ? "indeterminate" : false}
						onCheckedChange={(checked) => {
							onCheckAll?.(checked === true)
						}}
						className="shrink-0"
					/>
				)}
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<div className="min-w-0 flex-1 truncate">
								<span className="font-medium text-foreground">
									{locale.selected}
								</span>
								{statsText && (
									<span className="text-muted-foreground"> {statsText}</span>
								)}
							</div>
						</TooltipTrigger>
						{statsText && (
							<TooltipContent>
								<p className="whitespace-pre-wrap">{statsText}</p>
							</TooltipContent>
						)}
					</Tooltip>
				</TooltipProvider>
			</div>
			<div className="shrink-0">{children}</div>
		</div>
	)
}

export default memo(SelectedText)
