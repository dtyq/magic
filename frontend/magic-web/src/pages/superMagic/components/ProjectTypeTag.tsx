import type { ComponentType } from "react"
import type { LucideProps } from "lucide-react"
import { Boxes, Bot, MessageCircle, Mic, Palette, Wrench } from "lucide-react"
import { useTranslation } from "react-i18next"

import MagicTooltip from "@/components/base/MagicTooltip"
import { MagiClaw } from "@/enhance/lucide-react"
import { cn } from "@/utils/cn"

/**
 * Recent project lists (web sidebar and H5 shell) show the type, pinned and collaboration marks
 * side by side at one 14px size. The pinned and collaboration tags force 12px icons (and keep an
 * 18px chip elsewhere), so this class drops the chip and overrides their inner svg.
 */
export const RECENT_PROJECT_MARK_CLASS_NAME =
	"h-3.5 w-3.5 border-0 bg-transparent p-0 [&_svg]:!h-[14px] [&_svg]:!w-[14px]"

/**
 * For the collaboration and shortcut marks. Line weights come from the global lucide stroke
 * (src/styles/lucide.css), which already matches the type marks, so no stroke override here.
 */
export const RECENT_PROJECT_LINE_MARK_CLASS_NAME = RECENT_PROJECT_MARK_CLASS_NAME

/** Icon size of the type mark in recent project lists, matching RECENT_PROJECT_MARK_CLASS_NAME. */
export const RECENT_PROJECT_MARK_SIZE = 14

interface ProjectTypeTagProps {
	projectMode?: string | null
	/** Icon size in px; 16 by default. */
	size?: number
	/**
	 * Recent project lists ask for one line weight across marks. Here the global lucide stroke
	 * (src/styles/lucide.css) and MagiClaw's own 16-unit default already give that, so it is a no-op.
	 */
	uniformStroke?: boolean
	tooltipDisabled?: boolean
	className?: string
}

type ProjectTypeTagLabelKey =
	| "projectTypeTag.aiCanvas"
	| "projectTypeTag.magicClaw"
	| "projectTypeTag.microApp"
	| "projectTypeTag.agent"
	| "projectTypeTag.skill"
	| "projectTypeTag.audio"
	| "projectTypeTag.chat"

const PROJECT_TYPE_ICONS: Record<
	string,
	{ Icon: ComponentType<LucideProps>; labelKey: ProjectTypeTagLabelKey }
> = {
	magiclaw: { Icon: MagiClaw, labelKey: "projectTypeTag.magicClaw" },
	"micro-app": { Icon: Boxes, labelKey: "projectTypeTag.microApp" },
	agent_creator: { Icon: Bot, labelKey: "projectTypeTag.agent" },
	custom_agent: { Icon: Bot, labelKey: "projectTypeTag.agent" },
	skill_creator: { Icon: Wrench, labelKey: "projectTypeTag.skill" },
	custom_skill: { Icon: Wrench, labelKey: "projectTypeTag.skill" },
	audio: { Icon: Mic, labelKey: "projectTypeTag.audio" },
	chat: { Icon: MessageCircle, labelKey: "projectTypeTag.chat" },
	// Same icon as the sidebar's AI canvas entry.
	"ai-canvas": { Icon: Palette, labelKey: "projectTypeTag.aiCanvas" },
}

/** 最近项目将类型标记放在置顶和协作标记所在的位置，不发起额外请求。 */
export default function ProjectTypeTag({
	projectMode,
	tooltipDisabled = false,
	size = 16,
	className,
}: ProjectTypeTagProps) {
	const { t } = useTranslation("super")
	const config = projectMode ? PROJECT_TYPE_ICONS[projectMode] : undefined
	if (!config) return null

	const label = t(config.labelKey)
	const Icon = config.Icon
	return (
		<MagicTooltip title={label} disabled={tooltipDisabled}>
			<span
				className={cn(
					"inline-flex shrink-0 items-center justify-center text-current",
					className,
				)}
				style={{ width: size, height: size }}
				role="img"
				aria-label={label}
				data-testid="project-type-tag"
			>
				{/* 不传 strokeWidth：Lucide 图标沿用 src/styles/lucide.css 的全局 1.5px，
				    MagiClaw 沿用自身 16 画板的默认线宽，与侧栏菜单图标视觉线粗一致。 */}
				<Icon size={size} aria-hidden="true" />
			</span>
		</MagicTooltip>
	)
}
