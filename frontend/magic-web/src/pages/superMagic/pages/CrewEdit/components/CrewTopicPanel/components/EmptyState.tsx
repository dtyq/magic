import ConversationEmptyState from "@/pages/superMagic/components/ConversationPanelScaffold/ConversationEmptyState"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import EmptyStateIllustration from "./EmptyStateIllustration"

interface EmptyStateProps {
	className?: string
	variant?: "compact" | "hero"
}

function EmptyState({ className, variant = "compact" }: EmptyStateProps) {
	const { t } = useTranslation("crew/create")

	return (
		<ConversationEmptyState
			className={className}
			icon={<EmptyStateIllustration />}
			title={t("topic.emptyTitle")}
			subtitle={t("topic.emptySubtitle")}
			variant={variant}
			testId={`crew-topic-empty-state-${variant}`}
		/>
	)
}

export default memo(EmptyState)
