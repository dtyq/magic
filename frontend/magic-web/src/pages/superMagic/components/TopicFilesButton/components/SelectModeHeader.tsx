import { memo } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/lib/utils"

interface SelectModeHeaderProps {
	selectedCount: number
	totalCount: number
	onSelectAll: () => void
	onDeselectAll: () => void
	onCancel: () => void
	className?: string
}

function SelectModeHeader({
	selectedCount,
	totalCount,
	onSelectAll,
	onDeselectAll,
	onCancel,
	className,
}: SelectModeHeaderProps) {
	const { t } = useTranslation("super")

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
			className={cn("flex h-8 w-full shrink-0 items-center justify-between px-2", className)}
		>
			<label className="flex cursor-pointer items-center gap-2 p-0">
				<Checkbox
					checked={isIndeterminate ? "indeterminate" : isAllSelected}
					onCheckedChange={handleCheckboxChange}
				/>
				<span className="text-sm font-medium leading-none text-foreground">
					{t("topicFiles.selectAll")}
				</span>
			</label>
			<Button variant="outline" size="sm" onClick={onCancel} className="h-7 px-3 py-2">
				<span className="text-sm font-medium leading-5">
					{t("topicFiles.cancelSelect")}
				</span>
			</Button>
		</div>
	)
}

export default memo(SelectModeHeader)
