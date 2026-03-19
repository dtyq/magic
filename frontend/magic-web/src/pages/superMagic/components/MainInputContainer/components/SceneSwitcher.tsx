import { Button } from "@/components/shadcn-ui/button"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { SceneItem } from "@/pages/superMagic/types/skill"
import { cn } from "@/lib/utils"
import { ScenePanelVariant } from "./LazyScenePanel/types"
import { useOptionalScenePanelVariant } from "../stores"
import { useTranslation } from "react-i18next"

interface SceneSwitcherProps {
	scenes: SceneItem[] | undefined
	onSceneClick?: (skill: SceneItem) => void
}

const DESKTOP_ICON_SIZE = 16
const ANIMATION_DELAY_STEP = 40

function SceneSwitcher({ scenes, onSceneClick: onSkillClick }: SceneSwitcherProps) {
	const variant = useOptionalScenePanelVariant()
	const { t } = useTranslation("crew/create")

	// Get current mode item with skills
	if (!scenes || Object.keys(scenes).length === 0) return null

	const sceneButtons = Object.values(scenes).map((skill, index) => {
		const isImage = skill.icon && (skill.icon.startsWith("http") || skill.icon.startsWith("/"))
		const Icon = isImage ? (
			<img
				src={skill.icon}
				alt={skill.name || t("playbook.untitled")}
				width={DESKTOP_ICON_SIZE}
				height={DESKTOP_ICON_SIZE}
				className="rounded"
			/>
		) : (
			<LucideLazyIcon icon={skill.icon} size={DESKTOP_ICON_SIZE} />
		)

		return (
			<div
				key={skill.id}
				className={cn(
					"duration-150 animate-in fade-in slide-in-from-right-2",
					variant &&
					[ScenePanelVariant.TopicPage, ScenePanelVariant.Mobile].includes(variant) &&
					"shrink-0",
				)}
				style={{
					animationDelay: `${index * ANIMATION_DELAY_STEP}ms`,
					animationFillMode: "backwards",
				}}
			>
				<Button
					variant="outline"
					size="sm"
					className={cn(
						"shadow-xs h-9 gap-2 rounded-full px-4 py-2 dark:text-white",
						variant &&
						[ScenePanelVariant.TopicPage, ScenePanelVariant.Mobile].includes(
							variant,
						) &&
						"h-7 gap-2 rounded-full px-2.5",
					)}
					onClick={() => onSkillClick?.(skill)}
				>
					{Icon}
					<span className="text-sm font-normal">
						{skill.name || t("playbook.untitled")}
					</span>
				</Button>
			</div>
		)
	})

	if (variant && [ScenePanelVariant.TopicPage, ScenePanelVariant.Mobile].includes(variant)) {
		return (
			<HeadlessHorizontalScroll
				className="relative w-[calc(100%-1px)]"
				scrollContainerClassName="no-scrollbar flex min-w-0 w-full flex-nowrap items-center justify-start gap-2 overflow-x-auto overflow-y-hidden"
				renderLeftControl={({ scroll }) => (
					<div
						className={cn(
							"z-11 pointer-events-none absolute left-[-1px] top-0 flex h-full w-[52px] items-center justify-start bg-gradient-to-r from-sidebar from-50% to-transparent",
							[ScenePanelVariant.Mobile].includes(variant) && "from-background",
						)}
					>
						<Button
							variant="outline"
							size="icon"
							className="shadow-xs pointer-events-auto size-4 rounded-full dark:text-white"
							onClick={() => scroll("left")}
						>
							<ChevronLeft className="size-3" />
						</Button>
					</div>
				)}
				renderRightControl={({ scroll }) => (
					<div
						className={cn(
							"z-11 pointer-events-none absolute right-[-1px] top-0 flex h-full w-[52px] items-center justify-end bg-gradient-to-r from-transparent from-0% to-sidebar",
							[ScenePanelVariant.Mobile].includes(variant) && "to-background",
						)}
					>
						<Button
							variant="outline"
							size="icon"
							className="shadow-xs pointer-events-auto size-4 rounded-full dark:text-white"
							onClick={() => scroll("right")}
						>
							<ChevronRight className="size-3" />
						</Button>
					</div>
				)}
			>
				{sceneButtons}
			</HeadlessHorizontalScroll>
		)
	}

	return (
		<div className="flex w-full flex-wrap items-center justify-center gap-2">
			{sceneButtons}
		</div>
	)
}

export default SceneSwitcher
