import { useState, type ReactElement } from "react"
import { Archive, AtSign, PencilLine, RotateCcw, Share2, Trash2 } from "lucide-react"
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuTrigger,
} from "@/components/shadcn-ui/context-menu"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
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
import { cn } from "@/utils/cn"
import type { SelfMediaPlatformPostItem } from "../stores/SelfMediaStore"
import type { SelfMediaPostPublishStatus } from "../types"
import { selfMediaOverlayStyles } from "./selfMediaOverlayStyles"

interface SelfMediaPostContextMenuProps {
	children: (openContextMenu: (anchor: HTMLElement) => void) => ReactElement
	item: SelfMediaPlatformPostItem
	title: string
	onRenamePost?: (
		target: SelfMediaPlatformPostItem,
		nextTitle: string,
	) => Promise<boolean | void> | boolean | void
	onDeletePost?: (target: SelfMediaPlatformPostItem) => Promise<boolean | void> | boolean | void
	onMentionPost?: (target: SelfMediaPlatformPostItem) => void
	onSharePost?: (target: SelfMediaPlatformPostItem) => void
	onSetPostPublishStatus?: (
		target: SelfMediaPlatformPostItem,
		publishStatus?: SelfMediaPostPublishStatus,
	) => Promise<boolean | void> | boolean | void
	t: (key: string, options?: Record<string, unknown>) => string
}

