import { useCallback, useState } from "react"
import { X, Check } from "lucide-react"
import { useTranslation } from "react-i18next"

import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Input } from "@/components/shadcn-ui/input"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { useWorkspaceTransferEntry } from "@/pages/superMagicMobile/pages/WorkspacesPage/hooks/useWorkspaceTransferEntry"
import {
	MAX_WORKSPACE_NAME_LENGTH,
	clampProjectName,
	isProjectNameAtLimit,
	isProjectNameOverLimit,
} from "@/pages/superMagicMobile/utils/mobileProjectNameLimit"

interface WorkspaceMoreSheetProps {
	isOpen: boolean
	onClose: () => void
	workspace: Workspace | null
	onRename: (id: string, name: string) => Promise<void>
	/** Parent opens the shared delete confirmation sheet */
	onRequestDelete?: () => void
}

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
					className={`flex-1 text-left text-[16px] leading-5 ${danger ? "text-destructive" : "text-foreground"}`}
				>
					{label}
				</span>
			</button>
			{showDivider && <div className="h-px w-full bg-border" />}
		</>
	)
}

function MenuGroup({ children }: { children: React.ReactNode }) {
	/**
	 * 菜单分组负责维持移动端卡片化分区，新增动作时不需要单独处理圆角和背景。
	 */
	return <div className="w-full shrink-0 overflow-hidden rounded-lg bg-card">{children}</div>
}

/**
 * Sheet titles use the display fallback, while rename input keeps the raw persisted name.
 */
function getWorkspaceDisplayName(workspace: Workspace | null, fallbackName: string) {
	return workspace?.name?.trim() || fallbackName
}

