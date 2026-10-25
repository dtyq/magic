import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"

interface SlidesTemplateMobileFilterOptionProps {
	label: string
	selected: boolean
	onClick: () => void
	variant?: "default" | "splitSheet"
	"data-testid"?: string
}

function SlidesTemplateMobileFilterOption({
	label,
	selected,
	onClick,
	variant = "default",
	"data-testid": dataTestId,
}: SlidesTemplateMobileFilterOptionProps) {
	const labelSizeClass =
		label.length >= 7 ? "text-xs" : label.length >= 5 ? "text-sm" : "text-base"
	const isSplitSheet = variant === "splitSheet"

	return (
		<Button
			type="button"
			variant="ghost"
			className={cn(
				isSplitSheet
					? "relative flex h-auto min-h-11 min-w-0 items-center justify-center rounded-lg border px-2 py-2 text-center text-[14px] font-normal leading-5 shadow-none transition-colors active:scale-[0.98]"
					: "flex h-auto min-h-12 min-w-0 items-center justify-center rounded-lg border bg-background px-2 py-2 text-center text-foreground shadow-xs transition-colors hover:bg-accent",
				selected
					? isSplitSheet
						? "border-primary bg-primary/10 font-medium text-primary hover:bg-primary/10"
						: "border-primary bg-primary/5"
					: isSplitSheet
						? "border-border bg-card text-foreground hover:bg-card"
						: "border-border",
				!isSplitSheet && labelSizeClass,
			)}
			aria-pressed={selected}
			aria-label={label}
			data-testid={dataTestId}
			title={label}
			onClick={onClick}
		>
			<span
				className={cn(
					"min-w-0 flex-1 truncate whitespace-nowrap text-center leading-5",
					isSplitSheet && "max-w-full",
				)}
			>
				{label}
			</span>
		</Button>
	)
}

export default SlidesTemplateMobileFilterOption
