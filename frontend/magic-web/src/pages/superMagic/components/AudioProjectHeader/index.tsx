import { useEffect, useState } from "react"
import { ArrowLeft, Copy, Ellipsis, FolderInput, Pencil, Sparkles, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Input } from "@/components/shadcn-ui/input"
import { IconShare3 } from "@tabler/icons-react"
import IconWorkspaceProjectFolder from "@/enhance/tabler/icons-react/icons/IconWorkspaceProjectFolder"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/shadcn-ui/alert-dialog"

interface AudioProjectHeaderProps {
	title: string
	canCopyToProject: boolean
	canRename: boolean
	canMoveToGroup: boolean
	canGenerateSummary: boolean
	canDelete: boolean
	canShare: boolean
	summaryMode?: "generate" | "regenerate"
	summarySubmitting: boolean
	deleting?: boolean
	renaming?: boolean
	onBack: () => void
	onRename: (name: string) => Promise<boolean>
	onMoveToGroup: () => void
	onCopyToProject: () => void
	onGenerateSummary: () => void
	onShare: () => void
	onDelete: () => void
}

/** Renders the recording-only project header without inheriting ordinary project navigation. */
export default function AudioProjectHeader({
	title,
	canCopyToProject,
	canRename,
	canMoveToGroup,
	canGenerateSummary,
	canDelete,
	canShare,
	summaryMode = "regenerate",
	summarySubmitting,
	deleting = false,
	renaming = false,
	onBack,
	onRename,
	onMoveToGroup,
	onCopyToProject,
	onGenerateSummary,
	onShare,
	onDelete,
}: AudioProjectHeaderProps) {
	const { t } = useTranslation("audioRecordings")
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(title)
	const [deleteOpen, setDeleteOpen] = useState(false)
	const [isBackHovered, setIsBackHovered] = useState(false)
	const hasMoreActions =
		canRename || canMoveToGroup || canCopyToProject || canGenerateSummary || canDelete

	useEffect(() => {
		if (!editing) setDraft(title)
	}, [editing, title])

	/** Commits a trimmed title and keeps the header stable when the request fails. */
	async function commitRename() {
		const next = draft.trim()
		setEditing(false)
		if (!next || next === title || renaming) return
		await onRename(next)
	}

	return (
		<header
			className="relative flex w-full flex-col items-center rounded-lg border border-border bg-background transition-all duration-300"
			data-testid="audio-project-header"
		>
			<div className="flex w-full shrink-0 items-center gap-2 overflow-hidden p-2.5">
				<Button
					variant="ghost"
					size="icon"
					className="size-8 shrink-0 rounded-lg bg-yellow-300/20"
					onClick={onBack}
					onMouseEnter={() => setIsBackHovered(true)}
					onMouseLeave={() => setIsBackHovered(false)}
					onFocus={() => setIsBackHovered(true)}
					onBlur={() => setIsBackHovered(false)}
					aria-label={t("detail.back")}
					data-testid="audio-project-header-back"
				>
					{isBackHovered ? (
						<ArrowLeft size={16} className="shrink-0" />
					) : (
						<IconWorkspaceProjectFolder size={16} isHovered={false} />
					)}
				</Button>

				<div className="flex min-w-0 grow flex-col items-start justify-center gap-0.5">
					{editing ? (
						<Input
							autoFocus
							value={draft}
							disabled={renaming}
							onChange={(event) => setDraft(event.target.value)}
							onBlur={() => void commitRename()}
							onKeyDown={(event) => {
								if (event.key === "Enter") void commitRename()
								if (event.key === "Escape") setEditing(false)
							}}
							className="h-8 w-full max-w-md"
							data-testid="audio-project-header-title-input"
						/>
					) : (
						<h1 className="w-full truncate text-sm font-medium leading-5 text-foreground">
							{title}
						</h1>
					)}
				</div>
				{canShare ? (
					<Button
						variant="outline"
						size="icon"
						className="h-7 w-7 shrink-0 shadow-xs"
						onClick={onShare}
						aria-label={t("detail.share")}
						data-testid="audio-project-header-share"
					>
						<IconShare3 size={16} className="text-foreground" />
					</Button>
				) : null}
				{hasMoreActions ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="h-7 w-7 shrink-0 shadow-xs"
								aria-label={t("card.moreActions")}
								data-testid="audio-project-header-more"
							>
								<Ellipsis className="size-5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="min-w-[160px]">
							{canRename ? (
								<DropdownMenuItem onClick={() => setEditing(true)}>
									<Pencil className="size-4" />
									{t("card.rename")}
								</DropdownMenuItem>
							) : null}
							{canMoveToGroup ? (
								<DropdownMenuItem onClick={onMoveToGroup}>
									<FolderInput className="size-4" />
									{t("card.moveToGroup")}
								</DropdownMenuItem>
							) : null}
							{canCopyToProject ? (
								<DropdownMenuItem onClick={onCopyToProject}>
									<Copy className="size-4" />
									{t("card.copyToProject")}
								</DropdownMenuItem>
							) : null}
							{canGenerateSummary ? (
								<DropdownMenuItem
									disabled={summarySubmitting}
									onClick={onGenerateSummary}
								>
									<Sparkles className="size-4" />
									{summarySubmitting
										? t("detail.summarizing")
										: t(
												summaryMode === "generate"
													? "card.generateSummary"
													: "card.regenerateSummary",
											)}
								</DropdownMenuItem>
							) : null}
							{canDelete ? (
								<DropdownMenuItem
									variant="destructive"
									onClick={() => setDeleteOpen(true)}
								>
									<Trash2 className="size-4" />
									{t("actions.deleteTitle")}
								</DropdownMenuItem>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				) : null}
			</div>

			<AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("actions.deleteTitle")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("actions.deleteConfirmSingle")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
						<AlertDialogAction onClick={onDelete} disabled={deleting}>
							{t("actions.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</header>
	)
}
