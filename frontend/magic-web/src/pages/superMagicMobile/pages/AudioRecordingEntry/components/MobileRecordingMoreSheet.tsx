import { useCallback, useState } from "react"
import { Check, X } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Input } from "@/components/shadcn-ui/input"
import type { AudioProjectListItem } from "@/types/audioProject"
import { resolveRecordingDisplayName } from "@/pages/superMagic/pages/AudioRecordings/utils/audio-recordings-utils"
import {
	getSummaryButtonVariant,
	shouldShowSummaryButton,
} from "@/pages/superMagic/pages/AudioRecordings/utils/summary-action-utils"
import {
	MAX_PROJECT_NAME_LENGTH,
	clampProjectName,
	isProjectNameAtLimit,
	isProjectNameOverLimit,
} from "@/pages/superMagicMobile/utils/mobileProjectNameLimit"

interface MobileRecordingMoreSheetProps {
	isOpen: boolean
	item: AudioProjectListItem | null
	onClose: () => void
	onRename: (projectId: string, name: string) => Promise<boolean>
	onDelete: (projectId: string) => Promise<boolean>
	onOpenProject?: (item: AudioProjectListItem) => void
	onSummarize?: (item: AudioProjectListItem) => Promise<boolean>
	onMoveToGroup?: (item: AudioProjectListItem) => void
	onCopyToProject?: (item: AudioProjectListItem) => void
	onShare?: () => void
	onSearch?: () => void
	isSubmittingAction?: boolean
	isSubmittingSummary?: boolean
	canCopyToProject?: boolean
	hideShareAction?: boolean
	hideRenameAction?: boolean
	showRegenerateAction?: boolean
}

type MoreSheetView = "menu" | "rename" | "deleteConfirm"

function MenuItem({
	label,
	danger,
	disabled,
	showDivider,
	dataTestId,
	onClick,
}: {
	label: string
	danger?: boolean
	disabled?: boolean
	showDivider?: boolean
	dataTestId?: string
	onClick?: () => void
}) {
	return (
		<>
			<button
				type="button"
				onClick={onClick}
				disabled={disabled}
				data-testid={dataTestId}
				className="flex h-12 w-full items-center gap-2 bg-transparent px-[14px] transition-opacity active:opacity-60 disabled:opacity-50"
			>
				<span
					className={`flex-1 text-left text-[16px] leading-5 ${danger ? "text-destructive" : "text-foreground"}`}
				>
					{label}
				</span>
			</button>
			{showDivider ? <div className="h-px w-full bg-border" /> : null}
		</>
	)
}

function MenuGroup({ children }: { children: React.ReactNode }) {
	return <div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">{children}</div>
}

/**
 * More-actions sheet aligned with prototype RecordingMoreSheet:
 * wired actions are injected by the parent so list and detail pages can share one menu shell.
 */
