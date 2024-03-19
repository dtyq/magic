import { ChevronRight } from "lucide-react"

interface SettingItemProps {
	label: string
	description?: string
	value?: React.ReactNode
	onClick?: () => void
}

export default function SettingItem({ label, description, value, onClick }: SettingItemProps) {
	return (
		<div className="flex w-full flex-col gap-2 px-2 py-2.5" onClick={() => onClick?.()}>
			<div className="flex w-full items-center gap-2">
				<div className="flex-1 text-left text-sm text-foreground">{label}</div>
				{value && <div className="shrink-0">{value}</div>}
				<ChevronRight className="ml-0 size-5 shrink-0 text-foreground" />
			</div>
			{description && <div className="text-xs text-muted-foreground">{description}</div>}
		</div>
	)
}
