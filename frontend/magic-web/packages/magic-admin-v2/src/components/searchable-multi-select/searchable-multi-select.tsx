import { Check, ChevronDown, Loader2, X } from "lucide-react"
import { useMemo, useState } from "react"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@magic-admin-v2/components/ui/popover"
import { cn } from "@magic-admin-v2/utils/cn"

export type SearchableMultiSelectOption = {
	/** 是否禁止选择该选项；已选中的禁用选项仍可移除。 */
	disabled?: boolean
	/** 禁用状态下的补充说明。 */
	disabledLabel?: string
	/** 选项主文案。 */
	label: string
	/** 额外参与搜索匹配的文本。 */
	searchText?: string
	/** 选项下方或旁侧展示的辅助文案。 */
	secondaryLabel?: string
	/** 选项的稳定业务值。 */
	value: string
}

/** 可搜索多选组件的受控配置。 */
export type SearchableMultiSelectProps = {
	/** 触发器的无障碍标签。 */
	ariaLabel: string
	/** 触发器容器的自定义样式。 */
	className?: string
	/** Stable selectors for the trigger, menu, options, and states. */
	triggerTestId?: string
	contentTestId?: string
	searchInputTestId?: string
	searchClearButtonTestId?: string
	optionTestId?: string
	loadingTestId?: string
	emptyTestId?: string
	clearButtonTestId?: string
	/** 清空搜索和移除选项操作使用的文案。 */
	clearLabel: string
	/** 下拉内容容器的自定义样式。 */
	contentClassName?: string
	/** 是否禁用打开、搜索和选项变更。 */
	disabled?: boolean
	/** 没有任何选中项时的占位文案。 */
	emptyLabel: string
	/** 是否展示加载状态。 */
	isLoading?: boolean
	/** 下拉内容是否匹配触发器宽度。 */
	matchTriggerWidth?: boolean
	/** 受控的下拉打开状态；不传时组件自行维护。 */
	open?: boolean
	/** 触发器最多展示的已选项数量，超出部分显示为数量汇总。 */
	maxVisibleItems?: number
	/** 搜索后没有匹配项时的文案。 */
	noMatchingLabel: string
	/** 选中值变化回调；组件本身不持久化选择结果。 */
	onChange: (value: string[]) => void
	/** 下拉面板打开状态变化回调。 */
	onOpenChange?: (open: boolean) => void
	/** 可搜索选项列表。 */
	options: SearchableMultiSelectOption[]
	/** 搜索输入框占位文案。 */
	searchPlaceholder: string
	/** 已选数量汇总文案生成器。 */
	selectedCountLabel: (count: number) => string
	/** 当前选中的选项值。 */
	value: string[]
}

