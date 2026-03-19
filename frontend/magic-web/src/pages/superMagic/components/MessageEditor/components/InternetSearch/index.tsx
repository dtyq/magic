import { useMemoizedFn } from "ahooks"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { useTranslation } from "react-i18next"
import { internetSearchManager } from "../../services/InternetSearchManager"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Globe, GlobeX } from "lucide-react"

interface InternetSearchProps {
	topicId?: string
	iconSize?: number
	className?: string
}

/** 互联网搜索按钮 */
const InternetSearch = function InternetSearch({
	topicId,
	iconSize = 20,
	className,
}: InternetSearchProps) {
	const { t } = useTranslation("super")

	const [isChecked, setIsChecked] = useState(true)

	/** 切换互联网搜索状态 */
	const handleClick = useMemoizedFn(() => {
		internetSearchManager.setIsChecked(topicId, !isChecked)
		setIsChecked(!isChecked)
	})

	useEffect(() => {
		const _isChecked = internetSearchManager.getIsChecked(topicId)
		setIsChecked(_isChecked)
	}, [topicId])

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					className={cn(
						"flex cursor-pointer items-center justify-center rounded-md border-0 transition-all hover:opacity-80 active:opacity-60",
						!isChecked &&
						"bg-[#f5f5f5] text-foreground dark:bg-sidebar dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground",
						isChecked &&
						"bg-primary text-white dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90",
						className,
					)}
					onClick={handleClick}
					data-testid="internet-search-button"
				>
					{isChecked ? <Globe size={iconSize} /> : <GlobeX size={iconSize} />}
				</button>
			</TooltipTrigger>
			<TooltipContent side="top">
				{isChecked ? t("ui.internetSearchOpen") : t("ui.internetSearchClose")}
			</TooltipContent>
		</Tooltip>
	)
}

export default InternetSearch
