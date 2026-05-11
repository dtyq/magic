import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { cn } from "@/lib/utils"
import type { KnowledgeTypeOption } from "../types"

export interface TypeOptionRowProps {
	option: KnowledgeTypeOption
	selected: boolean
	disabled?: boolean
	onSelect: () => void
	label: string
}

export function TypeOptionRow(props: TypeOptionRowProps) {
	const { option, selected, disabled, onSelect, label } = props
	const Icon = option.icon

	return (
		<button
			type="button"
			disabled={disabled}
			className={cn(
				"flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors",
				selected ? "border-foreground bg-white" : "border-border bg-white",
				disabled && "cursor-not-allowed opacity-50",
			)}
			onClick={() => !disabled && onSelect()}
		>
			<div className="flex flex-1 items-center gap-1.5">
				<Icon className={cn("h-4 w-4", disabled && "opacity-50")} />
				<span className="text-sm font-normal">{label}</span>
			</div>
			<Checkbox
				checked={selected}
				disabled={disabled}
				onCheckedChange={() => !disabled && onSelect()}
				className="pointer-events-none"
				aria-hidden
			/>
		</button>
	)
}
