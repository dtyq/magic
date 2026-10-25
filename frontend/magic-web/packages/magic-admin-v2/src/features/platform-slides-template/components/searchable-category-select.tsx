import { Check, ChevronsUpDown, Loader2, X } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import { Popover, PopoverContent, PopoverTrigger } from "@magic-admin-v2/components/ui/popover"
import type { SlidesTemplateCategory } from "@magic-admin-v2/features/platform-slides-template/types"
import { resolveSlidesTemplateCategoryName } from "@magic-admin-v2/features/platform-slides-template/utils"
import { cn } from "@magic-admin-v2/utils/cn"

type SearchableCategorySelectProps = {
	ariaLabel?: string
	className?: string
	clearButtonTestId?: string
	contentTestId?: string
	emptyLabel?: string
	emptyTestId?: string
	isLoading?: boolean
	loadingTestId?: string
	noMatchingLabel?: string
	optionTestId?: string
	onChange: (value: string) => void
	onOpenChange?: (open: boolean) => void
	options: SlidesTemplateCategory[]
	searchPlaceholder?: string
	triggerTestId?: string
	inputTestId?: string
	clearSearchButtonTestId?: string
	value: string
}

export function SearchableCategorySelect({
	ariaLabel,
	className,
	clearButtonTestId,
	contentTestId,
	emptyLabel,
	emptyTestId,
	isLoading = false,
	loadingTestId,
	noMatchingLabel,
	optionTestId,
	onChange,
	onOpenChange,
	options,
	searchPlaceholder,
	triggerTestId,
	inputTestId,
	clearSearchButtonTestId,
	value,
}: SearchableCategorySelectProps) {
	const { t } = useTranslation()
	const [keyword, setKeyword] = useState("")
	const [open, setOpen] = useState(false)
	const selectedCategory = options.find((category) => category.code === value)
	const normalizedKeyword = keyword.trim().toLocaleLowerCase()
	const filteredOptions = useMemo(
		() =>
			options.filter((category) => {
				if (!normalizedKeyword) return true
				return `${category.name_i18n.zh_CN} ${category.name_i18n.en_US} ${category.code}`
					.toLocaleLowerCase()
					.includes(normalizedKeyword)
			}),
		[normalizedKeyword, options],
	)

	const handleOpenChange = (nextOpen: boolean) => {
		setOpen(nextOpen)
		if (!nextOpen) setKeyword("")
		onOpenChange?.(nextOpen)
	}

	return (
		<div className={cn("relative", className)}>
			<Popover onOpenChange={handleOpenChange} open={open}>
				<PopoverTrigger data-testid={triggerTestId ?? "platform-slides-template-category-trigger"}
					aria-haspopup="listbox"
					aria-label={ariaLabel ?? t("slidesTemplate.form.category")}
					className={cn(
						"flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-left text-sm shadow-sm outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring",
						value ? "pr-16" : "pr-9",
					)}
				>
					<span className={cn("truncate", !selectedCategory && "text-muted-foreground")}>
						{selectedCategory
							? resolveSlidesTemplateCategoryName(selectedCategory)
							: (emptyLabel ?? t("slidesTemplate.form.selectCategory"))}
					</span>
					<ChevronsUpDown
						aria-hidden="true"
						className="absolute right-3 size-4 shrink-0 text-muted-foreground"
					/>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					className="z-[100] w-[min(420px,calc(100vw-3rem))] overflow-hidden p-0"
				 data-testid={contentTestId ?? "platform-slides-template-filter-content"}>
					<div className="border-b p-3">
						<FilterSearchInput
							autoFocus
							clearLabel={t("common.clear")}
							onValueChange={setKeyword}
							placeholder={
								searchPlaceholder ?? t("slidesTemplate.form.searchCategories")
							}
							value={keyword}
						 inputTestId={inputTestId ?? "platform-slides-template-search-input"} clearButtonTestId={clearSearchButtonTestId ?? "platform-slides-template-search-clear-button"}/>
					</div>
					<div
						className="max-h-64 overflow-y-auto overscroll-contain p-1.5"
						role="listbox"
					>
						{isLoading && options.length === 0 ? (
							<div className="flex h-20 items-center justify-center text-muted-foreground" data-testid={loadingTestId}>
								<Loader2 aria-hidden="true" className="size-4 animate-spin" />
							</div>
						) : filteredOptions.length > 0 ? (
							filteredOptions.map((category) => (
								<button data-testid={optionTestId ?? "platform-slides-template-category-option"}
									aria-selected={category.code === value}
									className={cn(
										"flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent",
										category.code === value && "bg-accent/70",
									)}
									key={category.id}
									onClick={() => {
										onChange(category.code)
										handleOpenChange(false)
									}}
									role="option"
									type="button"
								>
									<span className="min-w-0 flex-1">
										<span className="block truncate font-medium">
											{resolveSlidesTemplateCategoryName(category)}
										</span>
										<span className="block truncate text-xs text-muted-foreground">
											{category.code}
										</span>
									</span>
									{category.code === value ? (
										<Check aria-hidden="true" className="size-4 shrink-0" />
									) : null}
								</button>
							))
						) : (
							<div className="flex h-20 items-center justify-center px-4 text-center text-sm text-muted-foreground" data-testid={emptyTestId}>
								{noMatchingLabel ?? t("slidesTemplate.form.noMatchingCategories")}
							</div>
						)}
					</div>
				</PopoverContent>
			</Popover>
			{value ? (
				<button data-testid={clearButtonTestId ?? "platform-slides-template-category-clear-button"}
					aria-label={t("common.clear")}
					className="absolute right-8 top-1/2 z-10 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					onClick={(event) => {
						event.stopPropagation()
						onChange("")
						handleOpenChange(false)
					}}
					type="button"
				>
					<X aria-hidden="true" className="size-3.5" />
				</button>
			) : null}
		</div>
	)
}
