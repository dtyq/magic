import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import { Check, ChevronDown, Filter } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuTrigger,
	DropdownMenuContent,
	DropdownMenuItem,
} from "@/components/shadcn-ui/dropdown-menu"
import { toggleTopicType, type TopicTypeFilterValue } from "../../utils/topicTypeFilter"

export interface TopicTypeFilterProps {
	/** Borderless, height-7 trigger for toolbars. */
	compact?: boolean
	value: TopicTypeFilterValue
	onChange: (value: TopicTypeFilterValue) => void
}

/** Shared controlled multi-select; membership is always decided by the list API. */
export default function TopicTypeFilter({
	value,
	onChange,
	compact = false,
}: TopicTypeFilterProps) {
	const { t } = useTranslation("super")
	const options = [
		{ value: "all" as const, label: t("topicTypeFilter.all") },
		{ value: "topic" as const, label: t("topicTypeFilter.topic") },
		{ value: "scheduled_task" as const, label: t("topicTypeFilter.scheduledTask") },
	]

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant={compact ? "ghost" : "outline"}
					size="sm"
					className={cn(
						"cursor-pointer justify-between gap-1",
						compact ? "h-7 max-w-32 shrink-0 px-2 text-xs" : "w-full",
					)}
					aria-label={t("topicTypeFilter.label")}
					data-testid="topic-type-filter-trigger"
				>
					<Filter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
					<span className="min-w-0 flex-1 truncate text-left">
						{options.find((option) => option.value === value)?.label}
					</span>
					<ChevronDown className="size-4 shrink-0" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={compact ? "end" : "start"}
				className={
					compact ? "min-w-44" : "min-w-[var(--radix-dropdown-menu-trigger-width)]"
				}
			>
				{options.map((option) => {
					const checked = value === "all" || value === option.value
					// "all" is the reset row; a row that is already the sole selection has nothing to narrow.
					const canShowOnly = option.value !== "all" && value !== option.value
					return (
						// Not DropdownMenuCheckboxItem: its built-in check indicator can't be
						// swapped for a checkbox box, so role/aria-checked are set by hand.
						<DropdownMenuItem
							key={option.value}
							role="menuitemcheckbox"
							aria-checked={checked}
							// The shared item defaults to cursor-default; these rows are clickable toggles.
							className="group cursor-pointer gap-2"
							// Keep the menu open so several types can be toggled in a row.
							onSelect={(event) => {
								event.preventDefault()
								onChange(toggleTopicType(value, option.value))
							}}
						>
							<span
								aria-hidden
								className={cn(
									"flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input shadow-xs dark:bg-input/30",
									checked && "border-primary bg-primary text-primary-foreground",
								)}
							>
								{checked && <Check className="size-3.5" />}
							</span>
							<span className="min-w-0 flex-1 truncate">{option.label}</span>
							{canShowOnly && (
								// Revealed on hover / keyboard highlight to keep the idle menu quiet.
								<button
									type="button"
									tabIndex={-1}
									className="pointer-events-none shrink-0 cursor-pointer rounded-sm px-1.5 py-0.5 text-xs text-primary opacity-0 transition-opacity hover:bg-primary/10 group-hover:pointer-events-auto group-hover:opacity-100 group-data-[highlighted]:pointer-events-auto group-data-[highlighted]:opacity-100"
									aria-label={t("topicTypeFilter.onlyLabel", {
										name: option.label,
									})}
									onClick={(event) => {
										// Avoid triggering the row's own toggle.
										event.stopPropagation()
										event.preventDefault()
										onChange(option.value)
									}}
								>
									{t("topicTypeFilter.only")}
								</button>
							)}
						</DropdownMenuItem>
					)
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
