import type { AgentDetailResponse } from "@/apis/modules/crew"

interface CrewPublishStatusParams {
	latestPublishedAt?: AgentDetailResponse["latest_published_at"]
	updatedAt?: AgentDetailResponse["updated_at"] | null
}

export function hasCrewUnpublishedChanges({
	latestPublishedAt,
	updatedAt,
}: CrewPublishStatusParams) {
	if (!latestPublishedAt) return true
	if (!updatedAt) return false

	const updatedAtMs = Date.parse(updatedAt)
	const latestPublishedAtMs = Date.parse(latestPublishedAt)
	const hasValidUpdatedAt = !Number.isNaN(updatedAtMs)
	const hasValidLatestPublishedAt = !Number.isNaN(latestPublishedAtMs)

	if (hasValidUpdatedAt && hasValidLatestPublishedAt) return updatedAtMs > latestPublishedAtMs
	return updatedAt > latestPublishedAt
}
