import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import magicToast from "@/components/base/MagicToaster/utils"
import { Button } from "@/components/shadcn-ui/button"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { Input } from "@/components/shadcn-ui/input"
import SuperMagicService from "@/pages/superMagic/services"
import { Workspace } from "@/pages/superMagic/pages/Workspace/types"

interface WorkspaceRenameDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	workspace: Workspace | null
}

export function WorkspaceRenameDialog({
	open,
	onOpenChange,
	workspace,
}: WorkspaceRenameDialogProps) {
	const { t } = useTranslation("super")
	const [renameLoading, setRenameLoading] = useState(false)
	const [workspaceNameInput, setWorkspaceNameInput] = useState("")

	useEffect(() => {
		if (open && workspace) {
			setWorkspaceNameInput(workspace.name || "")
		}
	}, [open, workspace])

	const handleRenameWorkspace = async () => {
		if (!workspace) return
		const nextName = workspaceNameInput.trim()
		if (!nextName || nextName === workspace.name) {
			onOpenChange(false)
			return
		}

		setRenameLoading(true)
		try {
			await SuperMagicService.workspace.renameWorkspace(workspace.id, nextName)
			await SuperMagicService.workspace.fetchWorkspaces({
				isAutoSelect: false,
				isSelectLast: false,
				page: 1,
			})
			magicToast.success(t("workspace.renameWorkspaceSuccess"))
			onOpenChange(false)
		} catch (error) {
			console.log("重命名工作区失败，失败原因：", error)
		} finally {
			setRenameLoading(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{t("common.rename")}</DialogTitle>
				</DialogHeader>
				<div className="py-4">
					<Input
						autoFocus
						maxLength={100}
						value={workspaceNameInput}
						placeholder={t("workspace.workspaceName")}
						onChange={(e) => setWorkspaceNameInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								void handleRenameWorkspace()
							}
						}}
					/>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						{t("common.cancel")}
					</Button>
					<Button onClick={() => void handleRenameWorkspace()} disabled={renameLoading}>
						{renameLoading ? t("common.loading") : t("common.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
