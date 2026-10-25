import { useCallback, useState } from "react"
import { Check, MoreHorizontal, Plus, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Input } from "@/components/shadcn-ui/input"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import {
	ALL_RECORDING_GROUP_ID,
	UNGROUPED_RECORDING_GROUP_ID,
} from "@/services/audioRecordings/RecordingGroupsConstants"
import { resolveRecordingGroupDisplayName } from "@/services/audioRecordings/resolveRecordingGroupDisplayName"
import {
	MAX_WORKSPACE_NAME_LENGTH,
	clampProjectName,
	isProjectNameAtLimit,
	isProjectNameOverLimit,
} from "@/pages/superMagicMobile/utils/mobileProjectNameLimit"

export { ALL_RECORDING_GROUP_ID, UNGROUPED_RECORDING_GROUP_ID }

export interface MobileRecordingGroup {
	id: string
	name: string
	projectCount: number
	isVirtual: boolean
	workspaceType?: string
}

interface MobileRecordingGroupSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	groups: MobileRecordingGroup[]
	selectedGroupId: string
	totalCount: number
	ungroupedCount: number
	onSelect: (groupId: string) => void
	onCreateGroup: (name: string) => Promise<void> | void
	onRenameGroup: (id: string, name: string) => Promise<void> | void
	onDeleteGroup: (id: string) => Promise<void> | void
	isSubmitting?: boolean
}

type GroupSheetView = "menu" | "create" | "groupActions" | "rename" | "deleteConfirm"

/** Returns whether a group row should expose inline management actions */
function isEditableGroup(groupId: string) {
	return groupId !== UNGROUPED_RECORDING_GROUP_ID
}

/** Resolves the localized display label for a group row or header title */
function resolveGroupLabel(group: MobileRecordingGroup, unnamedGroupLabel: string): string {
	return resolveRecordingGroupDisplayName(group.name, unnamedGroupLabel)
}

/**
 * Prototype-aligned selectable row: leading check slot, inline count, optional more button.
 */
function GroupRow({
	label,
	count,
	selected,
	dataTestId,
	onClick,
	onMore,
	moreAriaLabel,
	moreTestId,
	reserveActionSpace,
}: {
	label: string
	count: number
	selected?: boolean
	dataTestId: string
	onClick: () => void
	onMore?: () => void
	moreAriaLabel?: string
	moreTestId?: string
	reserveActionSpace?: boolean
}) {
	return (
		<div className="flex h-12 w-full items-center">
			<button
				type="button"
				onClick={onClick}
				data-testid={dataTestId}
				className="flex h-full min-w-0 flex-1 items-center gap-2 bg-transparent pl-[14px] pr-2 transition-opacity active:opacity-60"
			>
				<span
					className="flex size-4 shrink-0 items-center justify-center"
					aria-hidden="true"
				>
					{selected ? <Check className="size-4 text-primary" strokeWidth={2.5} /> : null}
				</span>
				<span className="flex min-w-0 flex-1 items-baseline gap-1.5">
					<span className="min-w-0 truncate text-left text-[16px] leading-5 text-foreground">
						{label}
					</span>
					<span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
						{count}
					</span>
				</span>
			</button>
			{onMore ? (
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation()
						onMore()
					}}
					data-testid={moreTestId}
					className="mr-[6px] flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-black/5 dark:active:bg-white/10"
					aria-label={moreAriaLabel}
				>
					<MoreHorizontal className="size-5" strokeWidth={2} />
				</button>
			) : null}
			{!onMore && reserveActionSpace ? (
				<span className="mr-[6px] size-9 shrink-0" aria-hidden="true" />
			) : null}
		</div>
	)
}

/** Bottom action row for creating a new group (no chevron per prototype) */
function ActionRow({
	icon,
	label,
	dataTestId,
	onClick,
}: {
	icon: React.ReactNode
	label: string
	dataTestId: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			data-testid={dataTestId}
			className="flex h-12 w-full items-center gap-2 bg-transparent px-[14px] transition-opacity active:opacity-60"
		>
			{icon}
			<span className="flex-1 truncate text-left text-[16px] leading-5 text-foreground">
				{label}
			</span>
		</button>
	)
}

/** Card wrapper for inline group management menu items */
function MenuGroup({ children }: { children: React.ReactNode }) {
	return <div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">{children}</div>
}

