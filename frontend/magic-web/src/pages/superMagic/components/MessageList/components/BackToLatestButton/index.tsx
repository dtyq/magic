import { memo } from "react"
import { useTranslation } from "react-i18next"
import { ArrowDown } from "lucide-react"

import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"

interface BackToLatestButtonProps {
	onClick: () => void
	visible: boolean
	className?: string
}

const BackToLatestButton = memo(({ onClick, visible, className }: BackToLatestButtonProps) => {
	const { t } = useTranslation("super")

	if (!visible) return null

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-x-0 bottom-5 z-tooltip flex justify-center px-2.5",
				className,
			)}
		>
			<div className="flex w-full max-w-3xl justify-end">
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"pointer-events-auto h-[26px] gap-1.5 px-2 py-1",
						"rounded-md border-border shadow-[0_1px_2px_0_rgba(0,0,0,0.05),0_4px_14px_0_rgba(0,0,0,0.1)]",
						"transition-all duration-200 ease-in-out",
						"hover:bg-fill hover:shadow-none",
					)}
					onClick={onClick}
				>
					<ArrowDown className="size-[14px] text-foreground" />
					<span className="text-xs font-normal leading-4 text-foreground">
						{t("detail.backToLatest")}
					</span>
				</Button>
			</div>
		</div>
	)
})

BackToLatestButton.displayName = "BackToLatestButton"

export default BackToLatestButton
