import { memo } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/utils/cn"
import HeaderTrailingAction from "./HeaderTrailingAction"
import { SidebarSectionToggle, type SidebarSectionOptions } from "../../SidebarSection"
import { useFileHeaderOverflow } from "../hooks/useFileHeaderOverflow"

interface SelectModeHeaderProps {
	selectedCount: number
	totalCount: number
	onSelectAll: () => void
	onDeselectAll: () => void
	onCancel: () => void
	headerTrailingAction?: ReactNode
	section?: SidebarSectionOptions
	className?: string
}

function SelectModeHeader({
	selectedCount,
	totalCount,
	onSelectAll,
	onDeselectAll,
	onCancel,
	headerTrailingAction,
	section,
	className,
}: SelectModeHeaderProps) {
	const { t } = useTranslation("super")
	const { rowRef, labelRef, actionsRef } = useFileHeaderOverflow()

	const isAllSelected = selectedCount === totalCount && totalCount > 0
	const isIndeterminate = selectedCount > 0 && selectedCount < totalCount

	const handleCheckboxChange = () => {
		if (selectedCount === totalCount) {
			onDeselectAll()
		} else {
			onSelectAll()
		}
	}

	return (
		<div
			ref={rowRef}
			className={cn(
				"flex h-8 w-full shrink-0 items-center gap-1 px-2",
				section && "h-10",
				className,
			)}
		>
			<label
				className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 p-0"
				data-testid="select-mode-header-label"
			>
				<Checkbox
					data-header-leading
					checked={isIndeterminate ? "indeterminate" : isAllSelected}
					data-testid="file-select-all-checkbox"
					onCheckedChange={handleCheckboxChange}
				/>
				<span className="min-w-0 truncate text-sm font-medium leading-none text-foreground">
					<span ref={labelRef} className="inline-block whitespace-nowrap">
						{t("topicFiles.selectAll")}
					</span>
				</span>
			</label>
			<div ref={actionsRef} className="relative ml-auto flex shrink-0 items-center gap-1">
				<Button
					variant="outline"
					size="sm"
					onClick={onCancel}
					data-testid="file-select-cancel-button"
					className="h-7 shrink-0 px-3 py-2"
				>
					<span className="text-sm font-medium leading-5">
						{t("topicFiles.cancelSelect")}
					</span>
				</Button>
				{headerTrailingAction ? (
					<HeaderTrailingAction>{headerTrailingAction}</HeaderTrailingAction>
				) : null}
			</div>
			{section && (
				<SidebarSectionToggle
					label={t("userSpace.memory")}
					isExpanded={section.isExpanded}
					onClick={section.onClick}
				/>
			)}
		</div>
	)
}

export default memo(SelectModeHeader)