export function WorkspaceMoreSheet({
	isOpen,
	onClose,
	workspace,
	onRename,
	onRequestDelete,
}: WorkspaceMoreSheetProps) {
	const { t } = useTranslation("super")
	const title = workspace
		? getWorkspaceDisplayName(workspace, t("workspace.unnamedWorkspace"))
		: t("workspace.workspace")
	const { showTransferEntry, transferEntryLabel, handleOpenTransfer, transferNode } =
		useWorkspaceTransferEntry({
			workspace,
			onClose,
		})

	const [renameOpen, setRenameOpen] = useState(false)
	const [renameValue, setRenameValue] = useState("")
	const [renameTarget, setRenameTarget] = useState<Workspace | null>(null)

	/**
	 * 每次关闭弹层都回收临时状态，避免上一次操作残留到下一次打开。
	 */
	const resetState = useCallback(() => {
		setRenameOpen(false)
		setRenameValue("")
		setRenameTarget(null)
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

	/**
	 * 重命名需要在关闭菜单后继续持有当前工作区上下文，否则确认时会拿不到工作区 id。
	 */
	const handleRenamePress = useCallback(() => {
		if (!workspace) return
		setRenameTarget(workspace)
		setRenameValue(clampProjectName(workspace.name ?? "", MAX_WORKSPACE_NAME_LENGTH))
		onClose()
		setRenameOpen(true)
	}, [workspace, onClose])

	/**
	 * 提交重命名后统一清理本地状态，让列表依赖 store 刷新自动回流最新名称。
	 */
	const handleRenameConfirm = useCallback(async () => {
		const name = clampProjectName(renameValue, MAX_WORKSPACE_NAME_LENGTH)
		if (!name || !renameTarget) return
		await onRename(renameTarget.id, name)
		resetState()
	}, [renameValue, renameTarget, onRename, resetState])

	/** Close menu and delegate delete confirmation to the parent page-level sheet. */
	const handleDeletePress = useCallback(() => {
		onRequestDelete?.()
		onClose()
	}, [onRequestDelete, onClose])

	const handleMenuClose = useCallback(() => {
		resetState()
		onClose()
	}, [onClose, resetState])

	const handleRenameClose = useCallback(() => {
		setRenameOpen(false)
		setRenameValue("")
		setRenameTarget(null)
	}, [])

	return (
		<>
			<MagicPopup
				visible={isOpen}
				onOpenChange={handleSheetOpenChange}
				onClose={handleMenuClose}
				position="bottom"
				title={typeof title === "string" ? title : undefined}
				headerVariant="actionHeader"
				headerTitle={title}
				headerLeadingAction={{
					icon: <X />,
					ariaLabel: t("common.cancel"),
					onClick: handleMenuClose,
					testId: "mobile-workspace-more-close-button",
				}}
				className="flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				bodyClassName="no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-[14px] py-[10px]"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
			>
				<MenuGroup>
					<MenuItem
						label={t("workspace.rename")}
						dataTestId="mobile-workspace-more-rename-button"
						onClick={handleRenamePress}
					/>
					{showTransferEntry && (
						<MenuItem
							label={transferEntryLabel}
							dataTestId="mobile-workspace-more-transfer-button"
							showDivider={false}
							onClick={handleOpenTransfer}
						/>
					)}
				</MenuGroup>
				<MenuGroup>
					<MenuItem
						label={t("common.delete")}
						danger
						dataTestId="mobile-workspace-more-delete-button"
						onClick={handleDeletePress}
					/>
				</MenuGroup>
			</MagicPopup>
			{transferNode}

			<MagicPopup
				visible={renameOpen}
				onOpenChange={(open) => {
					if (!open) {
						handleRenameClose()
					}
				}}
				onClose={handleRenameClose}
				position="bottom"
				title={t("workspace.rename")}
				headerVariant="actionHeader"
				headerTitle={t("workspace.rename")}
				headerLeadingAction={{
					icon: <X />,
					ariaLabel: t("common.cancel"),
					onClick: handleRenameClose,
					testId: "mobile-workspace-rename-close-button",
				}}
				headerTrailingAction={{
					icon: <Check />,
					ariaLabel: t("common.confirm"),
					onClick: () => {
						void handleRenameConfirm()
					},
					disabled:
						!renameValue.trim() ||
						isProjectNameOverLimit(renameValue, MAX_WORKSPACE_NAME_LENGTH),
					tone: "primary",
					testId: "mobile-workspace-rename-confirm-button",
				}}
				className="flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				bodyClassName="no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-[14px] py-[10px]"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
			>
				<div className="flex flex-col gap-2">
					{/* Field label above the input; header stays "Rename" for the sheet action. */}
					<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
						{t("workspace.workspaceName")}
					</p>
					<MenuGroup>
						<Input
							type="text"
							value={renameValue}
							maxLength={MAX_WORKSPACE_NAME_LENGTH}
							onChange={(e) => setRenameValue(e.target.value)}
							placeholder={t("workspace.createWorkspaceTip")}
							autoFocus
							className="h-12 rounded-none border-0 bg-transparent px-[14px] py-0 text-[16px] text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									void handleRenameConfirm()
								}
								if (e.key === "Escape") {
									handleRenameClose()
								}
							}}
						/>
					</MenuGroup>
					{/* Character counter and limit reminder */}
					<div className="flex items-center justify-between px-[14px] text-xs text-muted-foreground">
						{isProjectNameOverLimit(renameValue, MAX_WORKSPACE_NAME_LENGTH) ? (
							<span className="text-destructive">
								{t("chat.nameMaxLengthTip", {
									maxLength: MAX_WORKSPACE_NAME_LENGTH,
								})}
							</span>
						) : isProjectNameAtLimit(renameValue, MAX_WORKSPACE_NAME_LENGTH) ? (
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
								isProjectNameOverLimit(renameValue, MAX_WORKSPACE_NAME_LENGTH)
									? "text-destructive"
									: ""
							}
							data-testid="workspace-rename-sheet-char-count"
						>
							{renameValue.length}/{MAX_WORKSPACE_NAME_LENGTH}
						</span>
					</div>
				</div>
			</MagicPopup>
		</>
	)
}
