import type { ComponentProps } from "react"
import MagicPopup from "@/components/base-mobile/MagicPopup"
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
	topicFilesProps: Omit<TopicFilesButtonProps, "className" | "resolveTopicFileRowDecoration">
	resolveTopicFileRowDecoration?: TopicFileRowDecorationResolver
}

export function ClawMobileFilesDrawer({
	open,
	onClose,
	topicFilesProps,
	resolveTopicFileRowDecoration,
}: ClawMobileFilesDrawerProps) {
	const { t } = useTranslation("super")

	return (
		<MagicPopup
			visible={open}
			onClose={onClose}
			title={t("chatActions.projectFiles")}
			position="bottom"
			className="h-[85vh] max-h-[calc(100vh-var(--safe-area-inset-top)-var(--safe-area-inset-bottom))]"
			bodyClassName="flex h-full flex-col overflow-hidden"
			destroyOnClose={false}
		>
			<div
				className="min-h-0 flex-1 overflow-hidden pt-1"
				data-testid="claw-mobile-files-drawer-content"
			>
				<FileActionVisibilityProvider value={HIDE_CLAW_FILE_ACTIONS}>
					<TopicFilesButton
						{...topicFilesProps}
						className="h-full"
						resolveTopicFileRowDecoration={resolveTopicFileRowDecoration}
					/>
				</FileActionVisibilityProvider>
			</div>
		</MagicPopup>
	)
}
