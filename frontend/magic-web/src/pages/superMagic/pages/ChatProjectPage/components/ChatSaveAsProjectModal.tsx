import { useEffect, useMemo, useState } from "react"
import { observer } from "mobx-react-lite"
import { useMemoizedFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Check, X } from "lucide-react"
import MagicModal from "@/components/base/MagicModal"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Input } from "@/components/shadcn-ui/input"
import { cn } from "@/utils/cn"
import SuperMagicService from "@/pages/superMagic/services"
import { workspaceStore } from "@/pages/superMagic/stores/core"
import IconWorkspace from "@/pages/superMagic/components/icons/IconWorkspace"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"

interface ChatSaveAsProjectModalProps {
	open: boolean
	defaultProjectName?: string
	sourceWorkspaceId?: string
	isSubmitting?: boolean
	onClose: () => void
	onConfirm: (payload: { workspaceId: string; projectName: string }) => void
}

/**
 * Desktop save-as-project modal: collect target project name and destination workspace.
 */
function ChatSaveAsProjectModal({
	open,
	defaultProjectName = "",
	sourceWorkspaceId,
	isSubmitting = false,
	onClose,
	onConfirm,
}: ChatSaveAsProjectModalProps) {
	const { t } = useTranslation("super")
	const [projectName, setProjectName] = useState(defaultProjectName)
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("")

	const workspaces = workspaceStore.workspaces

	const selectableWorkspaces = useMemo(
		() => workspaces.filter((workspace) => workspace.id !== sourceWorkspaceId),
		[sourceWorkspaceId, workspaces],
	)

	useEffect(() => {
		if (!open) return

		setProjectName(defaultProjectName.slice(0, 100))
		void SuperMagicService.workspace.fetchWorkspaces({ page: 1 })
	}, [defaultProjectName, open])

	useEffect(() => {
		if (!open) return

		const isCurrentSelectionAvailable = selectableWorkspaces.some(
			(workspace) => workspace.id === selectedWorkspaceId,
		)
		if (isCurrentSelectionAvailable) return

		// Preserve user selection after background refreshes; only auto-pick when the choice is empty or stale.
		setSelectedWorkspaceId(selectableWorkspaces[0]?.id || "")
	}, [open, selectableWorkspaces, selectedWorkspaceId])

	/** Submit save-as payload after validating required fields. */
	const handleConfirm = useMemoizedFn(() => {
		const trimmedName = projectName.trim().slice(0, 100)
		if (!trimmedName || !selectedWorkspaceId || isSubmitting) return

		onConfirm({
			workspaceId: selectedWorkspaceId,
			projectName: trimmedName,
		})
	})

	return (
		<MagicModal
			width={720}
			open={open}
			onCancel={onClose}
			footer={null}
			closeIcon={null}
			centered
			classNames={{
				body: "!p-0",
				content: cn(
					"rounded-[10px] border border-border shadow-sm",
					"bg-background dark:bg-card",
				),
			}}
			data-testid="chat-save-as-project-modal"
		>
			<div className="flex items-center justify-between gap-1.5 border-b border-border px-3 py-3 text-base font-semibold leading-6 text-foreground">
				<div>{t("chat.saveAsNewProjectTitle")}</div>
				<button
					type="button"
					className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground hover:bg-fill"
					onClick={onClose}
					aria-label={t("common.cancel")}
					data-testid="chat-save-as-project-modal-close"
				>
					<X size={16} />
				</button>
			</div>

			<div className="flex h-[500px] flex-col gap-4 p-3">
				<div className="flex flex-col gap-2">
					<span className="text-sm font-medium text-foreground">
						{t("chat.projectNameFieldLabel")}
					</span>
					<Input
						value={projectName}
						maxLength={100}
						placeholder={t("hierarchicalWorkspacePopup.inputProjectName")}
						onChange={(event) => setProjectName(event.target.value)}
						data-testid="chat-save-as-project-name-input"
					/>
				</div>

				<div className="flex min-h-0 flex-1 flex-col gap-2">
					<span className="text-sm font-medium text-foreground">
						{t("chat.workspaceLabel")}
					</span>
					<ScrollArea
						className="min-h-0 flex-1 rounded-lg border border-border"
						viewportClassName="p-1 [&>div]:!flex [&>div]:flex-col [&>div]:gap-0.5"
						viewportProps={{ "data-testid": "chat-save-as-project-workspace-list" }}
					>
						{selectableWorkspaces.length === 0 ? (
							<div className="px-3 py-6 text-center text-sm text-muted-foreground">
								{t("workspace.noOtherWorkspace")}
							</div>
						) : (
							selectableWorkspaces.map((workspace) => (
								<div
									key={workspace.id}
									className={cn(
										"flex min-h-8 cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-fill",
										selectedWorkspaceId === workspace.id && "bg-fill",
									)}
									onClick={() => setSelectedWorkspaceId(workspace.id)}
									data-testid="chat-save-as-project-workspace-item"
									data-workspace-id={workspace.id}
								>
									<div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm text-foreground">
										<div className="flex size-4 shrink-0 items-center justify-center rounded-[4px]">
											<IconWorkspace />
										</div>
										<div className="min-w-0 flex-1 truncate">
											{workspace.name || t("workspace.unnamedWorkspace")}
										</div>
									</div>
									{selectedWorkspaceId === workspace.id ? (
										<Checkbox checked className="pointer-events-none" />
									) : null}
								</div>
							))
						)}
					</ScrollArea>
				</div>
			</div>

			<div className="flex items-center justify-end gap-1.5 border-t border-border px-3 py-3">
				<Button variant="outline" className="h-9 px-4" onClick={onClose}>
					{t("common.cancel")}
				</Button>
				<Button
					className="h-9 px-4"
					disabled={
						!projectName.trim() ||
						projectName.length > 100 ||
						!selectedWorkspaceId ||
						isSubmitting
					}
					onClick={handleConfirm}
					data-testid="chat-save-as-project-confirm"
				>
					{isSubmitting ? (
						<span className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
					) : (
						<>
							<Check size={16} className="mr-1" />
							{t("chat.confirmSaveAsProject")}
						</>
					)}
				</Button>
			</div>
		</MagicModal>
	)
}

export default observer(ChatSaveAsProjectModal)
