import { useState, useCallback } from "react"
import { ChevronDown, CircleX, X } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Label } from "@/components/shadcn-ui/label"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { cn } from "@/lib/utils"

import { useLocaleText } from "./hooks/useLocaleText"
import type { FieldItem, OptionItem } from "./types"
import { isOptionGroup, localeTextToDisplayString } from "./utils"
import { ScenePanelVariant } from "../components/LazyScenePanel/types"
import { observer } from "mobx-react-lite"

interface FilterSelectItemProps {
	filter: FieldItem
	onFilterChange?: (filterId: string, value: string) => void
	variant?: ScenePanelVariant
	compact?: boolean
}

/**
 * FilterSelectItem - renders a single filter field.
 * Desktop: shadcn Select dropdown.
 * Mobile: MagicPopup with option list.
 */
function FilterSelectItem({
	filter,
	onFilterChange,
	variant,
	compact = false,
}: FilterSelectItemProps) {
	const { t } = useTranslation("shadcn-ui")
	const lt = useLocaleText()
	const autoText = t("select.placeholder")
	const placeholder = lt(filter.placeholder) || autoText
	const clearText = t("select.clear")
	const emptyText = t("select.empty")
	const cancelText = t("actionDrawer.cancel")

	const isMobile = variant === ScenePanelVariant.Mobile
	const isCompactMobile = compact && isMobile

	const [drawerOpen, setDrawerOpen] = useState(false)

	const flatOptions = filter.options.filter((opt): opt is OptionItem => !isOptionGroup(opt))
	const availableOptions = flatOptions
		.map((option) => ({
			option,
			optionValue: localeTextToDisplayString(option.value),
		}))
		.filter(({ optionValue }) => Boolean(optionValue))
	const hasSelection = Boolean(filter.current_value)

	const selectedOption =
		availableOptions.find(({ optionValue }) => optionValue === filter.current_value)?.option ||
		null

	const handleOpenDrawer = useCallback(() => {
		setDrawerOpen(true)
	}, [])

	const handleSelectOption = useCallback(
		(value: string) => {
			onFilterChange?.(filter.data_key, value)
			setDrawerOpen(false)
		},
		[filter.data_key, onFilterChange],
	)

	const handleClear = useCallback(() => {
		onFilterChange?.(filter.data_key, "")
		setDrawerOpen(false)
	}, [filter.data_key, onFilterChange])

	const handleCloseDrawer = useCallback(() => {
		setDrawerOpen(false)
	}, [])

	if (availableOptions.length === 0) {
		return null
	}

	if (isMobile) {
		return (
			<div className={cn("flex flex-col items-start gap-1", isCompactMobile && "block")}>
				{isCompactMobile ? null : (
					<Label
						className="text-xs font-medium text-muted-foreground"
						onClick={handleOpenDrawer}
					>
						{lt(filter.label)}
					</Label>
				)}

				{/* Trigger button - styled like Select trigger */}
				<button
					type="button"
					onClick={handleOpenDrawer}
					className={cn(
						"group flex h-8 items-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm shadow-xs dark:bg-card",
						isCompactMobile &&
							"min-h-8 shrink-0 gap-1 border-border bg-card pl-2.5 pr-2 shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] dark:bg-card",
					)}
					aria-label={lt(filter.label)}
					data-testid="mobile-scene-panel-filter-trigger"
				>
					{filter.has_leading_icon && filter.leading_icon && (
						<LucideLazyIcon
							icon={filter.leading_icon}
							size={16}
							className="text-muted-foreground"
						/>
					)}
					{isCompactMobile ? (
						<>
							<span className="whitespace-nowrap text-[11px] text-muted-foreground">
								{lt(filter.label)}
							</span>
							<span className="whitespace-nowrap text-[13px] font-medium text-foreground">
								{lt(selectedOption?.label) ||
									lt(selectedOption?.value) ||
									filter.current_value ||
									placeholder}
							</span>
						</>
					) : (
						<span className={cn(!hasSelection && "text-muted-foreground")}>
							{lt(selectedOption?.label) ||
								lt(selectedOption?.value) ||
								filter.current_value ||
								placeholder}
						</span>
					)}
					<span className="relative inline-flex size-4 shrink-0 items-center justify-center">
						{hasSelection && !isCompactMobile ? (
							<span
								role="button"
								tabIndex={0}
								aria-label={clearText}
								onPointerDown={(event) => {
									event.preventDefault()
									event.stopPropagation()
								}}
								onClick={(event) => {
									event.preventDefault()
									event.stopPropagation()
									handleClear()
								}}
							>
								<CircleX className="size-4 text-muted-foreground opacity-50" />
							</span>
						) : (
							<ChevronDown
								className={cn("size-4 text-muted-foreground opacity-50")}
							/>
						)}
					</span>
				</button>

				<MagicPopup
					visible={drawerOpen}
					onClose={handleCloseDrawer}
					className="rounded-t-[14px] border-0 bg-muted"
					bodyClassName="rounded-t-[14px] border-0 bg-muted p-0 overflow-hidden"
					handlerClassName="bg-muted-foreground mb-1.5 h-1 w-20 rounded-full"
					title={lt(filter.label)}
				>
					<div
						className="flex max-h-[min(520px,calc(100vh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom)-44px))] flex-col gap-2 overflow-hidden bg-muted"
						data-testid="mobile-scene-panel-filter-popup"
					>
						<div className="relative flex h-14 shrink-0 flex-row items-center justify-center">
							<button
								type="button"
								onClick={handleCloseDrawer}
								className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-card"
								style={{ boxShadow: "0px 8px 25px 0px rgba(0,0,0,0.10)" }}
								aria-label={cancelText}
								data-testid="mobile-scene-panel-filter-popup-close-button"
							>
								<X className="h-[22px] w-[22px] text-foreground" />
							</button>
							<div
								className="max-w-[247px] truncate text-center text-lg font-semibold leading-none text-foreground"
								data-testid="mobile-scene-panel-filter-popup-title"
							>
								{lt(filter.label)}
							</div>
						</div>

						<div className="overflow-y-auto px-3 pb-5">
							<div className="flex flex-col gap-1">
								{availableOptions.length > 0 ? (
									availableOptions.map(({ option, optionValue }) => {
										const isSelected = optionValue === filter.current_value
										const optionLabel =
											lt(option.label) ?? lt(option.value) ?? optionValue
										return (
											<button
												key={optionValue}
												type="button"
												onClick={() => handleSelectOption(optionValue)}
												className={cn(
													"flex h-12 w-full items-center gap-3 rounded-full px-4",
													"relative cursor-pointer text-left text-base font-medium text-foreground transition-all duration-200",
													isSelected &&
														"bg-card shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]",
													!isSelected &&
														"[@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent/60",
												)}
												data-testid="mobile-scene-panel-filter-popup-option"
												data-selected={isSelected}
												aria-label={optionLabel}
											>
												<span className="min-w-0 flex-1 truncate text-left">
													{optionLabel}
												</span>
											</button>
										)
									})
								) : (
									<div className="flex min-h-24 items-center justify-center px-4 py-6 text-sm text-muted-foreground">
										{emptyText}
									</div>
								)}
							</div>
						</div>
					</div>
				</MagicPopup>
			</div>
		)
	}

	// Desktop: shadcn Select
	return (
		<div className="flex items-center gap-2">
			<Label htmlFor={filter.data_key} className="text-sm font-normal text-foreground">
				{lt(filter.label)}
			</Label>
			<Select
				value={filter.current_value || ""}
				onValueChange={(value) => onFilterChange?.(filter.data_key, value)}
			>
				<SelectTrigger
					id={filter.data_key}
					className={cn(
						"group !h-8 w-fit rounded-full bg-background text-foreground dark:!bg-card",
						hasSelection && "[&>svg:last-child]:hidden",
					)}
				>
					{filter.has_leading_icon && filter.leading_icon && (
						<LucideLazyIcon
							icon={filter.leading_icon}
							size={16}
							className="text-muted-foreground"
						/>
					)}
					<SelectValue placeholder={placeholder} />
					{hasSelection && (
						<span className="relative inline-flex size-4 shrink-0 items-center justify-center">
							<ChevronDown className="size-4 text-muted-foreground opacity-50 transition-opacity group-focus-within:opacity-0 group-hover:opacity-0" />
							<span
								role="button"
								tabIndex={0}
								aria-label={clearText}
								className="absolute inset-0 inline-flex items-center justify-center text-muted-foreground/70 opacity-0 transition-opacity group-focus-within:opacity-90 group-hover:opacity-90"
								onPointerDown={(event) => {
									event.preventDefault()
									event.stopPropagation()
								}}
								onClick={(event) => {
									event.preventDefault()
									event.stopPropagation()
									handleClear()
								}}
							>
								<CircleX className="size-4" />
							</span>
						</span>
					)}
				</SelectTrigger>
				<SelectContent>
					{availableOptions.length > 0 ? (
						availableOptions.map(({ option, optionValue }) => {
							return (
								<SelectItem key={optionValue} value={optionValue}>
									<span>
										{lt(option.label) ?? lt(option.value) ?? optionValue}
									</span>
								</SelectItem>
							)
						})
					) : (
						<div className="px-2 py-6 text-center text-sm text-muted-foreground">
							{emptyText}
						</div>
					)}
				</SelectContent>
			</Select>
		</div>
	)
}

export default observer(FilterSelectItem)
