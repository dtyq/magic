import { observer } from "mobx-react-lite"
import { ChevronLeft, ChevronRight } from "lucide-react"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import GroupIcon from "./GroupIcon"
import { useLocaleText } from "./hooks/useLocaleText"
import type { OptionGroup } from "./types"
import { forwardRef, Fragment, type MouseEvent, type ReactNode } from "react"

export interface TemplateGroupSelectorOptionProps {
	className?: string
	icon?: ReactNode
	isSelected: boolean
	label: ReactNode
	onClick?: (event: MouseEvent<HTMLButtonElement>) => void
	"data-testid"?: string
}

export const TemplateGroupSelectorOption = forwardRef<
	HTMLButtonElement,
	TemplateGroupSelectorOptionProps
>(function TemplateGroupSelectorOption(
	{ className, icon, isSelected, label, onClick, "data-testid": dataTestId, ...props },
	ref,
) {
	return (
		<Button
			ref={ref}
			type="button"
			variant={isSelected ? "outline" : "secondary"}
			size="default"
			className={cn(
				"h-9 shrink-0 gap-2 rounded-full border-2 border-transparent px-4 py-2 font-normal shadow-xs active:scale-[0.96]",
				isSelected && "border-primary bg-background text-primary",
				className,
			)}
			aria-pressed={isSelected}
			data-selected={isSelected}
			data-testid={dataTestId}
			onClick={onClick}
			{...props}
		>
			{icon}
			<span className="whitespace-nowrap text-sm leading-5">{label}</span>
		</Button>
	)
})

interface TemplateGroupSelectorProps {
	groups: OptionGroup[]
	selectedGroupKey: string
	onGroupChange: (groupKey: string) => void
	renderGroupIcon?: (group: OptionGroup) => ReactNode
	renderGroupOption?: (
		group: OptionGroup,
		optionProps: Omit<TemplateGroupSelectorOptionProps, "onClick">,
	) => ReactNode
	optionClassName?: string
	className?: string
	controlBackground?: string
	leftControlClassName?: string
	rightControlClassName?: string
	showEmptyGroups?: boolean
	"data-testid"?: string
}

const TemplateGroupSelector = observer(
	({
		groups,
		selectedGroupKey,
		onGroupChange,
		renderGroupIcon,
		renderGroupOption,
		optionClassName,
		className,
		controlBackground,
		leftControlClassName,
		rightControlClassName,
		showEmptyGroups = false,
		"data-testid": dataTestId = "template-group-selector",
	}: TemplateGroupSelectorProps) => {
		const lt = useLocaleText()
		return (
			<HeadlessHorizontalScroll
				className={cn(
					"relative flex w-full min-w-0 flex-shrink-0 items-center justify-center gap-2 overflow-hidden rounded-lg py-1",
					className,
				)}
				controlBackground={controlBackground}
				data-testid={dataTestId}
				renderLeftControl={({ scroll }) => (
					<div
						className={cn(
							"pointer-events-none absolute left-0 top-0 z-10 flex h-full w-14 items-center justify-start bg-[linear-gradient(to_right,_var(--control-background)_0%,_var(--control-background)_54%,_transparent_100%)] pl-1 max-md:hidden",
							leftControlClassName,
						)}
					>
						<Button
							type="button"
							variant="outline"
							size="icon"
							className="pointer-events-auto size-6 rounded-full border-border/50 bg-background/80 text-foreground shadow-xs backdrop-blur"
							onClick={() => scroll("left")}
						>
							<ChevronLeft className="size-4" />
						</Button>
					</div>
				)}
				renderRightControl={({ scroll }) => (
					<div
						className={cn(
							"pointer-events-none absolute right-0 top-0 z-10 flex h-full w-14 items-center justify-end bg-[linear-gradient(to_left,_var(--control-background)_0%,_var(--control-background)_54%,_transparent_100%)] max-md:hidden",
							rightControlClassName,
						)}
					>
						<Button
							type="button"
							variant="outline"
							size="icon"
							className="pointer-events-auto size-6 rounded-full border-border/50 bg-background/80 text-foreground shadow-xs backdrop-blur"
							onClick={() => scroll("right")}
						>
							<ChevronRight className="size-4" />
						</Button>
					</div>
				)}
				scrollContainerClassName="no-scrollbar flex w-full min-w-0 touch-pan-x items-center justify-start gap-2 overflow-x-auto overflow-y-hidden py-1 [&>*:first-child]:ml-1"
			>
				{groups.map((group) => {
					const isSelected = group.group_key === selectedGroupKey
					const iconNode = renderGroupIcon
						? renderGroupIcon(group)
						: group.group_icon && (
								<GroupIcon icon={group.group_icon} className="size-4 shrink-0" />
							)

					// if the group has no children, don't render the button
					if (!showEmptyGroups && group.children?.length === 0) {
						return null
					}

					const optionProps: Omit<TemplateGroupSelectorOptionProps, "onClick"> = {
						className: optionClassName,
						icon: iconNode,
						isSelected,
						label: lt(group.group_name),
						"data-testid": `${dataTestId}-option-${group.group_key}`,
					}
					const customOption = renderGroupOption?.(group, optionProps)
					return (
						<Fragment key={group.group_key}>
							{customOption ?? (
								<TemplateGroupSelectorOption
									{...optionProps}
									onClick={(event) => {
										onGroupChange(group.group_key)
										event.currentTarget.scrollIntoView({
											behavior: "smooth",
											inline: "center",
											block: "nearest",
										})
									}}
								/>
							)}
						</Fragment>
					)
				})}
			</HeadlessHorizontalScroll>
		)
	},
)

TemplateGroupSelector.displayName = "TemplateGroupSelector"

export default TemplateGroupSelector
