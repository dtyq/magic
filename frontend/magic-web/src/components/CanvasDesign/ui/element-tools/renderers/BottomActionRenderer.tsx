import { LoaderCircle, Pencil, RotateCcw, SquarePen, ZapIcon } from "lucide-react"
import type { TFunction } from "../../../public/i18n-types"
import { VIDEO_DRAFT_FINAL_VALID_DAYS } from "../../../runtime/resources/video-draft-final/videoDraftFinalHint"
import type { ElementToolIcon, ElementToolResolution } from "../../../runtime/element-tools"
import type { ElementBottomToolbarItem } from "../../canvas-editor/element-bottom-toolbar/ElementBottomToolbar"

const ACTION_ICONS: Record<ElementToolIcon, typeof Pencil> = {
	pencil: Pencil,
	"square-pen": SquarePen,
	"rotate-ccw": RotateCcw,
	loader: LoaderCircle,
	"chevron-left": Pencil,
	"chevron-right": Pencil,
	crown: Pencil,
	trash: Pencil,
}

interface BottomActionRendererProps {
	tools: readonly ElementToolResolution[]
	t: TFunction
}

export function resolveToolLabel(tool: ElementToolResolution, t: BottomActionRendererProps["t"]) {
	return tool.presentation.labelKey
		? t(tool.presentation.labelKey, tool.presentation.labelFallback)
		: (tool.presentation.labelFallback ?? tool.id)
}

export default function BottomActionRenderer({ tools, t }: BottomActionRendererProps) {
	return tools.map<ElementBottomToolbarItem>((tool) => {
		const iconType = tool.loading ? "loader" : tool.presentation.icon
		const Icon = iconType ? ACTION_ICONS[iconType] : undefined
		const estimate = tool.data?.videoGenerationEstimate
		const label = resolveToolLabel(tool, t)
		const hint = tool.data?.videoDraftFinalHint
		const resolution = estimate?.resolution
		const tooltip =
			!hint || !resolution
				? undefined
				: hint.expired
					? t("videoEditor.generateFinalExpired", "样片已过期，需重新生成样片。")
					: hint.deadlineText
						? t("videoEditor.generateFinalHint", {
								defaultValue:
									"样片生成后，在{{days}}天内可生成{{resolution}} 正片。\n请在 {{deadline}} 前操作，逾期需重新生成样片。",
								days: VIDEO_DRAFT_FINAL_VALID_DAYS,
								resolution,
								deadline: hint.deadlineText,
							})
						: t("videoEditor.generateFinalHintPending", {
								defaultValue:
									"样片生成后，在{{days}}天内可生成{{resolution}} 正片。",
								days: VIDEO_DRAFT_FINAL_VALID_DAYS,
								resolution,
							})
		return {
			id: tool.id,
			group: tool.presentation.group,
			icon: Icon ? (
				<Icon size={14} className={tool.loading ? "animate-spin" : undefined} />
			) : undefined,
			tooltip,
			label: estimate ? (
				<span data-video-generation-estimate>
					<span>{label}</span>
					<span>{estimate.resolution}</span>
					{estimate.points != null ? (
						<span data-video-generation-estimate-points>
							<ZapIcon size={16} fill="currentColor" aria-hidden />
							<span>{estimate.points}</span>
						</span>
					) : null}
				</span>
			) : (
				label
			),
			shortcut: tool.presentation.shortcut,
			disabled: tool.visibility === "disabled" || Boolean(tool.loading),
			loading: tool.loading,
			onClick: () => void tool.execute?.(),
		}
	})
}
