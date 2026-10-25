import { memo, useEffect, useRef, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { MoreHorizontal } from "lucide-react"
import dayjs from "@/infrastructure/vendors/dayjs"
import { Button } from "@/components/shadcn-ui/button"
import ProjectActionsDropdown from "@/pages/superMagic/components/ProjectActionsDropdown"
import type { ProjectActionHandlers } from "@/pages/superMagic/components/ProjectActionsDropdown/types"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import type { ProjectListItem } from "@/pages/superMagic/pages/Workspace/types"
import type { FileMediaMetadata } from "@/pages/superMagic/services/useFileMediaSource"
import PinnedTag from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"
import CanvasMediaImage from "./CanvasMediaImage"
import EmptyCanvasCover from "./EmptyCanvasCover"
import { cn } from "@/utils/cn"

export type AiCanvasCardMenuActions = Pick<
	ProjectActionHandlers<ProjectListItem>,
	"onCopyCollaborationLink" | "onAddCollaborators" | "onTransferProject"
>

interface AiCanvasProjectCardProps {
	project: ProjectListItem
	/** Newest images (max four); undefined while resolving, null when the canvas has none. */
	covers: FileMediaMetadata[] | null | undefined
	onOpen: (project: ProjectListItem) => void
	onRename: (params: { projectId: string; projectName: string }) => Promise<void> | void
	onDelete: (project: ProjectListItem) => void
	onOpenInNewWindow?: (project: ProjectListItem) => void
	onTogglePin?: (project: ProjectListItem) => void
	/**
	 * The rest of the project detail menu (collaboration link, collaborators,
	 * transfer). Collaboration actions come from the enterprise overlay and stay hidden without it.
	 */
	menuActions?: AiCanvasCardMenuActions
	/** H5: the more button opens the mobile project action sheet instead of the dropdown. */
	onOpenMenu?: (project: ProjectListItem) => void
	onHover?: () => void
	/** Called once when the card first nears the viewport; covers load from then on. */
	onVisible?: (projectId: string) => void
}

/**
 * Grid cell placement per image count inside the 2x2 cover:
 * | images | layout                                   |
 * | 1      | one image fills the cover                |
 * | 2      | two columns                              |
 * | 3      | large left image, two stacked on the right |
 * | 4      | 2x2 tiles                                |
 */
const COVER_CELL_CLASSES: Record<number, string[]> = {
	1: ["col-span-2 row-span-2"],
	2: ["row-span-2", "row-span-2"],
	3: ["row-span-2", "", ""],
	4: ["", "", "", ""],
}

function CanvasCover({ covers }: { covers: FileMediaMetadata[] | null | undefined }) {
	if (!covers || covers.length === 0) return <EmptyCanvasCover loading={covers === undefined} />
	const cells = COVER_CELL_CLASSES[covers.length] ?? COVER_CELL_CLASSES[4]
	return (
		// 1px gaps over a muted background read as thin dividers between tiles.
		<div className="grid size-full grid-cols-2 grid-rows-2 gap-px bg-border">
			{covers.slice(0, 4).map((file, index) => (
				<div key={file.fileId} className={cn("overflow-hidden bg-muted", cells[index])}>
					<CanvasMediaImage
						file={file}
						fallback={<div className="size-full bg-muted" />}
					/>
				</div>
			))}
		</div>
	)
}

/**
 * Canvas project card: up to four newest generated images as a 4:3 cover, then name and
 * update time.
 * The whole cover opens the project; the menu button is a separate tab stop so keyboard users
 * reach rename and delete without opening the project.
 */
function AiCanvasProjectCard({
	project,
	covers,
	onOpen,
	onRename,
	onDelete,
	onOpenInNewWindow,
	onTogglePin,
	menuActions,
	onOpenMenu,
	onHover,
	onVisible,
}: AiCanvasProjectCardProps) {
	const rootRef = useRef<HTMLDivElement>(null)

	// One-shot visibility: the implicit root also accounts for the home's scroll container
	// clipping the card. The 200px margin starts cover reads just before the card scrolls in.
	useEffect(() => {
		const element = rootRef.current
		if (!element || !onVisible) return
		if (typeof IntersectionObserver === "undefined") {
			onVisible(project.id)
			return
		}
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return
				observer.disconnect()
				onVisible(project.id)
			},
			{ rootMargin: "200px 0px" },
		)
		observer.observe(element)
		return () => observer.disconnect()
	}, [onVisible, project.id])

	const { t, i18n } = useTranslation("aiCanvas")
	const [renaming, setRenaming] = useState(false)
	const [draftName, setDraftName] = useState("")
	const name = project.project_name || t("home.untitled")
	// Same locale switch as the sidebar's recent list, so relative times read "2 分钟前" in Chinese.
	const locale = i18n.language.toLowerCase().startsWith("zh") ? "zh-cn" : "en"
	const updatedTime = project.updated_at ? dayjs(project.updated_at) : null
	const updatedAt = updatedTime?.isValid() ? updatedTime.locale(locale).fromNow() : ""

	const submitRename = async (event: FormEvent) => {
		event.preventDefault()
		const nextName = draftName.trim()
		if (!nextName || nextName === project.project_name) {
			setRenaming(false)
			return
		}
		await onRename({ projectId: project.id, projectName: nextName })
		setRenaming(false)
	}

	return (
		<div ref={rootRef} className="group flex flex-col gap-2" onMouseEnter={onHover}>
			<button
				type="button"
				onClick={() => onOpen(project)}
				className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-muted ring-1 ring-border transition-shadow duration-200 hover:shadow-[0_18px_40px_-20px_rgb(15_23_42/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={name}
			>
				{/* Slight zoom on hover; the frame clips it so the card size never changes. */}
				<div className="size-full transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
					<CanvasCover covers={covers} />
				</div>
				{/* Same pinned tag as the project lists, on the cover's top-left; outside the zoom. */}
				{project.is_pinned ? (
					<PinnedTag className="absolute left-2.5 top-2.5 size-6 rounded-md shadow-sm" />
				) : null}
			</button>
			<div className="flex items-start justify-between gap-2 px-0.5">
				<div className="min-w-0">
					<div className="truncate text-sm font-medium text-foreground">{name}</div>
					{updatedAt ? (
						<div className="text-xs text-muted-foreground">
							{t("home.updatedAt", { time: updatedAt })}
						</div>
					) : null}
				</div>
				{onOpenMenu ? (
					<Button
						variant="ghost"
						size="icon"
						className="size-7 shrink-0 text-muted-foreground"
						aria-label={t("home.moreActions")}
						onClick={() => onOpenMenu(project)}
						data-testid="ai-canvas-card-more-button"
					>
						<MoreHorizontal size={16} />
					</Button>
				) : (
					// Same menu as the canvas project page's card, plus "open in new window" first.
					<ProjectActionsDropdown
						item={project}
						inCollaborationPanel={false}
						trigger={["click"]}
						placement="bottomRight"
						onOpenInNewWindow={onOpenInNewWindow}
						onPinProject={onTogglePin ? (item) => onTogglePin(item) : undefined}
						onRenameStart={() => {
							setDraftName(project.project_name || "")
							setRenaming(true)
						}}
						onRenameProject={async ({ projectId, projectName }) => {
							await onRename({ projectId, projectName })
						}}
						onDeleteProject={onDelete}
						{...menuActions}
					>
						<span>
							<Button
								variant="ghost"
								size="icon"
								className="size-7 shrink-0 text-muted-foreground"
								aria-label={t("home.moreActions")}
								data-testid="ai-canvas-card-more-button"
							>
								<MoreHorizontal size={16} />
							</Button>
						</span>
					</ProjectActionsDropdown>
				)}
			</div>

			<Dialog open={renaming} onOpenChange={setRenaming}>
				<DialogContent className="sm:max-w-md">
					<form onSubmit={submitRename} className="flex flex-col gap-4">
						<DialogHeader>
							<DialogTitle>{t("home.rename")}</DialogTitle>
						</DialogHeader>
						<Input
							autoFocus
							value={draftName}
							maxLength={100}
							onChange={(event) => setDraftName(event.target.value)}
							placeholder={t("home.untitled")}
						/>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setRenaming(false)}
							>
								{t("home.cancel")}
							</Button>
							<Button type="submit" disabled={!draftName.trim()}>
								{t("home.save")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	)
}

export default memo(AiCanvasProjectCard)