export function MobileRecordingMoreSheet({
	isOpen,
	item,
	onClose,
	onRename,
	onDelete,
	onOpenProject,
	onSummarize,
	onMoveToGroup,
	onCopyToProject,
	onShare,
	onSearch,
	isSubmittingAction = false,
	isSubmittingSummary = false,
	canCopyToProject = true,
	hideShareAction = false,
	hideRenameAction = false,
	showRegenerateAction = false,
}: MobileRecordingMoreSheetProps) {
	const { t } = useTranslation(["super", "audioRecordings"])
	const recordingName = item
		? resolveRecordingDisplayName(item.project_name, item.created_at)
		: t("super:mobile.recordingEntry.moreSheet.untitled")
	const isSummarized = item
		? item.card_status === "summarized" ||
			(item.current_phase === "summarizing" && item.phase_status === "completed")
		: false
	const showSummarizeAction = item
		? shouldShowSummaryButton(item.current_phase, item.phase_status) ||
			(showRegenerateAction && isSummarized)
		: false
	const summaryVariant = item
		? showRegenerateAction && isSummarized
			? "retry"
			: getSummaryButtonVariant(item.current_phase, item.phase_status)
		: null

	const [view, setView] = useState<MoreSheetView>("menu")
	const [renameValue, setRenameValue] = useState("")

	const resetState = useCallback(() => {
		setView("menu")
		setRenameValue("")
	}, [])

	const handleSheetOpenChange = useCallback(
		(open: boolean) => {
			if (!open) {
				resetState()
				onClose()
			}
		},
		[onClose, resetState],
	)

	const handleClose = useCallback(() => {
		resetState()
		onClose()
	}, [onClose, resetState])

	const handleRenamePress = useCallback(() => {
		if (!item) return
		setRenameValue(
			clampProjectName(
				resolveRecordingDisplayName(item.project_name, item.created_at),
				MAX_PROJECT_NAME_LENGTH,
			),
		)
		setView("rename")
	}, [item])

	const handleRenameConfirm = useCallback(async () => {
		const name = clampProjectName(renameValue, MAX_PROJECT_NAME_LENGTH)
		if (!name || !item) return
		const success = await onRename(item.id, name)
		if (success) handleClose()
	}, [renameValue, item, onRename, handleClose])

	const handleDeleteConfirm = useCallback(async () => {
		if (!item) return
		const success = await onDelete(item.id)
		if (success) handleClose()
	}, [item, onDelete, handleClose])

	/** Opens the recording's backing project and closes the action sheet before navigation. */
	const handleOpenProject = useCallback(() => {
		if (!item || !onOpenProject) return
		onOpenProject(item)
		handleClose()
	}, [handleClose, item, onOpenProject])

	const handleSummarize = useCallback(async () => {
		if (!item || !onSummarize) return
		const success = await onSummarize(item)
		if (success) handleClose()
	}, [handleClose, item, onSummarize])

	const handleMoveToGroup = useCallback(() => {
		if (!item) return
		onMoveToGroup?.(item)
		handleClose()
	}, [item, onMoveToGroup, handleClose])

	const handleCopyToProject = useCallback(() => {
		if (!item || !canCopyToProject) return
		onCopyToProject?.(item)
		handleClose()
	}, [canCopyToProject, handleClose, item, onCopyToProject])

	const handleShare = useCallback(() => {
		if (onShare) {
			onShare()
			handleClose()
			return
		}

		toast.info(t("super:mobile.recordingEntry.moreSheet.comingSoon"))
	}, [handleClose, onShare, t])

	/** Opens content search from the first menu row and closes the sheet immediately. */
	const handleSearch = useCallback(() => {
		onSearch?.()
		handleClose()
	}, [handleClose, onSearch])

	function resolveHeaderTitle() {
		if (view === "rename") return t("super:mobile.recordingEntry.moreSheet.rename")
		if (view === "deleteConfirm") return t("super:mobile.recordingEntry.moreSheet.deleteTitle")
		return recordingName
	}

	function resolveLeadingAction() {
		if (view === "menu") {
			return {
				icon: <X />,
				ariaLabel: t("super:mobile.recordingEntry.moreSheet.closeAria"),
				onClick: handleClose,
				testId: "mobile-recording-more-close",
			}
		}

		return {
			icon: <X />,
			ariaLabel: t("super:mobile.recordingEntry.moreSheet.backAria"),
			onClick: () => setView("menu"),
			testId: "mobile-recording-more-back",
		}
	}

	function resolveTrailingAction() {
		if (view === "rename") {
			return {
				icon: <Check />,
				ariaLabel: t("super:mobile.recordingEntry.moreSheet.confirmAria"),
				onClick: () => {
					void handleRenameConfirm()
				},
				disabled:
					!renameValue.trim() ||
					isProjectNameOverLimit(renameValue, MAX_PROJECT_NAME_LENGTH) ||
					isSubmittingAction,
				tone: "primary" as const,
				testId: "mobile-recording-rename-confirm",
			}
		}

		if (view === "deleteConfirm") {
			return {
				icon: <Check />,
				ariaLabel: t("super:mobile.recordingEntry.moreSheet.confirmAria"),
				onClick: () => {
					void handleDeleteConfirm()
				},
				disabled: isSubmittingAction,
				tone: "destructive" as const,
				testId: "mobile-recording-delete-confirm",
			}
		}

		return undefined
	}

	return (
		<MagicPopup
			visible={isOpen}
			onOpenChange={handleSheetOpenChange}
			onClose={handleClose}
			position="bottom"
			title={resolveHeaderTitle()}
			headerVariant="actionHeader"
			headerTitle={resolveHeaderTitle()}
			headerLeadingAction={resolveLeadingAction()}
			headerTrailingAction={resolveTrailingAction()}
			className="flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
			bodyClassName="no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-[14px] py-[10px]"
			style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
			data-testid="mobile-recording-more-sheet"
		>
			{view === "menu" ? (
				<>
					<MenuGroup>
						{onSearch ? (
							<MenuItem
								label={t("audioRecordings:detail.searchContent")}
								dataTestId="mobile-recording-more-search"
								showDivider
								onClick={handleSearch}
							/>
						) : null}
						{onOpenProject ? (
							<MenuItem
								label={t("audioRecordings:card.openProject")}
								dataTestId="mobile-recording-more-open-project"
								showDivider
								onClick={handleOpenProject}
							/>
						) : null}
						{hideRenameAction ? null : (
							<MenuItem
								label={t("super:mobile.recordingEntry.moreSheet.rename")}
								dataTestId="mobile-recording-more-rename"
								showDivider
								onClick={handleRenamePress}
							/>
						)}
						<MenuItem
							label={t("super:mobile.recordingEntry.moreSheet.moveToGroup")}
							dataTestId="mobile-recording-more-move-to-group"
							showDivider={Boolean(onCopyToProject)}
							onClick={handleMoveToGroup}
						/>
						{onCopyToProject ? (
							<MenuItem
								label={t("audioRecordings:card.copyToProject")}
								dataTestId="mobile-recording-more-copy-to-project"
								disabled={!canCopyToProject}
								onClick={handleCopyToProject}
							/>
						) : null}
					</MenuGroup>

					<MenuGroup>
						{showSummarizeAction ? (
							<MenuItem
								label={
									summaryVariant === "retry"
										? t(
												"super:mobile.recordingEntry.moreSheet.regenerateSummary",
											)
										: t("super:mobile.recordingEntry.moreSheet.generateSummary")
								}
								dataTestId="mobile-recording-more-summarize"
								disabled={isSubmittingSummary}
								showDivider={!hideShareAction}
								onClick={() => {
									void handleSummarize()
								}}
							/>
						) : null}
						{hideShareAction ? null : (
							<MenuItem
								label={t("super:mobile.recordingEntry.moreSheet.share")}
								dataTestId="mobile-recording-more-share"
								onClick={handleShare}
							/>
						)}
					</MenuGroup>

					<MenuGroup>
						<MenuItem
							label={t("super:mobile.recordingEntry.moreSheet.delete")}
							danger
							dataTestId="mobile-recording-more-delete"
							onClick={() => setView("deleteConfirm")}
						/>
					</MenuGroup>
				</>
			) : null}

			{view === "rename" ? (
				<div className="flex flex-col gap-2">
					<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
						{t("super:mobile.recordingEntry.moreSheet.renameLabel")}
					</p>
					<MenuGroup>
						<Input
							type="text"
							value={renameValue}
							maxLength={MAX_PROJECT_NAME_LENGTH}
							onChange={(event) => setRenameValue(event.target.value)}
							placeholder={t(
								"super:mobile.recordingEntry.moreSheet.renamePlaceholder",
							)}
							autoFocus
							disabled={isSubmittingAction}
							className="h-12 rounded-none border-0 bg-transparent px-[14px] py-0 text-[16px] text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
							onKeyDown={(event) => {
								if (event.key === "Enter") void handleRenameConfirm()
								if (event.key === "Escape") setView("menu")
							}}
							data-testid="mobile-recording-rename-input"
						/>
					</MenuGroup>
					{/* Character counter and limit reminder */}
					<div className="flex items-center justify-between px-[14px] text-xs text-muted-foreground">
						{isProjectNameOverLimit(renameValue, MAX_PROJECT_NAME_LENGTH) ? (
							<span className="text-destructive">
								{t("chat.nameMaxLengthTip", {
									maxLength: MAX_PROJECT_NAME_LENGTH,
								})}
							</span>
						) : isProjectNameAtLimit(renameValue, MAX_PROJECT_NAME_LENGTH) ? (
							<span>
								{t("chat.nameMaxLengthTip", {
									maxLength: MAX_PROJECT_NAME_LENGTH,
								})}
							</span>
						) : (
							<span />
						)}
						<span
							className={
								isProjectNameOverLimit(renameValue, MAX_PROJECT_NAME_LENGTH)
									? "text-destructive"
									: ""
							}
							data-testid="mobile-recording-rename-char-count"
						>
							{renameValue.length}/{MAX_PROJECT_NAME_LENGTH}
						</span>
					</div>
				</div>
			) : null}

			{view === "deleteConfirm" ? (
				<div className="flex flex-col items-center px-4 pt-6">
					<p
						className="pb-6 text-center text-[16px] leading-6 text-foreground"
						data-testid="mobile-recording-delete-message"
					>
						{t("super:mobile.recordingEntry.moreSheet.deleteConfirm", {
							name: recordingName,
						})}
					</p>
				</div>
			) : null}
		</MagicPopup>
	)
}
