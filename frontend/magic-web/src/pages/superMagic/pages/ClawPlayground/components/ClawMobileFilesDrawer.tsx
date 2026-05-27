import type { ComponentProps } from "react"
import MagicPopup from "@/components/base-mobile/MagicPopup"
import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import TopicFilesButton from "@/pages/superMagic/components/TopicFilesButton"
import type { TopicFileRowDecorationResolver } from "@/pages/superMagic/components/TopicFilesButton"
import {
	FileActionVisibilityProvider,
	HIDE_CLAW_FILE_ACTIONS,
} from "@/pages/superMagic/providers/file-action-visibility-provider"

type TopicFilesButtonProps = ComponentProps<typeof TopicFilesButton>

interface ClawMobileFilesDrawerProps {
	open: boolean
	onClose: () => void
	clawName?: string | null
	topicFilesProps: Omit<TopicFilesButtonProps, "className" | "resolveTopicFileRowDecoration">
	resolveTopicFileRowDecoration?: TopicFileRowDecorationResolver
}

export function ClawMobileFilesDrawer({
	open,
	onClose,
	clawName,
	topicFilesProps,
	resolveTopicFileRowDecoration,
}: ClawMobileFilesDrawerProps) {
	const { t } = useTranslation("super")
	const popupTitle = t("projectDetail.tabFiles")
	const popupSubtitle =
		clawName?.trim() || topicFilesProps.selectedProject?.project_name?.trim() || ""

	return (
		<MagicPopup
			visible={open}
			onClose={onClose}
			title={popupTitle}
			position="bottom"
			headerVariant="actionHeader"
			headerTitle={popupTitle}
			headerSubtitle={popupSubtitle}
			headerLeadingAction={{
				icon: <X />,
				ariaLabel: t("common.close"),
				onClick: onClose,
				testId: "claw-mobile-files-drawer-close-button",
			}}
			className="rounded-t-[24px] border-0 bg-[#F6F6F3]"
			bodyClassName="flex h-[90vh] max-h-[calc(100dvh-8px)] flex-col overflow-hidden bg-[#F6F6F3]"
			destroyOnClose={false}
		>
			<div
				className="flex h-full min-h-0 flex-col bg-[#F6F6F3]"
				data-testid="claw-mobile-files-drawer-content"
			>
				<FileActionVisibilityProvider value={HIDE_CLAW_FILE_ACTIONS}>
					<TopicFilesButton
						{...topicFilesProps}
						className="min-h-0 flex-1"
						title={popupTitle}
						mobileViewVariant="chat-sheet"
						resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
					/>
				</FileActionVisibilityProvider>
			</div>
		</MagicPopup>
	)
}