function SelfMediaPostContextMenu({
	children,
	item,
	title,
	onRenamePost,
	onDeletePost,
	onMentionPost,
	onSharePost,
	onSetPostPublishStatus,
	t,
}: SelfMediaPostContextMenuProps) {
	const [confirmOpen, setConfirmOpen] = useState(false)
	const [deleting, setDeleting] = useState(false)
	const [renameOpen, setRenameOpen] = useState(false)
	const [renameValue, setRenameValue] = useState("")
	const [renameError, setRenameError] = useState("")
	const [renaming, setRenaming] = useState(false)
	const [settingPublishStatus, setSettingPublishStatus] = useState(false)
	const publishStatus = item.entry.publishStatus || item.post.meta.publishStatus
	const isArchived = publishStatus === "archived"
	const openContextMenu = (anchor: HTMLElement) => {
		const rect = anchor.getBoundingClientRect()
		anchor.dispatchEvent(
			new MouseEvent("contextmenu", {
				bubbles: true,
				cancelable: true,
				button: 2,
				buttons: 2,
				clientX: rect.right - 12,
				clientY: rect.bottom - 12,
			}),
		)
	}

	if (
		!onDeletePost &&
		!onRenamePost &&
		!onMentionPost &&
		!onSharePost &&
		!onSetPostPublishStatus
	) {
		return children(() => undefined)
	}

	const openRenameDialog = () => {
		setRenameValue(title)
		setRenameError("")
		setRenameOpen(true)
	}

	const handleConfirmRename = async () => {
		const nextTitle = renameValue.trim()
		if (!onRenamePost || !nextTitle || renaming) return
		setRenaming(true)
		setRenameError("")
		try {
			const result = await onRenamePost(item, nextTitle)
			if (result !== false) {
				setRenameOpen(false)
				return
			}
			setRenameError(t("detail.selfMedia.home.renamePostFailed"))
		} catch {
			setRenameError(t("detail.selfMedia.home.renamePostFailed"))
		} finally {
			setRenaming(false)
		}
	}

	const handleConfirmDelete = async () => {
		if (!onDeletePost || deleting) return
		setDeleting(true)
		try {
			const result = await onDeletePost(item)
			if (result !== false) {
				setConfirmOpen(false)
			}
		} finally {
			setDeleting(false)
		}
	}

	const handleTogglePublishStatus = async () => {
		if (!onSetPostPublishStatus || settingPublishStatus) return
		setSettingPublishStatus(true)
		try {
			await onSetPostPublishStatus(item, isArchived ? undefined : "archived")
		} finally {
			setSettingPublishStatus(false)
		}
	}

	return (
		<>
			<ContextMenu>
				<ContextMenuTrigger asChild>{children(openContextMenu)}</ContextMenuTrigger>
				<ContextMenuContent
					className={cn("w-48 p-1.5", selfMediaOverlayStyles.floatingPanel)}
				>
					{onMentionPost ? (
						<ContextMenuItem
							className="cursor-pointer rounded-[14px] px-3 py-2 text-[13px] font-[760] text-[#18181b] transition-colors focus:bg-[#18181b]/[0.06] data-[highlighted]:bg-[#18181b]/[0.06] [&_svg]:text-[#71717a]"
							onSelect={() => onMentionPost(item)}
							data-testid={`self-media-home-post-mention-menu-${item.entry.id}`}
						>
							<AtSign className="size-4" aria-hidden="true" />
							{t("detail.selfMedia.home.mentionPost")}
						</ContextMenuItem>
					) : null}
					{onRenamePost ? (
						<ContextMenuItem
							className="cursor-pointer rounded-[14px] px-3 py-2 text-[13px] font-[760] text-[#18181b] transition-colors focus:bg-[#18181b]/[0.06] data-[highlighted]:bg-[#18181b]/[0.06] [&_svg]:text-[#71717a]"
							onSelect={openRenameDialog}
							data-testid={`self-media-home-post-rename-menu-${item.entry.id}`}
						>
							<PencilLine className="size-4" aria-hidden="true" />
							{t("detail.selfMedia.home.renamePost")}
						</ContextMenuItem>
					) : null}
					{onSharePost ? (
						<ContextMenuItem
							className="cursor-pointer rounded-[14px] px-3 py-2 text-[13px] font-[760] text-[#18181b] transition-colors focus:bg-[#18181b]/[0.06] data-[highlighted]:bg-[#18181b]/[0.06] [&_svg]:text-[#71717a]"
							onSelect={() => onSharePost(item)}
							data-testid={`self-media-home-post-share-menu-${item.entry.id}`}
						>
							<Share2 className="size-4" aria-hidden="true" />
							{t("fileViewer.share")}
						</ContextMenuItem>
					) : null}
					{onSetPostPublishStatus ? (
						<ContextMenuItem
							className="cursor-pointer rounded-[14px] px-3 py-2 text-[13px] font-[760] text-[#18181b] transition-colors focus:bg-[#18181b]/[0.06] data-[highlighted]:bg-[#18181b]/[0.06] [&_svg]:text-[#71717a]"
							disabled={settingPublishStatus}
							onSelect={() => void handleTogglePublishStatus()}
							data-testid={`self-media-home-post-publish-status-menu-${item.entry.id}`}
						>
							{isArchived ? (
								<RotateCcw className="size-4" aria-hidden="true" />
							) : (
								<Archive className="size-4" aria-hidden="true" />
							)}
							{t(
								isArchived
									? "detail.selfMedia.home.restorePostPublish"
									: "detail.selfMedia.home.archivePost",
							)}
						</ContextMenuItem>
					) : null}
					{(onMentionPost || onRenamePost || onSharePost || onSetPostPublishStatus) &&
					onDeletePost ? (
						<ContextMenuSeparator className="mx-1 bg-[#18181b]/[0.06]" />
					) : null}
					{onDeletePost ? (
						<ContextMenuItem
							variant="destructive"
							className="cursor-pointer rounded-[14px] px-3 py-2 text-[13px] font-[760] text-[#d92d20] transition-colors focus:bg-[#ff776c]/10 focus:text-[#b42318] data-[highlighted]:bg-[#ff776c]/10 data-[highlighted]:text-[#b42318] [&_svg]:text-[#ff776c]"
							onSelect={() => setConfirmOpen(true)}
							data-testid={`self-media-home-post-delete-menu-${item.entry.id}`}
						>
							<Trash2 className="size-4" aria-hidden="true" />
							{t("detail.selfMedia.home.deletePost")}
						</ContextMenuItem>
					) : null}
				</ContextMenuContent>
			</ContextMenu>
			<Dialog open={renameOpen} onOpenChange={setRenameOpen}>
				<DialogContent
					showCloseButton={false}
					className={cn(
						selfMediaOverlayStyles.alertSurface,
						"max-w-[min(42rem,calc(100vw-3rem))] gap-0 overflow-hidden p-0",
					)}
				>
					<form
						className="flex flex-col"
						onSubmit={(event) => {
							event.preventDefault()
							void handleConfirmRename()
						}}
						data-testid="handle-confirm-rename"
					>
						<DialogHeader className="place-items-start gap-2 px-6 pb-5 pt-6 text-left">
							<DialogTitle className="text-[18px] font-[780] leading-tight text-[#18181b]">
								{t("detail.selfMedia.home.renamePostTitle")}
							</DialogTitle>
							<DialogDescription className="text-[13px] leading-relaxed text-[#71717a]">
								{t("detail.selfMedia.home.renamePostDescription")}
							</DialogDescription>
						</DialogHeader>
						<div className="px-6 pb-7">
							<Input
								value={renameValue}
								onChange={(event) => {
									setRenameValue(event.target.value)
									if (renameError) setRenameError("")
								}}
								aria-label={t("detail.selfMedia.home.renamePostInput")}
								aria-invalid={renameError ? "true" : undefined}
								aria-describedby={
									renameError ? `rename-post-error-${item.entry.id}` : undefined
								}
								autoFocus
								disabled={renaming}
								className="h-11 rounded-[16px] border-0 bg-white/90 px-4 text-[14px] font-[650] text-[#18181b] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.08)] focus-visible:ring-[#18181b]/15"
							/>
							{renameError ? (
								<p
									id={`rename-post-error-${item.entry.id}`}
									className="mt-2 rounded-[14px] bg-[#ff776c]/10 px-3 py-2 text-[12px] font-[650] leading-relaxed text-[#b42318]"
									role="alert"
								>
									{renameError}
								</p>
							) : null}
						</div>
						<DialogFooter className="gap-2 border-t border-[#18181b]/[0.06] bg-white/55 px-6 py-4">
							<Button
								type="button"
								variant="outline"
								disabled={renaming}
								className={selfMediaOverlayStyles.secondaryButtonCompact}
								onClick={() => setRenameOpen(false)}
							>
								{t("detail.selfMedia.home.renamePostCancel")}
							</Button>
							<Button
								type="submit"
								disabled={renaming || renameValue.trim().length === 0}
								className={selfMediaOverlayStyles.primaryButtonCompact}
							>
								{t("detail.selfMedia.home.renamePostConfirm")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent
					size="sm"
					className={cn("gap-5", selfMediaOverlayStyles.alertSurface)}
				>
					<AlertDialogHeader className="place-items-start gap-2 text-left">
						<AlertDialogTitle className="text-[18px] font-[780] leading-tight text-[#18181b]">
							{t("detail.selfMedia.home.deletePostTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription className="text-[13px] leading-relaxed text-[#71717a]">
							{t("detail.selfMedia.home.deletePostDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="-mx-6 -mb-6 gap-2 border-t border-[#18181b]/[0.06] bg-white/55 px-6 py-4">
						<AlertDialogCancel
							disabled={deleting}
							className={selfMediaOverlayStyles.secondaryButtonCompact}
						>
							{t("detail.selfMedia.home.deletePostCancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={deleting}
							className="rounded-full bg-[#d92d20] px-4 font-[800] text-white shadow-[0_12px_24px_rgba(217,45,32,0.18)] hover:bg-[#b42318] disabled:hover:bg-[#d92d20]"
							onClick={(event) => {
								event.preventDefault()
								void handleConfirmDelete()
							}}
						>
							{t("detail.selfMedia.home.deletePostConfirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	)
}

export default SelfMediaPostContextMenu