/** Single destructive or neutral action inside the group management menu */
function MenuItem({
	label,
	danger,
	showDivider,
	dataTestId,
	onClick,
}: {
	label: string
	danger?: boolean
	showDivider?: boolean
	dataTestId?: string
	onClick?: () => void
}) {
	return (
		<>
			<button
				type="button"
				onClick={onClick}
				data-testid={dataTestId}
				className="flex h-12 w-full items-center gap-2 bg-transparent px-[14px] transition-opacity active:opacity-60"
			>
				<span
					className={`flex-1 text-left text-[16px] leading-5 ${
						danger ? "text-destructive" : "text-foreground"
					}`}
				>
					{label}
				</span>
			</button>
			{showDivider ? <div className="h-px w-full bg-border" /> : null}
		</>
	)
}

/** Computes the localized title for each internal sheet view */
function resolveGroupSheetTitle(
	view: GroupSheetView,
	t: (key: string) => string,
	activeGroupLabel?: string,
): string {
	if (view === "create") return t("super:mobile.recordingEntry.groupSheet.createTitle")
	if (view === "groupActions")
		return activeGroupLabel ?? t("super:mobile.recordingEntry.groupSheet.title")
	if (view === "rename") return t("super:mobile.recordingEntry.groupSheet.renameTitle")
	if (view === "deleteConfirm") return t("super:mobile.recordingEntry.groupSheet.deleteTitle")
	return t("super:mobile.recordingEntry.groupSheet.title")
}

/**
 * Prototype-aligned group sheet for selecting, creating, renaming, and deleting
 * real audio workspace groups.
 */
