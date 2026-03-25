import { Skeleton } from "@/components/shadcn-ui/skeleton"
import usePortalTarget from "@/hooks/usePortalTarget"
import { createPortal } from "react-dom"
import { SCENE_INPUT_IDS } from "../../constants"
import { SkillPanelDefaultLayoutSkeleton } from "./SkillPanelDefaultLayoutSkeleton"
import MessageEditorSkeleton from "./MessageEditorSkeleton"
import { ScenePanelVariant } from "../LazyScenePanel/types"
import { Spinner } from "@/components/shadcn-ui/spinner"

/**
 * Skill panel loading skeleton with card-based layout
 * Matches the modern landing style with preview cards
 */
function SkillPanelSkeleton({
	includeEditor = false,
	variant,
}: {
	includeEditor?: boolean
	variant?: ScenePanelVariant
}) {
	const editorPortalTarget = usePortalTarget({
		portalId: SCENE_INPUT_IDS.INPUT_CONTAINER,
	})

	if (variant === ScenePanelVariant.TopicPage) {
		return (
			<>
				{includeEditor &&
					editorPortalTarget &&
					createPortal(<MessageEditorSkeleton />, editorPortalTarget)}
				<div className="flex w-full items-center justify-start gap-2.5">
					{/* Pages selector */}
					<div className="flex items-center gap-1.5">
						<Skeleton className="h-8 w-[100px] rounded-full" />
					</div>

					{/* Size selector */}
					<div className="flex items-center gap-1.5">
						<Skeleton className="h-8 w-[100px] rounded-full" />
					</div>

					{/* Language selector */}
					<div className="flex items-center gap-1.5">
						<Skeleton className="h-8 w-[100px] rounded-full" />
					</div>
				</div>
			</>
		)
	} else if (variant === ScenePanelVariant.Mobile) {
		return (
			<>
				<div className="flex w-full items-center justify-start gap-2.5">
					{/* Pages selector */}
					<div className="flex items-center gap-1.5">
						<Skeleton className="h-8 w-[100px] rounded-full" />
					</div>

					{/* Size selector */}
					<div className="flex items-center gap-1.5">
						<Skeleton className="h-8 w-[100px] rounded-full" />
					</div>

					{/* Language selector */}
					<div className="flex items-center gap-1.5">
						<Skeleton className="h-8 w-[100px] rounded-full" />
					</div>
				</div>
				{includeEditor &&
					editorPortalTarget &&
					createPortal(<MessageEditorSkeleton />, editorPortalTarget)}
			</>
		)
	}

	return (
		<>
			{includeEditor &&
				editorPortalTarget &&
				createPortal(<MessageEditorSkeleton />, editorPortalTarget)}
			<div className="flex items-center justify-center">
				<Spinner className="animate-spin" size={20} />
			</div>
			{/* <SkillPanelDefaultLayoutSkeleton /> */}
		</>
	)
}

export default SkillPanelSkeleton
