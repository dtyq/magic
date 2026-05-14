import { useCallback, useState } from "react"
import { ArrowLeft, X, Check } from "lucide-react"
import { useTranslation } from "react-i18next"

import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Input } from "@/components/shadcn-ui/input"
import type { Workspace } from "@/pages/superMagic/pages/Workspace/types"
import { useWorkspaceTransferEntry } from "@/pages/superMagicMobile/pages/WorkspacesPage/hooks/useWorkspaceTransferEntry"

type SheetView = "menu" | "deleteConfirm"

interface WorkspaceMoreSheetProps {
	isOpen: boolean
	onClose: () => void
	workspace: Workspace | null
	onRename: (id: string, name: string) => Promise<void>
	onDelete: (id: string) => Promise<void>
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

export function WorkspaceMoreSheet({
	isOpen,
	onClose,
	workspace,
	onRename,
	onDelete,
}: WorkspaceMoreSheetProps) {
	const { t } = useTranslation("super")
	const title = workspace?.name ?? t("workspace.workspace")
	const { showTransferEntry, transferEntryLabel, handleOpenTransfer, transferNode } =
		useWorkspaceTransferEntry({
			workspace,
			onClose,
		})

	const [view, setView] = useState<SheetView>("menu")
	const [renameOpen, setRenameOpen] = useState(false)
	const [renameValue, setRenameValue] = useState("")
	const [renameTarget, setRenameTarget] = useState<Workspace | null>(null)

	/**
	 * 每次关闭弹层都回收临时状态，避免上一次操作残留到下一次打开。
	 */
	const resetState = useCallback(() => {
		setView("menu")
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
		setRenameValue(workspace.name ?? "")
		onClose()
		setRenameOpen(true)
	}, [workspace, onClose])

	/**
	 * 提交重命名后统一清理本地状态，让列表依赖 store 刷新自动回流最新名称。
	 */
	const handleRenameConfirm = useCallback(async () => {
		const name = renameValue.trim()
		if (!name || !renameTarget) return
		await onRename(renameTarget.id, name)
		resetState()
	}, [renameValue, renameTarget, onRename, resetState])

	const handleDelete = useCallback(async () => {
		if (!workspace) return
		await onDelete(workspace.id)
		resetState()
		onClose()
	}, [workspace, onDelete, resetState, onClose])

	const handleMenuClose = useCallback(() => {
		resetState()
		onClose()
	}, [onClose, resetState])

	const handleRenameClose = useCallback(() => {
		setRenameOpen(false)
		setRenameValue("")
		setRenameTarget(null)
	}, [])

	const isSubView = view === "deleteConfirm"

	return (
		<>
			<MagicPopup
				visible={isOpen}
				onOpenChange={handleSheetOpenChange}
				onClose={handleMenuClose}
				position="bottom"
				title={typeof title === "string" ? title : undefined}
				headerVariant="actionHeader"
				headerTitle={view === "menu" ? title : t("workspace.deleteWorkspace")}
				headerLeadingAction={
					view === "menu"
						? {
								icon: <X className="size-[22px]" />,
								ariaLabel: t("common.cancel"),
								onClick: handleMenuClose,
							}
						: {
								icon: <ArrowLeft className="size-[22px]" />,
								ariaLabel: t("common.back"),
								onClick: () => setView("menu"),
							}
				}
				headerTrailingAction={
					isSubView
						? {
								icon: <Check className="size-[22px]" strokeWidth={2.5} />,
								ariaLabel: t("common.confirm"),
								onClick: () => {
									void handleDelete()
								},
								tone: "destructive",
							}
						: undefined
				}
				className="flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				bodyClassName="no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-[14px] py-[10px]"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
			>
				{view === "menu" && (
					<>
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
								onClick={() => setView("deleteConfirm")}
							/>
						</MenuGroup>
					</>
				)}

				{isSubView && (
					<p className="px-[14px] text-[16px] leading-6 text-muted-foreground">
						{t("workspace.deleteWorkspaceTip", {
							workspaceName: title,
						})}
					</p>
				)}
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
					icon: <X className="size-[22px]" />,
					ariaLabel: t("common.cancel"),
					onClick: handleRenameClose,
				}}
				headerTrailingAction={{
					icon: <Check className="size-[22px]" strokeWidth={2.5} />,
					ariaLabel: t("common.confirm"),
					onClick: () => {
						void handleRenameConfirm()
					},
					disabled: !renameValue.trim(),
					tone: "primary",
				}}
				className="flex flex-col overflow-hidden rounded-t-[14px] border-0 bg-muted p-0"
				bodyClassName="no-scrollbar flex flex-col gap-2.5 overflow-y-auto px-[14px] py-[10px]"
				style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
			>
				<div className="flex flex-col gap-2">
					<p className="px-[14px] text-[14px] leading-5 text-muted-foreground">
						{t("workspace.rename")}
					</p>
					<MenuGroup>
						<Input
							type="text"
							value={renameValue}
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
				</div>
			</MagicPopup>
		</>
	)
}
