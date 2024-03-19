import { observer } from "mobx-react-lite"
import HeadlessHorizontalScroll from "@/opensource/components/base/HeadlessHorizontalScroll"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { cn } from "@/opensource/lib/utils"
import GroupIcon from "./GroupIcon"
import { useLocaleText } from "./hooks/useLocaleText"
import type { OptionGroup } from "./types"
import type { ReactNode } from "react"

interface TemplateGroupSelectorProps {
	groups: OptionGroup[]
	selectedGroupKey: string
	onGroupChange: (groupKey: string) => void
	renderGroupIcon?: (group: OptionGroup) => ReactNode
	className?: string
	leftControlClassName?: string
	rightControlClassName?: string
	"data-testid"?: string
}

const TemplateGroupSelector = observer(
	({
		groups,
		selectedGroupKey,
		onGroupChange,
		renderGroupIcon,
		className,
		leftControlClassName,
		rightControlClassName,
		"data-testid": dataTestId = "template-group-selector",
	}: TemplateGroupSelectorProps) => {
		const lt = useLocaleText()
		return (
			<HeadlessHorizontalScroll
				className={cn(
					"relative flex w-full min-w-0 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-lg p-1",
					className,
				)}
				data-testid={dataTestId}
				scrollContainerClassName="no-scrollbar flex w-full min-w-0 items-center justify-start gap-2 overflow-x-auto overflow-y-hidden py-1"
			>
				{groups.map((group) => {
					const isSelected = group.group_key === selectedGroupKey
					const iconNode = renderGroupIcon
						? renderGroupIcon(group)
						: group.group_icon && (
								<GroupIcon icon={group.group_icon} className="size-4 shrink-0" />
							)

					// if the group has no children, don't render the button
					if (group.children?.length === 0) {
						return null
					}

					return (
						<Button
							key={group.group_key}
							variant={isSelected ? "outline" : "secondary"}
							size="default"
							className={cn(
								"shadow-xs h-9 shrink-0 gap-2 rounded-full border-2 border-transparent px-4 py-2 font-normal",
								isSelected && "border-primary bg-background text-primary",
							)}
							data-testid={`${dataTestId}-option-${group.group_key}`}
							onClick={(e) => {
								onGroupChange(group.group_key)
								e.currentTarget.scrollIntoView({
									behavior: "smooth",
									inline: "center",
									block: "nearest",
								})
							}}
						>
							{iconNode}
							<span className="whitespace-nowrap text-sm leading-5">
								{lt(group.group_name)}
							</span>
						</Button>
					)
				})}
			</HeadlessHorizontalScroll>
		)
	},
)

TemplateGroupSelector.displayName = "TemplateGroupSelector"

export default TemplateGroupSelector
