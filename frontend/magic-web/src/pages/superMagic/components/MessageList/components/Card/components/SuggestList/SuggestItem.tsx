import { IconArrowRight } from "@tabler/icons-react"
import { observer } from "mobx-react-lite"
import { cn } from "@/lib/utils"

interface SuggestItemProps {
	index: number
	item: string
	onClick: (message: string) => void
}

export const SuggestItem = observer(function SuggestItem({ item, onClick }: SuggestItemProps) {
	return (
		<button
			type="button"
			className={cn(
				"flex w-fit items-center justify-between gap-1 rounded-md px-2 py-2 text-left text-xs transition-colors",
				"bg-secondary text-secondary-foreground hover:bg-fill-secondary/80",
			)}
			onClick={() => onClick(item)}
		>
			<span className="min-w-0 flex-1 break-words">{item}</span>
			<IconArrowRight className="size-4 shrink-0" />
		</button>
	)
})