export function MobileRecordingGroupSheet({
	open,
	onOpenChange,
	groups = [],
	selectedGroupId,
	totalCount,
	ungroupedCount,
	onSelect,
	onCreateGroup,
	onRenameGroup,
	onDeleteGroup,
	isSubmitting = false,
}: MobileRecordingGroupSheetProps) {
	const { t } = useTranslation(["super", "audioRecordings"])
	const unnamedGroupLabel = t("super:mobile.recordingEntry.groupSheet.unnamedGroup")
	const [view, setView] = useState<GroupSheetView>("menu")
	const [draftName, setDraftName] = useState("")
	const [activeGroup, setActiveGroup] = useState<MobileRecordingGroup | null>(null)

	const activeGroupLabel = activeGroup
		? resolveGroupLabel(activeGroup, unnamedGroupLabel)
		: undefined

	const resetState = useCallback(() => {
		setView("menu")
		setDraftName("")
		setActiveGroup(null)
	}, [])

	const handleClose = useCallback(() => {
		resetState()
		onOpenChange(false)
	}, [onOpenChange, resetState])

	const handleSelect = useCallback(
		(groupId: string) => {
			onSelect(groupId)
			handleClose()
		},
		[handleClose, onSelect],
	)

	const handleCreateConfirm = useCallback(async () => {
		const name = clampProjectName(draftName, MAX_WORKSPACE_NAME_LENGTH)
		if (!name) return
		await onCreateGroup(name)
		setDraftName("")
		setView("menu")
	}, [draftName, onCreateGroup])

	const handleRenameConfirm = useCallback(async () => {
		const name = clampProjectName(draftName, MAX_WORKSPACE_NAME_LENGTH)
		if (!name || !activeGroup) return
		await onRenameGroup(activeGroup.id, name)
		setDraftName("")
		setActiveGroup(null)
		setView("menu")
	}, [activeGroup, draftName, onRenameGroup])

	const handleDeleteConfirm = useCallback(async () => {
		if (!activeGroup) return
		await onDeleteGroup(activeGroup.id)
		setActiveGroup(null)
		setView("menu")
	}, [activeGroup, onDeleteGroup])

	const openGroupActions = useCallback((group: MobileRecordingGroup) => {
		if (!isEditableGroup(group.id)) return
		setActiveGroup(group)
		setView("groupActions")
	}, [])

	const startRenameGroup = useCallback(() => {
		if (!activeGroup) return
		setDraftName(clampProjectName(activeGroup.name, MAX_WORKSPACE_NAME_LENGTH))
		setView("rename")
	}, [activeGroup])

	const handleLeadingBack = useCallback(() => {
		if (view === "menu") {
			handleClose()
			return
		}
		if (view === "rename" || view === "deleteConfirm") {
			setView("groupActions")
			return
		}
		setView("menu")
		setActiveGroup(null)
	}, [handleClose, view])

	const leadingAction = {
		icon: <X />,
		ariaLabel:
			view === "menu"
				? t("super:mobile.recordingEntry.groupSheet.closeAria")
				: t("super:mobile.recordingEntry.groupSheet.backAria"),
		onClick: handleLeadingBack,
		testId:
			view === "menu"
				? "mobile-recording-group-sheet-close"
				: "mobile-recording-group-sheet-back",
	}

	const trailingAction =
		view === "create" || view === "rename"
			? {
					icon: <Check />,
					ariaLabel: t("super:mobile.recordingEntry.groupSheet.confirmAria"),
					onClick: () => {
						void (view === "create" ? handleCreateConfirm() : handleRenameConfirm())
					},
					disabled:
						!draftName.trim() ||
						isProjectNameOverLimit(draftName, MAX_WORKSPACE_NAME_LENGTH) ||
						isSubmitting,
					tone: "primary" as const,
					testId:
						view === "create"
							? "mobile-recording-group-create-confirm"
							: "mobile-recording-group-rename-confirm",
				}
			: view === "deleteConfirm"
				? {
						icon: <Check />,
						ariaLabel: t("super:mobile.recordingEntry.groupSheet.confirmAria"),
						onClick: () => {
							void handleDeleteConfirm()
						},
						disabled: isSubmitting,
						tone: "destructive" as const,
						testId: "mobile-recording-group-delete-confirm",
					}
				: undefined

	return (
		<MagicPopup
			visible={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) handleClose()
			}}
			onClose={handleClose}
			position="bottom"
			title={resolveGroupSheetTitle(view, t, activeGroupLabel)}
			headerVariant="actionHeader"
			headerTitle={resolveGroupSheetTitle(view, t, activeGroupLabel)}
			headerLeadingAction={leadingAction}
			headerTrailingAction={trailingAction}
			// Keep focus scrolling inside the list while the sheet header remains fixed.
			className="max-h-[78vh] gap-0 rounded-t-[14px] border-0 bg-muted p-0 supports-[overflow:clip]:overflow-clip"
			bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0 supports-[overflow:clip]:overflow-clip"
			style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
			data-testid="mobile-recording-group-sheet"
		>
			<ScrollArea
				className="grid min-h-0 flex-1"
				viewportClassName="h-auto min-h-0 px-[14px] py-[10px] [&>div]:!flex [&>div]:flex-col [&>div]:gap-2.5"
			>
				{view === "menu" ? (
					<>
						<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
							<GroupRow
								label={t("super:mobile.recordingEntry.groupSheet.all")}
								count={totalCount}
								selected={selectedGroupId === ALL_RECORDING_GROUP_ID}
								dataTestId="mobile-recording-group-option-all"
								onClick={() => handleSelect(ALL_RECORDING_GROUP_ID)}
								reserveActionSpace
							/>
							<div className="h-px w-full bg-border" />
							<GroupRow
								label={t("super:mobile.recordingEntry.groupSheet.ungrouped")}
								count={ungroupedCount}
								selected={selectedGroupId === UNGROUPED_RECORDING_GROUP_ID}
								dataTestId="mobile-recording-group-option-ungrouped"
								onClick={() => handleSelect(UNGROUPED_RECORDING_GROUP_ID)}
								reserveActionSpace
							/>
							{groups.map((group) => (
								<div key={group.id}>
									<div className="h-px w-full bg-border" />
									<GroupRow
										label={resolveGroupLabel(group, unnamedGroupLabel)}
										count={group.projectCount}
										selected={selectedGroupId === group.id}
										dataTestId="mobile-recording-group-option"
										onClick={() => handleSelect(group.id)}
										onMore={() => openGroupActions(group)}
										moreAriaLabel={t(
											"super:mobile.recordingEntry.groupSheet.moreGroupAria",
											{
												name: resolveGroupLabel(group, unnamedGroupLabel),
											},
										)}
										moreTestId="mobile-recording-group-more-button"
									/>
								</div>
							))}
						</div>

						<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
							<ActionRow
								icon={<Plus className="size-[18px] text-foreground" />}
								label={t("super:mobile.recordingEntry.groupSheet.newGroup")}
								dataTestId="mobile-recording-group-create-trigger"
								onClick={() => {
									setDraftName("")
									setView("create")
								}}
							/>
						</div>
					</>
				) : null}

				{view === "create" ? (
					<div className="flex flex-col gap-2">
						<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
							{t("super:mobile.recordingEntry.groupSheet.groupNameLabel")}
						</p>
						<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
							<Input
								type="text"
								value={draftName}
								maxLength={MAX_WORKSPACE_NAME_LENGTH}
								onChange={(event) => setDraftName(event.target.value)}
								placeholder={t(
									"super:mobile.recordingEntry.groupSheet.groupNamePlaceholder",
								)}
								autoFocus
								disabled={isSubmitting}
								className="h-12 rounded-none border-0 bg-transparent px-[14px] py-0 text-[16px] text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
								data-testid="mobile-recording-group-create-input"
								onKeyDown={(event) => {
									if (event.key === "Enter") void handleCreateConfirm()
									if (event.key === "Escape") setView("menu")
								}}
							/>
						</div>
						{/* Character counter and limit reminder */}
						<div className="flex items-center justify-between px-[14px] text-xs text-muted-foreground">
							{isProjectNameOverLimit(draftName, MAX_WORKSPACE_NAME_LENGTH) ? (
								<span className="text-destructive">
									{t("chat.nameMaxLengthTip", {
										maxLength: MAX_WORKSPACE_NAME_LENGTH,
									})}
								</span>
							) : isProjectNameAtLimit(draftName, MAX_WORKSPACE_NAME_LENGTH) ? (
								<span>
									{t("chat.nameMaxLengthTip", {
										maxLength: MAX_WORKSPACE_NAME_LENGTH,
									})}
								</span>
							) : (
								<span />
							)}
							<span
								className={
									isProjectNameOverLimit(draftName, MAX_WORKSPACE_NAME_LENGTH)
										? "text-destructive"
										: ""
								}
								data-testid="mobile-recording-group-create-char-count"
							>
								{draftName.length}/{MAX_WORKSPACE_NAME_LENGTH}
							</span>
						</div>
					</div>
				) : null}

				{view === "rename" ? (
					<div className="flex flex-col gap-2">
						<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
							{t("super:mobile.recordingEntry.groupSheet.renameLabel")}
						</p>
						<div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">
							<Input
								type="text"
								value={draftName}
								maxLength={MAX_WORKSPACE_NAME_LENGTH}
								onChange={(event) => setDraftName(event.target.value)}
								placeholder={t(
									"super:mobile.recordingEntry.groupSheet.renamePlaceholder",
								)}
								autoFocus
								disabled={isSubmitting}
								className="h-12 rounded-none border-0 bg-transparent px-[14px] py-0 text-[16px] text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
								data-testid="mobile-recording-group-rename-input"
								onKeyDown={(event) => {
									if (event.key === "Enter") void handleRenameConfirm()
									if (event.key === "Escape") setView("groupActions")
								}}
							/>
						</div>
						{/* Character counter and limit reminder */}
						<div className="flex items-center justify-between px-[14px] text-xs text-muted-foreground">
							{isProjectNameOverLimit(draftName, MAX_WORKSPACE_NAME_LENGTH) ? (
								<span className="text-destructive">
									{t("chat.nameMaxLengthTip", {
										maxLength: MAX_WORKSPACE_NAME_LENGTH,
									})}
								</span>
							) : isProjectNameAtLimit(draftName, MAX_WORKSPACE_NAME_LENGTH) ? (
								<span>
									{t("chat.nameMaxLengthTip", {
										maxLength: MAX_WORKSPACE_NAME_LENGTH,
									})}
								</span>
							) : (
								<span />
							)}
							<span
								className={
									isProjectNameOverLimit(draftName, MAX_WORKSPACE_NAME_LENGTH)
										? "text-destructive"
										: ""
								}
								data-testid="mobile-recording-group-rename-char-count"
							>
								{draftName.length}/{MAX_WORKSPACE_NAME_LENGTH}
							</span>
						</div>
					</div>
				) : null}

				{view === "groupActions" && activeGroup ? (
					<MenuGroup>
						<MenuItem
							label={t("super:mobile.recordingEntry.groupSheet.rename")}
							showDivider
							dataTestId="mobile-recording-group-rename-trigger"
							onClick={startRenameGroup}
						/>
						<MenuItem
							label={t("super:mobile.recordingEntry.groupSheet.deleteGroup")}
							danger
							dataTestId="mobile-recording-group-delete-trigger"
							onClick={() => setView("deleteConfirm")}
						/>
					</MenuGroup>
				) : null}

				{view === "deleteConfirm" && activeGroup ? (
					<div className="flex flex-col items-center px-4 pt-6">
						<p className="text-center text-[16px] leading-6 text-foreground">
							{t("super:mobile.recordingEntry.groupSheet.deleteConfirm", {
								name: activeGroupLabel,
							})}
						</p>
					</div>
				) : null}
			</ScrollArea>
		</MagicPopup>
	)
}
