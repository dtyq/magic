import { Skeleton } from "@/opensource/components/shadcn-ui/skeleton"
import usePortalTarget from "@/opensource/hooks/usePortalTarget"
import { createPortal } from "react-dom"
import { SCENE_INPUT_IDS } from "../../constants"
import MessageEditorSkeleton from "./MessageEditorSkeleton"
import { ScenePanelVariant } from "../LazyScenePanel/types"

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
			<div className="flex w-full flex-col gap-3 overflow-clip rounded-lg p-2">
				{/* Top control bar */}
				<div className="flex w-full items-center justify-between">
					{/* Left section: Style + Badge */}
					<div className="flex shrink-0 items-center gap-1.5">
						<Skeleton className="h-6 w-20" />
					</div>

					{/* Right section: Pages, Size, Language selectors */}
					<div className="flex shrink-0 items-center gap-5">
						{/* Pages selector */}
						<div className="flex items-center gap-1.5">
							<Skeleton className="h-8 w-[100px] rounded-full" />
						</div>

						{/* Size selector */}
						<div className="flex items-center gap-1.5">
							<Skeleton className="h-8 w-[100px] rounded-full" />
						</div>
					</div>
				</div>

				{/* Template cards grid */}
				<div className="flex w-full flex-wrap items-start gap-2">
					{Array.from({ length: 4 }).map((_, index) => (
						<div
							key={index}
							className="flex w-[210px] shrink-0 flex-col gap-1.5 overflow-clip rounded-md p-1"
						>
							{/* Card image area */}
							<div className="flex h-28 w-full flex-col items-center justify-center gap-1 overflow-clip rounded-md border border-border bg-background">
								<Skeleton className="size-12 rounded-lg" />
								<Skeleton className="h-3 w-24" />
							</div>
						</div>
					))}
				</div>

				{/* Top control bar */}
				<div className="flex w-full items-center justify-between">
					{/* Left section: Style + Badge */}
					<div className="flex shrink-0 items-center gap-1.5">
						<Skeleton className="h-6 w-20" />
					</div>
				</div>

				{/* Template cards grid */}
				<div className="flex w-full flex-wrap items-start">
					{Array.from({ length: 3 }).map((_, index) => (
						<div
							key={index}
							className="flex w-[33.3%] shrink-0 flex-col gap-1.5 overflow-clip rounded-md p-1"
						>
							{/* Card image area */}
							<div className="flex h-20 w-full items-center justify-between gap-3 overflow-clip rounded-md border border-border bg-background p-4">
								<Skeleton className="size-12 flex-shrink-0 rounded-lg" />
								<div className="flex w-full flex-col gap-2">
									<Skeleton className="h-4 w-[90%]" />
									<Skeleton className="h-4 w-[30%]" />
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</>
	)
}

export default SkillPanelSkeleton
