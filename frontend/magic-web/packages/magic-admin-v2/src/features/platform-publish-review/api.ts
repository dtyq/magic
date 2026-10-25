import { RequestUrl } from "@magic-admin-v2/api/constants"
import type { HttpClient, RequestOptions } from "@magic-admin-v2/api/types"
import { buildApiUrl } from "@magic-admin-v2/api/api-url"
import type {
	AgentReviewListParams,
	AgentVersionReviewItem,
	ReviewVersionParams,
	SkillReviewListParams,
	SkillVersionReviewItem,
	WithPage,
} from "@magic-admin-v2/features/platform-publish-review/types"

/** Platform edition publish-review API. Internal review uses its enterprise-only API. */
export function createPlatformPublishReviewApi(client: HttpClient) {
	return {
		getAgentReviewList(params: AgentReviewListParams, options?: RequestOptions) {
			return client.post<WithPage<AgentVersionReviewItem>>(
				RequestUrl.agentReviewList,
				params,
				options,
			)
		},
		getSkillReviewList(params: SkillReviewListParams, options?: RequestOptions) {
			return client.post<WithPage<SkillVersionReviewItem>>(
				RequestUrl.skillReviewList,
				params,
				options,
			)
		},
		reviewAgentVersion(id: string, values: ReviewVersionParams, options?: RequestOptions) {
			return client.put<null>(
				buildApiUrl(RequestUrl.agentReviewAction, { id }),
				values,
				options,
			)
		},
		reviewSkillVersion(id: string, values: ReviewVersionParams, options?: RequestOptions) {
			return client.put<null>(
				buildApiUrl(RequestUrl.skillReviewAction, { id }),
				values,
				options,
			)
		},
	}
}
