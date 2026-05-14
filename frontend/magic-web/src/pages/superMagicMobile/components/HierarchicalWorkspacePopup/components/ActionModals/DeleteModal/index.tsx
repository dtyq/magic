import MagicPopup from "@/components/base-mobile/MagicPopup"
import { Check, X } from "lucide-react"
import { memo } from "react"
import type { DeleteModalProps } from "./types"

function DeleteModal({
	visible,
	currentActionItem,
	onCancel,
	onOk,
	translations,
}: DeleteModalProps) {
	const getHeaderTitle = () => {
		switch (currentActionItem?.type) {
			case "workspace":
				return translations.deleteWorkspaceConfirmTitle || ""
			case "project":
				return translations.deleteProjectConfirmTitle || ""
			case "topic":
				return translations.deleteTopicConfirmTitle || ""
			default:
				return ""
		}
	}

	const getContent = () => {
		switch (currentActionItem?.type) {
			case "workspace":
				return translations.deleteWorkspaceDescription(
					currentActionItem?.workspace?.name || translations.unnamedWorkspace,
				)
			case "project":
				return translations.deleteProjectDescription(
					currentActionItem?.project?.project_name || translations.unnamedProject,
				)
			case "topic":
				return translations.deleteTopicDescription(
					currentActionItem?.topic?.topic_name || translations.unnamedTopic,
				)
			default:
				return ""
		}
	}

	return (
		<MagicPopup
			visible={visible}
			onClose={onCancel}
			position="bottom"
			headerVariant="actionHeader"
			headerTitle={getHeaderTitle()}
			headerLeadingAction={{
				icon: <X className="size-[22px] text-foreground" />,
				ariaLabel: translations.cancel,
				onClick: onCancel,
			}}
			headerTrailingAction={{
				icon: <Check className="size-[22px] text-white" strokeWidth={2.5} />,
				ariaLabel: translations.confirm,
				onClick: onOk,
				tone: "destructive",
			}}
			bodyClassName="max-h-[80vh] p-0"
		>
			<div className="scrollbar-y-thin flex min-h-0 flex-col overflow-y-auto px-6 pb-[max(var(--safe-area-inset-bottom),48px)] pt-6">
				<p className="mx-auto max-w-[680px] text-left text-[16px] leading-6 text-muted-foreground">
					{getContent()}
				</p>
			</div>
		</MagicPopup>
	)
}

export default memo(DeleteModal)
