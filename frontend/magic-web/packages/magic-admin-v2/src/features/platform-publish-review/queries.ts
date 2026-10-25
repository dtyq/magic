import { useQuery } from "@tanstack/react-query"
import type {
	AgentReviewListParams,
	PublishReviewVariant,
	SkillReviewListParams,
} from "@magic-admin-v2/features/platform-publish-review/types"
import { useApis } from "@magic-admin-v2/runtime/context"

export const publishReviewKeys = {
	all: ["platform-publish-review"] as const,
	employeeList: (variant: PublishReviewVariant, params: AgentReviewListParams) =>
		[...publishReviewKeys.all, variant, "employee-list", params] as const,
	skillList: (variant: PublishReviewVariant, params: SkillReviewListParams) =>
		[...publishReviewKeys.all, variant, "skill-list", params] as const,
}

export function useAgentReviewListQuery(
	params: AgentReviewListParams,
	enabled: boolean,
	variant: PublishReviewVariant = "platform",
) {
	const { publishReview } = useApis()
	return useQuery({
		enabled,
		queryKey: publishReviewKeys.employeeList(variant, params),
		queryFn: ({ signal }) => publishReview.getAgentReviewList(params, { signal }),
	})
}

export function useSkillReviewListQuery(
	params: SkillReviewListParams,
	enabled: boolean,
	variant: PublishReviewVariant = "platform",
) {
	const { publishReview } = useApis()
	return useQuery({
		enabled,
		queryKey: publishReviewKeys.skillList(variant, params),
		queryFn: ({ signal }) => publishReview.getSkillReviewList(params, { signal }),
	})
}
