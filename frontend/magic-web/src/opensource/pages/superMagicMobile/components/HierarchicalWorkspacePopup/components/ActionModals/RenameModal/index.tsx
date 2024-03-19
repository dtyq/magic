import { ActionDrawer } from "@/opensource/components/shadcn-composed/action-drawer"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input as ShadcnInput } from "@/opensource/components/shadcn-ui/input"
import { memo, useEffect, useRef } from "react"
import type { RenameModalProps } from "./types"

function RenameModal({
	visible,
	currentActionItem,
	onCancel,
	onOk,
	onInputChange,
	translations,
}: RenameModalProps) {
	const inputRef = useRef<HTMLInputElement>(null)

	const getTitle = () => {
		switch (currentActionItem?.type) {
			case "workspace":
				return translations.workspaceRename
			case "project":
				return translations.projectRename
			case "topic":
				return translations.topicRename
			default:
				return ""
		}
	}

	const getPlaceholder = () => {
		switch (currentActionItem?.type) {
			case "workspace":
				return translations.inputWorkspaceName
			case "project":
				return translations.inputProjectName
			case "topic":
				return translations.inputTopicName
			default:
				return ""
		}
	}

	const getValue = () => {
		switch (currentActionItem?.type) {
			case "workspace":
				return currentActionItem?.workspace?.name
			case "project":
				return currentActionItem?.project?.project_name
			case "topic":
				return currentActionItem?.topic?.topic_name
			default:
				return ""
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && getValue()?.trim()) {
			onOk()
		}
	}

	useEffect(() => {
		if (visible) {
			setTimeout(() => {
				inputRef.current?.focus()
			}, 0)
		}
	}, [visible])

	const renderInputContent = () => (
		<ShadcnInput
			ref={inputRef}
			className="bg-white"
			value={getValue()}
			onChange={(e) => onInputChange(e.target.value)}
			onKeyDown={handleKeyDown}
			placeholder={getPlaceholder()}
			autoFocus
		/>
	)

	return (
		<ActionDrawer
			open={visible}
			onOpenChange={(open) => !open && onCancel()}
			title={getTitle()}
			showCancel={false}
		>
			<div className="flex flex-col gap-2.5">
				<div className="text-xs font-normal leading-4 text-foreground">
					{translations.newName}
				</div>
				{renderInputContent()}
			</div>
			<div className="flex gap-1.5 pt-1">
				<Button
					variant="outline"
					className="h-9 shrink-0 rounded-lg px-8"
					onClick={onCancel}
				>
					{translations.cancel}
				</Button>
				<Button
					className="h-9 flex-1 rounded-lg"
					onClick={onOk}
					disabled={!getValue()?.trim()}
				>
					{translations.confirm}
				</Button>
			</div>
		</ActionDrawer>
	)
}

export default memo(RenameModal)
