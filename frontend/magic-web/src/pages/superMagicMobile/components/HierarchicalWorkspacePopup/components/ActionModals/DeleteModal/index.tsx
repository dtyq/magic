import { ActionDrawer } from "@/components/shadcn-composed/action-drawer"
import { Button } from "@/components/shadcn-ui/button"
import { memo } from "react"
import type { DeleteModalProps } from "./types"

function DeleteModal({
	visible,
	currentActionItem,
	onCancel,
	onOk,
	translations,
}: DeleteModalProps) {
	const getTitle = () => {
		switch (currentActionItem?.type) {
			case "workspace":
				return translations.deleteWorkspace
			case "project":
				return translations.deleteProject
			case "topic":
				return translations.deleteTopic
			default:
				return ""
		}
	}

	const getContent = () => {
		switch (currentActionItem?.type) {
			case "workspace":
				return translations.deleteWorkspaceConfirm(
					currentActionItem?.workspace?.name || translations.unnamedWorkspace,
				)
			case "project":
				return translations.deleteProjectConfirm(
					currentActionItem?.project?.project_name || translations.unnamedProject,
				)
			case "topic":
				return translations.deleteTopicConfirm(
					currentActionItem?.topic?.topic_name || translations.unnamedTopic,
				)
			default:
				return ""
		}
	}

	return (
		<ActionDrawer
			open={visible}
			onOpenChange={(open) => !open && onCancel()}
			title={getTitle()}
			showCancel={false}
		>
			<div className="text-sm text-foreground">{getContent()}</div>
			<div className="flex gap-1.5 pt-1">
				<Button
					variant="outline"
					className="h-9 shrink-0 rounded-lg px-8"
					onClick={onCancel}
				>
					{translations.cancel}
				</Button>
				<Button variant="destructive" className="h-9 flex-1 rounded-lg" onClick={onOk}>
					{translations.confirm}
				</Button>
			</div>
		</ActionDrawer>
	)
}

export default memo(DeleteModal)
