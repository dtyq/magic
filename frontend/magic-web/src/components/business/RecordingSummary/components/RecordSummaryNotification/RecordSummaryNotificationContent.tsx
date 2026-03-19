import type { RecordSummaryNotificationContentProps } from "./types"
import { RecordSummaryActionButton, RecordSummaryAlertCard } from "../RecordSummaryAlertCard"
import { genProjectTopicUrl } from "@/pages/superMagic/utils/project"
import { Check, TriangleAlert } from "lucide-react"

function RecordSummaryNotificationContent({
	title,
	description,
	onViewClick,
	onDismiss,
	viewText,
	ignoreText,
	success = false,
	workspaceId,
	projectId,
	topicId,
}: RecordSummaryNotificationContentProps) {
	return (
		<RecordSummaryAlertCard
			title={title}
			description={description}
			icon={success ? <Check size={16} strokeWidth={2} /> : <TriangleAlert size={16} />}
			tone={success ? "success" : "danger"}
			className="w-full"
			data-testid="record-summary-notification-card"
			footer={
				<>
					<RecordSummaryActionButton
						appearance="secondary"
						onClick={onDismiss}
						data-testid="record-summary-notification-dismiss-button"
					>
						{ignoreText}
					</RecordSummaryActionButton>
					<RecordSummaryActionButton
						asChild
						appearance="primary"
						data-testid="record-summary-notification-view-button"
					>
						<a
							href={genProjectTopicUrl(workspaceId, projectId, topicId)}
							target="_blank"
							rel="noreferrer"
							className="hover:text-primary-foreground"
							onClick={onViewClick}
						>
							{viewText}
						</a>
					</RecordSummaryActionButton>
				</>
			}
		/>
	)
}

export default RecordSummaryNotificationContent
