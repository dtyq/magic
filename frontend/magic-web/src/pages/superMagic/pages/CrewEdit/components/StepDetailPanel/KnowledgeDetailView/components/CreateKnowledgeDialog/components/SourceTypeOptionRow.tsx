import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/lib/utils"
import { useTranslation } from "react-i18next"
import type { KnowledgeSourceOption } from "../types"

export interface SourceTypeOptionRowProps {
	option: KnowledgeSourceOption
	selected: boolean
	disabled?: boolean
	onSelect: () => void
	label: string
	description: string
}

export function SourceTypeOptionRow(props: SourceTypeOptionRowProps) {
	const { option, selected, disabled, onSelect, label, description } = props
	const { t } = useTranslation("crew/create")
	const Icon = option.icon

	return (
		<button
			type="button"
			disabled={disabled}
			className={cn(
				"flex w-full cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 text-left transition-colors",
				selected ? "border-foreground" : "border-border",
				disabled && "cursor-not-allowed opacity-50",
			)}
			onClick={() => !disabled && onSelect()}
		>
			<div className="flex flex-1 flex-col gap-1">
				<div className="flex items-center gap-1.5">
					<Icon className={cn("h-4 w-4", disabled && "opacity-50")} />
					<span className="text-sm font-normal">{label}</span>
					{disabled && (
						<span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
							{t("documentCreate.common.comingSoonBadge")}
						</span>
					)}
				</div>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			<Checkbox
				checked={selected}
				disabled={disabled}
				onCheckedChange={() => !disabled && onSelect()}
				className="pointer-events-none mt-0.5"
				aria-hidden
			/>
		</button>
	)
}
