import { useTranslation } from "react-i18next"
import { useCallback, useEffect, useRef, useState } from "react"

import MagicModal from "@/components/base/MagicModal"
import { ActionDrawer } from "@/components/shadcn-composed/action-drawer"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { useIsMobile } from "@/hooks/useIsMobile"

interface CreateWorkspaceModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onCreate?: (workspaceName: string) => void
}

const MAX_WORKSPACE_NAME_LENGTH = 100

export function CreateWorkspaceModal({ open, onOpenChange, onCreate }: CreateWorkspaceModalProps) {
	const { t } = useTranslation("super")
	const isMobile = useIsMobile()

	const [newWorkspaceName, setNewWorkspaceName] = useState("")
	const inputRef = useRef<HTMLInputElement>(null)

	const trimmedWorkspaceName = newWorkspaceName.trim()
	const isValidWorkspaceName =
		trimmedWorkspaceName.length > 0 && trimmedWorkspaceName.length <= MAX_WORKSPACE_NAME_LENGTH

	const handleClose = useCallback(() => {
		onOpenChange(false)
		setNewWorkspaceName("")
	}, [onOpenChange])

	const handleCreate = useCallback(() => {
		if (isValidWorkspaceName) {
			onCreate?.(trimmedWorkspaceName)
			handleClose()
		}
	}, [handleClose, trimmedWorkspaceName, onCreate, isValidWorkspaceName])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter" && isValidWorkspaceName) {
				handleCreate()
			}
		},
		[handleCreate, isValidWorkspaceName],
	)

	useEffect(() => {
		if (open) {
			setTimeout(() => {
				inputRef.current?.focus()
			}, 0)
		}
	}, [open])

	// Render input content
	const renderInputContent = () => (
		<div className="flex flex-col gap-2.5">
			<div className="text-xs font-normal leading-4 text-foreground">
				{t("workspace.workspaceName")} <span className="text-destructive">*</span>
			</div>
			<Input
				ref={inputRef}
				className="bg-white"
				value={newWorkspaceName}
				maxLength={MAX_WORKSPACE_NAME_LENGTH}
				onKeyDown={handleKeyDown}
				onChange={(e) => setNewWorkspaceName(e.target.value)}
				placeholder={t("workspace.createWorkspaceTip")}
				data-testid="create-workspace-modal-input"
			/>
		</div>
	)

	// Mobile version using ActionDrawer
	if (isMobile) {
		return (
			<ActionDrawer
				open={open}
				onOpenChange={onOpenChange}
				title={t("workspace.createWorkspace")}
				showCancel={false}
			>
				{renderInputContent()}
				<div className="flex gap-1.5 pt-1">
					<Button
						variant="outline"
						className="h-9 shrink-0 rounded-lg px-8"
						onClick={handleClose}
						data-testid="create-workspace-modal-cancel-button"
					>
						{t("common.cancel")}
					</Button>
					<Button
						className="h-9 flex-1 rounded-lg"
						onClick={handleCreate}
						disabled={!isValidWorkspaceName}
						data-testid="create-workspace-modal-create-button"
					>
						{t("common.create")}
					</Button>
				</div>
			</ActionDrawer>
		)
	}

	// Desktop version using MagicModal
	return (
		<MagicModal
			open={open}
			title={t("workspace.createWorkspace")}
			width={500}
			closable={true}
			maskClosable={false}
			onCancel={handleClose}
			onOk={handleCreate}
			okText={t("common.create")}
			cancelText={t("common.cancel")}
			okButtonProps={{
				disabled: !isValidWorkspaceName,
				className: "min-w-[76px] rounded-lg",
				"data-testid": "create-workspace-modal-create-button",
			}}
			cancelButtonProps={{
				className: "min-w-[76px] rounded-lg",
				"data-testid": "create-workspace-modal-cancel-button",
			}}
		>
			{renderInputContent()}
		</MagicModal>
	)
}

export default CreateWorkspaceModal
