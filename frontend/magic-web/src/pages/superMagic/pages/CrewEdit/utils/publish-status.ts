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
	return updatedAt > latestPublishedAt
}
