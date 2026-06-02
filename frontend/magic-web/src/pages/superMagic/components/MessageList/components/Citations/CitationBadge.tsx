import { memo } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

interface CitationBadgeProps {
	/** 引用序号（从 1 开始） */
	index: number
	/** 是否高亮 */
	highlighted?: boolean
	/** 是否可点击（引用数据已加载时为 true） */
	clickable?: boolean
	/** 点击回调 */
	onClick?: (index: number) => void
}

function CitationBadge({
	index,
	highlighted = false,
	clickable = true,
	onClick,
}: CitationBadgeProps) {
	const { t } = useTranslation("super")

	return (
		<button
			type="button"
			onClick={() => clickable && onClick?.(index)}
			className={cn(
				"inline-flex items-center justify-center rounded-full",
				"h-[18px] min-w-[18px] px-1 text-[11px] font-semibold leading-none",
				"transition-colors shrink-0 align-[text-top] mx-0.5",
				clickable ? "cursor-pointer" : "cursor-default",
				highlighted
					? "bg-primary text-primary-foreground"
					: clickable
						? "bg-primary/10 text-primary hover:bg-primary/20"
						: "bg-muted-foreground/15 text-muted-foreground",
			)}
			aria-label={t("citations.badgeAria", {
				index,
				defaultValue: "引用 {{index}}",
			})}
		>
			{index}
		</button>
	)
}

export default memo(CitationBadge)
