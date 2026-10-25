import { BarChart3, ClipboardCheck, Eye, Link2, MessageCircle, ThumbsUp } from "lucide-react"
import type {
	SelfMediaPostOpsMetricsPayload,
	SelfMediaPostOpsMetricValue,
} from "../services/SelfMediaFileStorageService"
import type { SelfMediaPostOpsArtifacts } from "../services/selfMediaOpsArtifactStates"
import { formatSelfMediaMetricDisplay } from "../services/selfMediaOpsOverview"

export function getEngagementItems(
	opsMetrics?: SelfMediaPostOpsMetricsPayload | null,
	locale?: string,
) {
	const items: Array<{
		key: string
		labelKey: string
		value: string
		Icon: typeof ThumbsUp
	}> = []
	const reads = getOpsMetricDisplayValue(
		opsMetrics?.metrics,
		["reads", "readCount", "read_count", "viewCount", "views", "view_count"],
		locale,
	)
	const likes = getOpsMetricDisplayValue(
		opsMetrics?.metrics,
		["likes", "feedLikes", "likeCount", "like_count"],
		locale,
	)
	const comments = getOpsMetricDisplayValue(
		opsMetrics?.metrics,
		["comments", "commentCount", "commentsCount", "comment_count"],
		locale,
	)

	if (reads) {
		items.push({
			key: "reads",
			labelKey: "detail.selfMedia.home.engagement.reads",
			value: reads,
			Icon: Eye,
		})
	}
	if (likes) {
		items.push({
			key: "likes",
			labelKey: "detail.selfMedia.home.engagement.likes",
			value: likes,
			Icon: ThumbsUp,
		})
	}
	if (comments) {
		items.push({
			key: "comments",
			labelKey: "detail.selfMedia.home.engagement.comments",
			value: comments,
			Icon: MessageCircle,
		})
	}
	return items
}

function getOpsMetricDisplayValue(
	metrics: Record<string, SelfMediaPostOpsMetricValue> | undefined,
	keys: string[],
	locale?: string,
) {
	if (!metrics) return ""
	for (const key of keys) {
		const displayValue = formatSelfMediaMetricDisplay(metrics[key], locale)
		if (displayValue) return displayValue
	}
	return ""
}

export function getOpsArtifactItems(artifacts: SelfMediaPostOpsArtifacts) {
	return [
		{
			key: "source",
			Icon: Link2,
			ready: artifacts.source,
			readyClassName: "bg-[#ff776c]/10 text-[#ff776c]",
			labelKey: artifacts.source
				? "detail.selfMedia.home.opsArtifacts.sourceReady"
				: "detail.selfMedia.home.opsArtifacts.sourceMissing",
		},
		{
			key: "metrics",
			Icon: BarChart3,
			ready: artifacts.metrics,
			readyClassName: "bg-[#ffd637]/20 text-[#d4ad00]",
			labelKey: artifacts.metrics
				? "detail.selfMedia.home.opsArtifacts.metricsReady"
				: "detail.selfMedia.home.opsArtifacts.metricsMissing",
		},
		{
			key: "comments",
			Icon: MessageCircle,
			ready: artifacts.comments,
			readyClassName: "bg-[#cdeb55]/20 text-[#8ba320]",
			labelKey: artifacts.comments
				? "detail.selfMedia.home.opsArtifacts.commentsReady"
				: "detail.selfMedia.home.opsArtifacts.commentsMissing",
		},
		{
			key: "review",
			Icon: ClipboardCheck,
			ready: artifacts.review,
			readyClassName: "bg-[#18181b]/10 text-[#18181b]",
			labelKey: artifacts.review
				? "detail.selfMedia.home.opsArtifacts.reviewReady"
				: "detail.selfMedia.home.opsArtifacts.reviewMissing",
		},
	]
}
