import { useHover } from "ahooks"
import { cn } from "@/lib/utils"
import { useRef } from "react"
import IconCreateProjectStar1 from "@/enhance/tabler/icons-react/icons/IconCreateProjectStar1"
import IconCreateProjectStar2 from "@/enhance/tabler/icons-react/icons/IconCreateProjectStar2"
import { IconPlus } from "@tabler/icons-react"
import { useTranslation } from "react-i18next"
import { ViewMode } from "../ProjectItem"
import "./create-item-animations.css"

function CreateItem({
	onCreateProject,
	viewMode,
}: {
	onCreateProject: () => void
	viewMode: ViewMode
}) {
	const ref = useRef<HTMLDivElement>(null)
	const isHover = useHover(ref)
	const { t } = useTranslation("super")
	const isListMode = viewMode === ViewMode.LIST

	return (
		<div
			ref={ref}
			className={cn(
				"relative cursor-pointer overflow-hidden rounded-lg border border-border bg-card transition-all duration-300",
				isListMode ? "h-14 p-0" : "p-2.5",
			)}
			onClick={onCreateProject}
			data-testid="empty-workspace-panel-create-item"
		>
			<div
				className={cn(
					"relative flex items-center justify-center gap-2.5 rounded px-2 py-2",
					isListMode ? "h-[54px] flex-row bg-card" : "h-[163px] flex-col",
				)}
			>
				<div
					className={cn(
						"flex items-center justify-center rounded-lg bg-[length:300%_300%] text-white",
						isListMode ? "m-1.5 h-[30px] w-[30px]" : "h-10 w-10",
						((isHover && !isListMode) || isListMode) && "animate-gradient-change",
						!isHover && !isListMode && "animate-gradient-change-reverse",
					)}
					style={{
						background:
							"linear-gradient(135deg, #000 0%, #333 25%, #3F8FFF 50%, #EF2FDF 100%)",
					}}
				>
					<IconPlus size={isListMode ? 20 : 30} />
				</div>
				<div
					className={cn(
						"select-none text-sm font-semibold leading-[1.43] text-[rgba(28,29,35,0.8)]",
						isListMode && "flex-1 text-foreground",
					)}
				>
					{isHover ? t("common.createImmediately") : t("project.createNewProject")}
				</div>
			</div>

			<div
				className={cn(
					"absolute right-1/2 top-1/2 -mr-[15px] -mt-[25px] h-[30px] w-[30px] opacity-0 transition-all duration-700 ease-out",
					"[&_svg]:h-full [&_svg]:w-full [&_svg]:transition-transform [&_svg]:duration-700 [&_svg]:ease-linear",
					isHover && "animate-star1-parabola",
					!isHover && "animate-star1-parabola-reverse",
					isListMode && "hidden",
				)}
			>
				<IconCreateProjectStar1 size={21} />
			</div>

			<div
				className={cn(
					"absolute bottom-1/2 left-1/2 h-5 w-5 opacity-0 transition-all duration-700 ease-out",
					"[&_svg]:h-full [&_svg]:w-full [&_svg]:transition-transform [&_svg]:duration-700 [&_svg]:ease-linear",
					isHover && "animate-star2-parabola",
					!isHover && "animate-star2-parabola-reverse",
					isListMode && "hidden",
				)}
			>
				<IconCreateProjectStar2 size={21} />
			</div>
		</div>
	)
}

export default CreateItem
