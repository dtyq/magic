import { Check, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@magic-admin-v2/components/ui/popover"
import type { FilterOption } from "@magic-admin-v2/features/platform-model-list/utils/model-list"
import { cn } from "@magic-admin-v2/utils/cn"

export function MultiSelectFilter<T extends string | number>({
	allLabel,
	ariaLabel,
	onChange,
	options,
	value,
	triggerTestId,
	contentTestId,
	optionTestId,
	clearButtonTestId,
}: {
	allLabel: string
	ariaLabel: string
	onChange: (value: T[]) => void
	options: Array<FilterOption<T>>
	value: T[]
	triggerTestId?: string
	contentTestId?: string
	optionTestId?: string
	clearButtonTestId?: string
}) {
	const { t } = useTranslation()
	const selectedLabels = options
		.filter((option) => value.includes(option.value))
		.map((option) => option.label)
	const triggerLabel = selectedLabels.length ? selectedLabels.join("、") : allLabel

	function toggleOption(nextValue: T) {
		onChange(
			value.includes(nextValue)
				? value.filter((item) => item !== nextValue)
				: [...value, nextValue],
		)
	}

	return (
		<Popover>
			<PopoverTrigger
				aria-label={ariaLabel}
				data-testid={triggerTestId ?? "platform-model-filter-trigger"}
				className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm font-normal shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				<span className="truncate">{triggerLabel}</span>
				<ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			</PopoverTrigger>
			<PopoverContent
				data-testid={contentTestId ?? "platform-model-list-platform-model-filter-content"}
				align="start"
				className="z-[60] w-64 p-1.5"
			>
				<div className="grid gap-0.5">
					{options.map((option) => {
						const isSelected = value.includes(option.value)

						return (
							<button
								aria-checked={isSelected}
								data-testid={optionTestId ?? "platform-model-filter-option"}
								className={cn(
									"flex min-h-9 items-center gap-2 rounded-sm px-2 text-left text-sm transition-colors hover:bg-accent",
									isSelected && "bg-accent text-accent-foreground",
								)}
								key={String(option.value)}
								onClick={() => toggleOption(option.value)}
								role="checkbox"
								type="button"
							>
								<span
									className={cn(
										"inline-flex size-4 shrink-0 items-center justify-center rounded-sm border",
										isSelected
											? "border-primary bg-primary text-primary-foreground"
											: "border-input",
									)}
								>
									{isSelected ? (
										<Check className="size-3" aria-hidden="true" />
									) : null}
								</span>
								<span className="min-w-0 truncate">{option.label}</span>
							</button>
						)
					})}
				</div>
				{value.length ? (
					<div className="mt-1 border-t pt-1">
						<Button
							className="w-full justify-start"
							data-testid={clearButtonTestId ?? "platform-model-list-action-button"}
							onClick={() => onChange([])}
							size="sm"
							variant="ghost"
						>
							{t("common.clear")}
						</Button>
					</div>
				) : null}
			</PopoverContent>
		</Popover>
	)
}
