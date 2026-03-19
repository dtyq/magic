import { useState, useCallback } from "react"
import { ChevronDown, CircleX } from "lucide-react"
import { useTranslation } from "react-i18next"

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Label } from "@/components/shadcn-ui/label"
import { ActionDrawer } from "@/components/shadcn-composed/action-drawer"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { cn } from "@/lib/utils"

import { useLocaleText } from "./hooks/useLocaleText"
import type { FieldItem, OptionItem } from "./types"
import { isOptionGroup, localeTextToDisplayString } from "./utils"
import { ScenePanelVariant } from "../components/LazyScenePanel/types"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { observer } from "mobx-react-lite"

interface FilterSelectItemProps {
	filter: FieldItem
	onFilterChange?: (filterId: string, value: string) => void
	variant?: ScenePanelVariant
}

/**
 * FilterSelectItem - renders a single filter field.
 * Desktop: shadcn Select dropdown.
 * Mobile: ActionDrawer with option list + Reset/Confirm buttons.
 */
function FilterSelectItem({ filter, onFilterChange, variant }: FilterSelectItemProps) {
	const { t } = useTranslation()
	const lt = useLocaleText()
	const placeholder = t("shadcn-ui:select.placeholder")
	const clearText = t("shadcn-ui:select.clear")
	const emptyText = t("shadcn-ui:select.empty")
	const cancelText = t("shadcn-ui:actionDrawer.cancel")

	const isMobile = variant === ScenePanelVariant.Mobile

	const [drawerOpen, setDrawerOpen] = useState(false)
	const [pendingValue, setPendingValue] = useState(filter.current_value ?? "")

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
		setPendingValue(filter.current_value ?? "")
		setDrawerOpen(true)
	}, [filter.current_value])

	const handleConfirm = useCallback(() => {
		onFilterChange?.(filter.data_key, pendingValue)
		setDrawerOpen(false)
	}, [filter.data_key, onFilterChange, pendingValue])

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
			<div className="flex flex-col items-start gap-1">
				<Label
					className="text-xs font-medium text-muted-foreground"
					onClick={handleOpenDrawer}
				>
					{lt(filter.label)}
				</Label>

				{/* Trigger button - styled like Select trigger */}
				<button
					type="button"
					onClick={handleOpenDrawer}
					className={cn(
						"shadow-xs group flex h-8 items-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm dark:bg-card",
					)}
				>
					{filter.has_leading_icon && filter.leading_icon && (
						<LucideLazyIcon
							icon={filter.leading_icon}
							size={16}
							className="text-muted-foreground"
						/>
					)}
					<span className={cn(!hasSelection && "text-muted-foreground")}>
						{lt(selectedOption?.label) ??
							lt(selectedOption?.value) ??
							filter.current_value ??
							placeholder}
					</span>
					<span className="relative inline-flex size-4 shrink-0 items-center justify-center">
						<ChevronDown
							className={cn(
								"size-4 text-muted-foreground opacity-50 transition-opacity",
								hasSelection &&
								"group-focus-within:opacity-0 group-hover:opacity-0",
							)}
						/>
						{hasSelection && (
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
						)}
					</span>
				</button>

				{/* Mobile drawer - matches Figma design */}
				<ActionDrawer
					open={drawerOpen}
					onOpenChange={setDrawerOpen}
					title={lt(filter.label)}
					showCancel
					cancelText={cancelText}
					onCancel={handleCloseDrawer}
					onConfirm={handleConfirm}
					confirmText={t("shadcn-ui:actionDrawer.confirm")}
					contentClassName="gap-0 p-0"
				>
					{/* Option list - white card per Figma */}
					<div className="mx-3 mb-3 overflow-hidden rounded-md bg-popover">
						{availableOptions.length > 0 ? (
							availableOptions.map(({ option, optionValue }, index) => {
								const isSelected = optionValue === pendingValue
								const isLast = index === availableOptions.length - 1
								return (
									<button
										key={optionValue}
										type="button"
										onClick={() => setPendingValue(optionValue)}
										className={cn(
											"flex h-10 w-full items-center gap-2 bg-transparent px-2",
											"text-sm text-foreground transition-colors",
											!isLast && "border-b border-border",
											"hover:bg-accent active:bg-accent",
										)}
									>
										<span className="flex-1 text-left">
											{lt(option.label) ?? lt(option.value) ?? optionValue}
										</span>
										{isSelected && <Checkbox checked />}
									</button>
								)
							})
						) : (
							<div className="flex min-h-24 items-center justify-center px-4 py-6 text-sm text-muted-foreground">
								{emptyText}
							</div>
						)}
					</div>
				</ActionDrawer>
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
				value={filter.current_value || undefined}
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
