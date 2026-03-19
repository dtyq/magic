import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CrewItem } from "@/pages/superMagic/pages/Workspace/types"
import type { SceneItem } from "@/pages/superMagic/types/skill"
import IconComponent from "@/pages/superMagic/components/IconViewComponent/index"
import { IconType } from "@/pages/superMagic/components/AgentSelector/types"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"
import { useTranslation } from "react-i18next"

const ICON_SIZE = 32
const SCENE_ICON_SIZE = 12

function SceneIcon({ scene }: { scene: SceneItem }) {
	const isImage = scene.icon && (scene.icon.startsWith("http") || scene.icon.startsWith("/"))
	if (isImage)
		return (
			<img
				src={scene.icon}
				alt={scene.name}
				width={SCENE_ICON_SIZE}
				height={SCENE_ICON_SIZE}
				className="shrink-0 rounded"
			/>
		)
	return <LucideLazyIcon icon={scene.icon} size={SCENE_ICON_SIZE} />
}

interface CrewListItemProps {
	crew: CrewItem
	isActive: boolean
	onClick: (crew: CrewItem) => void
}

export default function CrewListItem({ crew, isActive, onClick }: CrewListItemProps) {
	const { t } = useTranslation("crew/create")

	const scenes = crew.mode.playbooks ?? []
	// const isImage = crew.mode.icon_type === IconType.Image

	return (
		<div
			className="flex cursor-pointer items-start gap-2.5 overflow-hidden rounded-md border border-border bg-card p-2.5 active:opacity-70"
			onClick={() => onClick(crew)}
		>
			{/* 圆形头像容器 */}
			<div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-sidebar">
				<div className="flex size-[50px] items-center justify-center">
					{crew.mode.icon_url ? (
						<img
							src={crew.mode.icon_url}
							alt="icon"
							width={ICON_SIZE}
							height={ICON_SIZE}
							draggable={false}
						/>
					) : (
						<IconComponent
							selectedIcon={crew.mode.icon}
							size={ICON_SIZE}
							iconColor={crew.mode.color}
						/>
					)}
				</div>
			</div>

			{/* 右侧内容列 */}
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				{/* 名称 + 描述 与 复选框并排 */}
				<div className="flex items-start gap-2">
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<div className="text-sm font-semibold leading-none text-foreground">
							{crew.mode.name || t("untitledCrew")}
						</div>
						<div className="line-clamp-2 text-xs leading-none text-muted-foreground">
							{crew.mode.description || t("noDescription")}
						</div>
					</div>
					<div
						className={cn(
							"flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs",
							isActive
								? "border-foreground bg-foreground"
								: "border-input bg-background",
						)}
					>
						{isActive && (
							<Check size={10} className="text-background" strokeWidth={3} />
						)}
					</div>
				</div>

				{/* scenes 独占右侧列完整宽度 */}
				{scenes.length > 0 ? (
					<div className="no-scrollbar flex gap-2 overflow-x-auto">
						{scenes.map((scene) => (
							<div
								key={scene.id}
								className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5"
							>
								<SceneIcon scene={scene} />
								<span className="whitespace-nowrap text-xs font-semibold text-foreground">
									{scene.name}
								</span>
							</div>
						))}
					</div>
				) : (
					<div className="text-xs text-muted-foreground">{t("noSkills")}</div>
				)}
			</div>
		</div>
	)
}
