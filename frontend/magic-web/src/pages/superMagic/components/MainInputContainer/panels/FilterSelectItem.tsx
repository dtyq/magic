import { useState, useCallback, useEffect, type KeyboardEvent } from "react"
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
import { Input } from "@/components/shadcn-ui/input"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { cn } from "@/utils/cn"

import { useLocaleText } from "./hooks/useLocaleText"
import type { FieldItem, OptionItem } from "./types"
import { normalizeFieldCustomInputValue } from "./fieldCustomInput"
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
	const [desktopOpen, setDesktopOpen] = useState(false)
	const [customInputValue, setCustomInputValue] = useState("")

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
	const customInput = filter.custom_input
	const customInputPlaceholder = lt(customInput?.placeholder) || lt(filter.label)
	const customInputUnit = lt(customInput?.unit)
	const normalizedCustomInputValue = customInput
		? normalizeFieldCustomInputValue(customInputValue, customInput)
		: null
	const selectedDisplayValue =
		lt(selectedOption?.label) ||
		lt(selectedOption?.value) ||
		filter.current_value ||
		placeholder

	useEffect(() => {
		if (!customInput || !filter.current_value || selectedOption) {
			setCustomInputValue("")
			return
		}

		setCustomInputValue(filter.current_value)
	}, [customInput, filter.current_value, selectedOption])

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

	const handleSubmitCustomInput = useCallback(() => {
		if (normalizedCustomInputValue === null) return

		onFilterChange?.(filter.data_key, normalizedCustomInputValue)
		setDrawerOpen(false)
		setDesktopOpen(false)
	}, [filter.data_key, normalizedCustomInputValue, onFilterChange])

	const handleCustomInputKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			event.stopPropagation()
			if (event.key !== "Enter") return

			event.preventDefault()
			handleSubmitCustomInput()
		},
		[handleSubmitCustomInput],
	)

	const customInputControl = customInput ? (
		<div
			className={cn("flex items-center gap-2", isMobile ? "w-full" : "w-[248px]")}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={(event) => event.stopPropagation()}
		>
			<div
				className={cn(
					"flex min-w-0 flex-1 items-center rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring/20",
					isMobile ? "h-10" : "h-8",
					customInputValue && normalizedCustomInputValue === null && "border-destructive",
				)}
			>
				<Input
					aria-label={customInputPlaceholder}
					type={customInput.type}
					inputMode={customInput.integer ? "numeric" : "decimal"}
					min={customInput.min}
					max={customInput.max}
					step={customInput.step ?? (customInput.integer ? 1 : undefined)}
					value={customInputValue}
					onChange={(event) => setCustomInputValue(event.target.value)}
					onKeyDown={handleCustomInputKeyDown}
					placeholder={customInputPlaceholder}
					aria-invalid={Boolean(customInputValue && normalizedCustomInputValue === null)}
					className="h-full min-w-0 flex-1 rounded-lg border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
				/>
				{customInputUnit ? (
					<span className="shrink-0 whitespace-nowrap pr-3 text-sm text-muted-foreground">
						{customInputUnit}
					</span>
				) : null}
			</div>
			<Button
				type="button"
				size="sm"
				disabled={normalizedCustomInputValue === null}
				onClick={handleSubmitCustomInput}
				className={cn(
					"shrink-0 rounded-lg px-3 text-sm font-medium shadow-none",
					isMobile ? "h-10" : "h-8",
				)}
			>
				{t("actionDrawer.confirm")}
			</Button>
		</div>
	) : null

	if (availableOptions.length === 0 && !customInput) {
		return null
	}

	if (isMobile) {
		return (
			<div className={cn("flex flex-col items-start gap-1", isCompactMobile && "block")}>
				{isCompactMobile ? null : (
					<Label
						className={cn(
							"text-xs font-medium text-muted-foreground",
							!isCompactMobile && "ml-3",
						)}
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
								{selectedDisplayValue}
							</span>
						</>
					) : (
						<span className={cn(!hasSelection && "text-muted-foreground")}>
							{selectedDisplayValue}
						</span>
					)}
					<span className="relative inline-flex size-4 shrink-0 items-center justify-center">
						{hasSelection ? (
							<span
								role="button"
								tabIndex={0}
								aria-label={clearText}
								className={cn(
									"inline-flex items-center justify-center rounded-full text-muted-foreground/70",
									isCompactMobile && "-m-2 size-8 active:bg-muted",
								)}
								onPointerDown={(event) => {
									event.preventDefault()
									event.stopPropagation()
								}}
								onClick={(event) => {
									event.preventDefault()
									event.stopPropagation()
									handleClear()
								}}
								onKeyDown={(event) => {
									if (event.key !== "Enter" && event.key !== " ") return
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
					className="rounded-t-[14px] border-0 bg-muted supports-[overflow:clip]:overflow-clip"
					bodyClassName="rounded-t-[14px] border-0 bg-muted p-0 overflow-hidden supports-[overflow:clip]:overflow-clip"
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

						{/* Grid stretch keeps the viewport within the popup's content-driven height cap. */}
						<ScrollArea
							className="grid min-h-0"
							viewportClassName="h-auto min-h-0 px-3 pb-5 [&>div]:!block"
						>
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
							{customInputControl ? (
								<div className="mt-3 border-t border-border pt-3">
									{customInputControl}
								</div>
							) : null}
						</ScrollArea>
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
				open={desktopOpen}
				onOpenChange={setDesktopOpen}
				value={filter.current_value || ""}
				onValueChange={(value) => onFilterChange?.(filter.data_key, value)}
			>
				<SelectTrigger
					id={filter.data_key}
					className={cn(
						"group !h-8 w-fit rounded-full bg-background text-foreground dark:!bg-card",
						"focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0",
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
					<SelectValue placeholder={placeholder}>{selectedDisplayValue}</SelectValue>
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
				{/* Keep long filter lists within the visible viewport while preserving keyboard and wheel scrolling. */}
				<SelectContent
					align="start"
					showScrollButtons={false}
					className={cn(
						"max-h-[min(520px,var(--radix-select-content-available-height))]",
						customInputControl &&
							"w-[272px] min-w-[272px] overflow-hidden rounded-xl border-border/80 p-0 shadow-lg",
					)}
					viewportClassName={cn(
						"max-h-[min(520px,var(--radix-select-content-available-height))] overflow-y-auto",
						customInputControl && "p-1.5",
					)}
				>
					{availableOptions.length > 0 ? (
						availableOptions.map(({ option, optionValue }) => {
							return (
								<SelectItem
									key={optionValue}
									value={optionValue}
									className={cn(customInputControl && "h-9 rounded-lg pl-3 pr-8")}
								>
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
					{customInputControl ? (
						<div className="-mx-1.5 -mb-1.5 mt-1 border-t border-border/70 bg-muted/30 p-2.5">
							{customInputControl}
						</div>
					) : null}
				</SelectContent>
			</Select>
		</div>
	)
}

export default observer(FilterSelectItem)