export function SearchableMultiSelect({
	ariaLabel,
	className,
	clearButtonTestId,
	contentTestId,
	loadingTestId,
	emptyTestId,
	optionTestId,
	searchClearButtonTestId,
	searchInputTestId,
	triggerTestId,
	clearLabel,
	contentClassName,
	disabled = false,
	emptyLabel,
	isLoading = false,
	matchTriggerWidth = true,
	maxVisibleItems = 3,
	open: controlledOpen,
	noMatchingLabel,
	onChange,
	onOpenChange,
	options,
	searchPlaceholder,
	selectedCountLabel,
	value,
}: SearchableMultiSelectProps) {
	const [keyword, setKeyword] = useState("")
	const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
	const open = controlledOpen ?? uncontrolledOpen
	const normalizedKeyword = keyword.trim().toLocaleLowerCase()
	const optionMap = useMemo(
		() => new Map(options.map((option) => [option.value, option])),
		[options],
	)
	const selectedOptions = useMemo(
		() =>
			value.map(
				(selectedValue) =>
					optionMap.get(selectedValue) ?? {
						label: selectedValue,
						value: selectedValue,
					},
			),
		[optionMap, value],
	)
	const filteredOptions = useMemo(
		() =>
			options.filter((option) => {
				if (!normalizedKeyword) {
					return true
				}

				return [option.label, option.secondaryLabel, option.searchText]
					.filter(Boolean)
					.join(" ")
					.toLocaleLowerCase()
					.includes(normalizedKeyword)
			}),
		[normalizedKeyword, options],
	)
	const visibleSelectedOptions = selectedOptions.slice(0, maxVisibleItems)
	const hiddenSelectedCount = selectedOptions.length - visibleSelectedOptions.length

	function handleOpenChange(nextOpen: boolean) {
		if (disabled && nextOpen) {
			return
		}
		if (controlledOpen === undefined) {
			setUncontrolledOpen(nextOpen)
		}
		if (!nextOpen) {
			setKeyword("")
		}
		onOpenChange?.(nextOpen)
	}

	function removeOption(selectedValue: string) {
		onChange(value.filter((currentValue) => currentValue !== selectedValue))
	}

	function toggleOption(option: SearchableMultiSelectOption) {
		if (disabled) {
			return
		}
		const selected = value.includes(option.value)
		if (option.disabled && !selected) {
			return
		}

		onChange(
			selected
				? value.filter((currentValue) => currentValue !== option.value)
				: [...value, option.value],
		)
	}

	return (
		<Popover
			className={cn("min-w-0 max-w-full", className)}
			onOpenChange={handleOpenChange}
			open={open}
		>
			<PopoverTrigger
				aria-haspopup="listbox"
				aria-label={ariaLabel}
				data-testid={triggerTestId}
				aria-busy={isLoading || undefined}
				className={cn(
					"flex min-h-9 w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-md border border-input bg-background px-2.5 py-1.5 text-left text-sm shadow-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring",
					open && "border-primary/60 ring-2 ring-primary/15",
					disabled && "cursor-not-allowed opacity-60",
				)}
				disabled={disabled}
			>
				<span className="flex w-0 min-w-0 flex-1 flex-nowrap items-center gap-1.5 overflow-hidden">
					{visibleSelectedOptions.length > 0 ? (
						visibleSelectedOptions.map((option) => (
							<span
								className="inline-flex h-6 min-w-0 max-w-32 shrink items-center gap-1 overflow-hidden rounded border border-border bg-muted px-1.5 text-xs font-medium text-foreground"
								key={option.value}
							>
								<span className="min-w-0 flex-1 truncate">{option.label}</span>
								<span
									aria-label={`${clearLabel}: ${option.label}`}
									className="-mr-1 inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
									onKeyDown={(event) => {
										if (event.key !== "Enter" && event.key !== " ") {
											return
										}
										event.preventDefault()
										event.stopPropagation()
										removeOption(option.value)
									}}
									onPointerDown={(event) => {
										event.preventDefault()
										event.stopPropagation()
										removeOption(option.value)
									}}
									role="button"
									tabIndex={0}
								>
									<X aria-hidden="true" className="size-3" />
								</span>
							</span>
						))
					) : (
						<span className="truncate text-muted-foreground">{emptyLabel}</span>
					)}
					{hiddenSelectedCount > 0 ? (
						<span className="inline-flex h-6 shrink-0 items-center rounded border bg-background px-1.5 text-xs text-muted-foreground">
							+{hiddenSelectedCount}
						</span>
					) : null}
				</span>
				{isLoading ? (
					<Loader2
						aria-hidden="true"
						className="size-4 shrink-0 animate-spin text-muted-foreground"
					/>
				) : (
					<ChevronDown
						aria-hidden="true"
						className={cn(
							"size-4 shrink-0 text-muted-foreground transition-transform",
							open && "rotate-180",
						)}
					/>
				)}
			</PopoverTrigger>
			<PopoverContent
				align="start"
				data-testid={contentTestId}
				className={cn(
					"z-[100] max-w-[calc(100vw-1.5rem)] overflow-hidden p-0",
					!matchTriggerWidth && "w-[min(360px,calc(100vw-1.5rem))]",
					contentClassName,
				)}
				matchTriggerWidth={matchTriggerWidth}
			>
				<div className="border-b p-3">
					<FilterSearchInput
						autoFocus
						clearLabel={clearLabel}
						clearButtonTestId={searchClearButtonTestId}
						disabled={disabled}
						inputTestId={searchInputTestId}
						onValueChange={setKeyword}
						placeholder={searchPlaceholder}
						value={keyword}
					/>
				</div>
				<div
					aria-multiselectable="true"
					className="max-h-72 min-h-0 overflow-y-auto overscroll-contain p-1.5"
					onWheel={(event) => event.stopPropagation()}
					role="listbox"
				>
					{isLoading && options.length === 0 ? (
						<div
							className="flex min-h-24 items-center justify-center text-muted-foreground"
							data-testid={loadingTestId}
						>
							<Loader2 aria-hidden="true" className="size-4 animate-spin" />
						</div>
					) : filteredOptions.length > 0 ? (
						filteredOptions.map((option) => {
							const selected = value.includes(option.value)
							const selectionDisabled = disabled || (option.disabled && !selected)

							return (
								<button
									aria-selected={selected}
											data-testid={optionTestId}
									className={cn(
										"flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
										selected && "bg-accent/70",
									)}
									disabled={selectionDisabled}
									key={option.value}
									onClick={() => toggleOption(option)}
									role="option"
									type="button"
								>
									<span
										className={cn(
											"flex size-4 shrink-0 items-center justify-center rounded border",
											selected
												? "border-primary bg-primary text-primary-foreground"
												: "border-input bg-background",
										)}
									>
										{selected ? (
											<Check aria-hidden="true" className="size-3" />
										) : null}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium">
											{option.label}
										</span>
										{option.secondaryLabel ? (
											<span className="block truncate text-xs text-muted-foreground">
												{option.secondaryLabel}
											</span>
										) : null}
									</span>
									{option.disabledLabel ? (
										<span className="shrink-0 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
											{option.disabledLabel}
										</span>
									) : null}
								</button>
							)
						})
					) : (
						<div
							className="flex min-h-24 items-center justify-center px-4 text-center text-sm text-muted-foreground"
							data-testid={emptyTestId}
						>
							{noMatchingLabel}
						</div>
					)}
				</div>
				<div className="flex items-center justify-between gap-3 border-t px-3 py-2.5">
					<span className="truncate text-xs text-muted-foreground">
						{selectedCountLabel(value.length)}
					</span>
					<Button
						className="shrink-0"
						data-testid={clearButtonTestId}
						disabled={disabled || value.length === 0}
						onClick={() => onChange([])}
						size="sm"
						type="button"
						variant="ghost"
					>
						{clearLabel}
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}
